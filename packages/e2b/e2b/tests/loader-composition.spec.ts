/** E2B connection boots through the Loader with deployment config and announces its world. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import E2bConnection from '../src/index.ts'

vi.mock('e2b', () => {
  class FakeNotFound extends Error {}
  class FakeSandbox {
    madeDirs: string[] = []
    killed = false
    static async create(_opts: unknown): Promise<FakeSandbox> {
      return new FakeSandbox()
    }
    files = {
      makeDir: async (path: string): Promise<boolean> => {
        this.madeDirs.push(path)
        return true
      },
    }
    getHost(port: number): string {
      return `https://${port}-test.e2b.app`
    }
    async pause(_opts?: unknown): Promise<boolean> {
      return true
    }
    async createSnapshot(_opts?: unknown): Promise<{ snapshotId: string }> {
      return { snapshotId: 'snap-1' }
    }
    async getInfo(): Promise<{ sandboxId: string }> {
      return { sandboxId: 'sbx-test' }
    }
    async kill(): Promise<boolean> {
      this.killed = true
      return true
    }
  }
  return { Sandbox: FakeSandbox, FileNotFoundError: FakeNotFound }
})

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

async function loadComposition(): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-e2b-loader-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-e2b'",
    '  config:',
    "    apiKey: 'test-key'",
    "    workspace: '/ws-test'",
    '',
  ].join('\n'))

  context = new Context()
  context.baseUrl = pathToFileURL(root).href + '/'
  await context.plugin(Loader)
  context.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (specifier !== '@deepseek-ai/dsh-e2b') throw new Error(`unexpected Loader import: ${specifier}`)
      return E2bConnection
    },
  } as unknown as NonNullable<typeof context.loader.internal>
  await context.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await context.loader.await()
  return context
}

describe('e2b Loader composition', () => {
  it('reserves the sandbox from deployment config and announces the cloud world', async () => {
    const writes: string[] = []
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => {
      writes.push(String(chunk))
      return true
    }) as typeof process.stderr.write)
    try {
      const ctx = await loadComposition()
      const unloaded = [...ctx.loader.entries()]
        .filter(entry => entry.fiber === undefined && !entry.disabled)
        .map(entry => entry.options.name)
      expect(unloaded).toEqual([])
      await expect(ctx.e2b.ready).resolves.toEqual({ workspace: '/ws-test' })
      expect(writes.join('')).toContain('dsh: execution-world: e2b-cloud (workspace /ws-test)')
      await expect(ctx.e2b.dispose()).resolves.toBeUndefined()
    } finally {
      spy.mockRestore()
    }
  })

  it('exposes port, pause, snapshot, and info lifecycle wrappers', async () => {
    const ctx = await loadComposition()
    await ctx.e2b.ready
    expect(ctx.e2b.getHost(3000)).toBe('https://3000-test.e2b.app')
    await expect(ctx.e2b.pause(true)).resolves.toBe(true)
    await expect(ctx.e2b.createSnapshot('rust-base')).resolves.toEqual({ snapshotId: 'snap-1' })
    await expect(ctx.e2b.getInfo()).resolves.toEqual({ sandboxId: 'sbx-test' })
  })
})
