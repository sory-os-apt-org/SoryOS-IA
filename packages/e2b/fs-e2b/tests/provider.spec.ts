/** E2B filesystem over the native files API: identity, guards, edits, listings. */
import { Context, Service } from '@deepseek-ai/cordis'
import { FsError } from '@deepseek-ai/dsh-fs'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { E2bFileSystem } from '../src/index.ts'

vi.mock('e2b', () => {
  class FakeNotFound extends Error {}
  return { FileNotFoundError: FakeNotFound }
})

type Node =
  | { kind: 'file'; content: Uint8Array; mtime: number }
  | { kind: 'dir' }
  | { kind: 'symlink'; target: string }

const files = new Map<string, Node>([
  ['/ws', { kind: 'dir' }],
  ['/ws/hello.txt', { kind: 'file', content: Buffer.from('hello\n'), mtime: 1000 }],
  ['/ws/link.txt', { kind: 'symlink', target: 'hello.txt' }],
])

function entryOf(path: string, node: Node): Record<string, unknown> {
  const name = path.split('/').pop() ?? path
  if (node.kind === 'dir') {
    return { name, type: 'dir', path, size: 0, mode: 0, permissions: '', owner: '', group: '', modifiedTime: new Date(0) }
  }
  if (node.kind === 'symlink') {
    return { name, type: 'symlink', path, size: 0, mode: 0, permissions: '', owner: '', group: '', modifiedTime: new Date(0), symlinkTarget: node.target }
  }
  return { name, type: 'file', path, size: node.content.length, mode: 0, permissions: '', owner: '', group: '', modifiedTime: new Date(node.mtime) }
}

async function fakeGetInfo(path: string): Promise<Record<string, unknown>> {
  const { FileNotFoundError } = await import('e2b')
  const node = files.get(path)
  if (node === undefined) throw new FileNotFoundError(`missing: ${path}`)
  return entryOf(path, node)
}

const fakeFiles = {
  getInfo: vi.fn(async (path: string) => fakeGetInfo(path)),
  read: vi.fn(async (path: string, opts?: { format?: string }) => {
    const node = files.get(path)
    if (node === undefined) {
      const { FileNotFoundError } = await import('e2b')
      throw new FileNotFoundError(`missing: ${path}`)
    }
    if (node.kind !== 'file') throw new Error(`not a file: ${path}`)
    if (opts?.format === 'text') return Buffer.from(node.content).toString('utf-8')
    if (opts?.format === 'stream') {
      const bytes = node.content
      return new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes); c.close() } })
    }
    return bytesOf(node.content)
  }),
  write: vi.fn(async (path: string, data: string) => {
    files.set(path, { kind: 'file', content: Buffer.from(data, 'utf-8'), mtime: Date.now() })
    return { name: path.split('/').pop() ?? path, path }
  }),
  list: vi.fn(async (path: string) => {
    const prefix = path.endsWith('/') ? path : `${path}/`
    const out: Record<string, unknown>[] = []
    for (const [key, node] of files) {
      if (key.startsWith(prefix) && !key.slice(prefix.length).includes('/')) out.push(entryOf(key, node))
    }
    return out
  }),
}

function bytesOf(content: Uint8Array): Uint8Array {
  return Uint8Array.from(content)
}

class StubE2b extends Service {
  readonly ready = Promise.resolve({ workspace: '/ws' })
  readonly requestTimeoutMs = 1000
  constructor(ctx: Context) { super(ctx, 'e2b') }
  connection(): unknown {
    return { files: fakeFiles }
  }
  async bounded<T>(operation: Promise<T>): Promise<T> {
    return operation
  }
}

beforeEach(() => {
  files.clear()
  files.set('/ws', { kind: 'dir' })
  files.set('/ws/hello.txt', { kind: 'file', content: Buffer.from('hello\n'), mtime: 1000 })
  files.set('/ws/link.txt', { kind: 'symlink', target: 'hello.txt' })
  vi.clearAllMocks()
})

async function setup(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(StubE2b)
  const fiber = await ctx.plugin(E2bFileSystem)
  onTestFinished(async () => { await fiber.dispose() })
  return ctx
}

describe('E2B filesystem provider', () => {
  it('resolves aliases to one identity and round-trips writes', async () => {
    const ctx = await setup()
    const direct = await ctx.fs.resolve('/ws/hello.txt')
    const viaLink = await ctx.fs.resolve('/ws/link.txt')
    expect(viaLink.targetKey).toBe(direct.targetKey)
    expect(await ctx.fs.readText(direct)).toBe('hello\n')
    const created = await ctx.fs.resolve('/ws/new.txt')
    const outcome = await ctx.fs.writeText(created, 'new content\n')
    expect(outcome.operation).toBe('create')
    expect(outcome.after).toBe('new content\n')
    expect(await ctx.fs.readText(created)).toBe('new content\n')
  })

  it('enforces version guards on guarded writes', async () => {
    const ctx = await setup()
    const target = await ctx.fs.resolve('/ws/hello.txt')
    const info = await ctx.fs.stat(target)
    if (info === undefined) throw new Error('expected file')
    await expect(ctx.fs.writeText(target, 'other', { kind: 'replaceIfVersion', version: info.version }))
      .resolves.toMatchObject({ operation: 'update' })
    await expect(ctx.fs.writeText(target, 'stale', { kind: 'replaceIfVersion', version: info.version }))
      .rejects.toMatchObject({ code: 'FS_STALE_VERSION' })
    await expect(ctx.fs.writeText(target, 'x', { kind: 'createIfAbsent' }))
      .rejects.toMatchObject({ code: 'FS_NOT_OBSERVED' })
  })

  it('edits literally and rejects ambiguous matches', async () => {
    const ctx = await setup()
    const target = await ctx.fs.resolve('/ws/hello.txt')
    await expect(ctx.fs.editText(target, { oldString: 'hello', newString: 'bye', replaceAll: false }))
      .resolves.toMatchObject({ after: 'bye\n' })
    await ctx.fs.writeText(target, 'a a a')
    await expect(ctx.fs.editText(target, { oldString: 'a', newString: 'b', replaceAll: false }))
      .rejects.toMatchObject({ code: 'FS_AMBIGUOUS_EDIT' })
    await expect(ctx.fs.editText(target, { oldString: 'zzz', newString: 'b', replaceAll: false }))
      .rejects.toMatchObject({ code: 'FS_EDIT_NOT_FOUND' })
  })

  it('lists children sorted and bounds raw reads', async () => {
    const ctx = await setup()
    const dir = await ctx.fs.resolve('/ws')
    expect((await ctx.fs.listDir(dir)).map(entry => entry.name)).toEqual(['hello.txt', 'link.txt'])
    const target = await ctx.fs.resolve('/ws/hello.txt')
    await expect(ctx.fs.readBytes(target, undefined, 2)).rejects.toMatchObject({ code: 'FS_TOO_LARGE' })
    expect((await ctx.fs.readByteRange(target, { offset: 1, length: 3 })).length).toBe(3)
    const lstat = await ctx.fs.lstat('/ws/link.txt')
    expect(lstat?.type).toBe('symlink')
  })

  it('reports missing files as FsError NOT_FOUND', async () => {
    const ctx = await setup()
    const target = await ctx.fs.resolve('/ws/absent.txt')
    expect(await ctx.fs.stat(target)).toBeUndefined()
    await expect(ctx.fs.readText(target)).rejects.toBeInstanceOf(FsError)
  })
})
