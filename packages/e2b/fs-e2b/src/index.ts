/**
 * Filesystem provider inside the shared E2B sandbox over the native `files.*`
 * API: structured entries instead of shell scraping, byte formats instead of
 * base64 framing, and server-side overwrite instead of staged renames.
 *
 * Identity: `targetKey` is the canonical absolute sandbox path; symlinks are
 * chased through `symlinkTarget` with a hop guard so aliases share one
 * identity. Version: `size|mtimeMs` from entry metadata. Guarded writes
 * re-stat before publication; the check-then-publish window is best-effort on
 * a network filesystem and is documented, not hidden. Per-call sandbox policy
 * is ignored like the bare local backend: the isolation boundary is the
 * sandbox itself (see `@deepseek-ai/dsh-sandbox-e2b`), never an in-world
 * fence.
 *
 * Verified against `e2b@2.51.0` typings by source audit
 * (`extraire-fonctionnalité-code/E2B/packages/js-sdk/src`); re-verify on every
 * SDK bump. Assumes `getInfo` reports symlinks without following the final
 * component (the `symlinkTarget` field exists for that purpose).
 * @module @deepseek-ai/dsh-fs-e2b
 */

import { posix } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FileSystem, FsError, FsTargetKey, FsVersion } from '@deepseek-ai/dsh-fs'
import type { FsDirEntry, FsEditOutcome, FsEditRequest, FsErrorCode, FsInfo, FsPathInfo, FsTarget, FsWriteIntent, FsWriteOutcome } from '@deepseek-ai/dsh-fs'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'
import type {} from '@deepseek-ai/dsh-e2b'
import type { E2bConnection } from '@deepseek-ai/dsh-e2b'
import { FileNotFoundError, FileType } from 'e2b'
import type { EntryInfo } from 'e2b'

/** Symlink chase guard: absolute paths cannot nest deeper than this. */
const MAX_SYMLINK_HOPS = 40

function fail(message: string, code: FsErrorCode, options?: ErrorOptions): never {
  throw new FsError(message, code, options)
}

/** Normalize LF line endings to the shared diff basis. */
function normalize(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

/** Opaque version minted from entry metadata. */
function versionOf(entry: EntryInfo): FsVersion {
  return FsVersion(`${entry.size}|${entry.modifiedTime?.getTime() ?? 0}`)
}

/** Remote filesystem paired with the E2B subprocess and sandbox providers. */
export class E2bFileSystem extends FileSystem {
  static inject = ['e2b']
  private workspace: string | undefined

  override async resolve(path: string, opts?: { cwd?: string; signal?: AbortSignal }): Promise<FsTarget> {
    const base = await this.base(opts?.cwd)
    const key = await this.canonicalize(posix.resolve(base, path), opts?.signal)
    return { targetKey: FsTargetKey(key), displayPath: key }
  }

  override processPath(target: FsTarget): string { return String(target.targetKey) }

  override fileUrl(target: FsTarget): string {
    return pathToFileURL(this.processPath(target)).href
  }

  override contains(parent: FsTarget, child: FsTarget): boolean {
    const path = posix.relative(this.processPath(parent), this.processPath(child))
    return path === '' || (!path.startsWith('../') && path !== '..' && !posix.isAbsolute(path))
  }

  override async stat(target: FsTarget, signal?: AbortSignal): Promise<FsInfo | undefined> {
    const entry = await this.info(this.processPath(target), signal)
    if (entry === undefined) return undefined
    return { version: versionOf(entry), type: fileTypeOf(entry), size: entry.size }
  }

  override async lstat(path: string, opts?: { cwd?: string }, signal?: AbortSignal): Promise<FsPathInfo | undefined> {
    const base = await this.base(opts?.cwd)
    const entry = await this.info(posix.resolve(base, path), signal)
    if (entry === undefined) return undefined
    return { version: versionOf(entry), type: pathTypeOf(entry), size: entry.size }
  }

  override async readText(target: FsTarget, signal?: AbortSignal): Promise<string> {
    const path = this.processPath(target)
    await this.requireFile(path, signal)
    return decode(await this.readAll(path, signal), path)
  }

  override async streamText(target: FsTarget, signal?: AbortSignal): Promise<AsyncIterable<string>> {
    const path = this.processPath(target)
    await this.requireFile(path, signal)
    const stream = await this.files().read(path, {
      format: 'stream', requestTimeoutMs: this.timeout(), ...(signal === undefined ? {} : { signal }),
    })
    return (async function* () {
      // Single-pass streaming fatal decode: a binary file fails loud instead
      // of arriving mojibake, at the cost of late (not upfront) rejection.
      const decoder = new TextDecoder('utf-8', { fatal: true })
      const reader = stream.getReader()
      try {
        for (;;) {
          signal?.throwIfAborted()
          const next = await reader.read()
          if (next.done) break
          yield decoder.decode(next.value, { stream: true })
        }
        yield decoder.decode()
      } catch (error) {
        if (error instanceof Error && error.name === 'TypeError') fail(`E2B file ${path} is not UTF-8 text`, 'FS_NOT_TEXT', { cause: error })
        throw error instanceof FsError
          ? error
          : new FsError(error instanceof Error ? error.message : String(error), signal?.aborted ? 'FS_ABORTED' : 'FS_IO_ERROR', { cause: error })
      } finally {
        await reader.cancel().catch(() => {})
      }
    })()
  }

  override async readBytes(target: FsTarget, signal: AbortSignal | undefined, maxBytes: number): Promise<Uint8Array> {
    const path = this.processPath(target)
    const entry = await this.info(path, signal)
    if (entry === undefined) fail(`E2B read of missing file ${path}`, 'FS_NOT_FOUND')
    if (entry.type !== FileType.FILE) fail(`E2B read of non-regular file ${path}`, 'FS_NOT_REGULAR_FILE')
    if (entry.size > maxBytes) fail(`E2B file ${path} exceeds ${maxBytes} bytes`, 'FS_TOO_LARGE')
    return this.readAll(path, signal)
  }

  override async readByteRange(target: FsTarget, range: { offset: number; length: number }, signal?: AbortSignal): Promise<Uint8Array> {
    const path = this.processPath(target)
    if (!Number.isInteger(range.offset) || !Number.isInteger(range.length) || range.offset < 0 || range.length < 0) {
      fail(`E2B read range [${range.offset}, ${range.length}) is invalid`, 'FS_IO_ERROR')
    }
    if (range.length === 0) return new Uint8Array(0)
    await this.requireFile(path, signal)
    // The SDK has no partial read: stream, skip the prefix, keep the window.
    // Memory stays bounded by `length`, never by the file.
    const stream = await this.files().read(path, {
      format: 'stream', requestTimeoutMs: this.timeout(), ...(signal === undefined ? {} : { signal }),
    })
    const reader = stream.getReader()
    const kept: Uint8Array[] = []
    let keptBytes = 0
    let skipped = 0
    try {
      for (;;) {
        signal?.throwIfAborted()
        const next = await reader.read()
        if (next.done) break
        let chunk = next.value
        if (skipped < range.offset) {
          const drop = Math.min(chunk.length, range.offset - skipped)
          skipped += drop
          chunk = chunk.subarray(drop)
          if (chunk.length === 0) continue
        }
        const room = range.length - keptBytes
        if (room <= 0) break
        const take = chunk.subarray(0, room)
        kept.push(take)
        keptBytes += take.length
        if (keptBytes >= range.length) break
      }
    } catch (error) {
      throw error instanceof FsError
        ? error
        : new FsError(error instanceof Error ? error.message : String(error), signal?.aborted ? 'FS_ABORTED' : 'FS_IO_ERROR', { cause: error })
    } finally {
      await reader.cancel().catch(() => {})
    }
    const out = new Uint8Array(keptBytes)
    let at = 0
    for (const chunk of kept) { out.set(chunk, at); at += chunk.length }
    return out
  }

  override async listDir(target: FsTarget, signal?: AbortSignal): Promise<FsDirEntry[]> {
    const path = this.processPath(target)
    const entry = await this.info(path, signal)
    if (entry === undefined) fail(`E2B listing of missing directory ${path}`, 'FS_NOT_FOUND')
    if (entry.type !== FileType.DIR) fail(`E2B listing of non-directory ${path}`, 'FS_NOT_DIRECTORY')
    let entries: EntryInfo[]
    try {
      entries = await this.files().list(path, { requestTimeoutMs: this.timeout(), ...(signal === undefined ? {} : { signal }) })
    } catch (error) {
      throw this.wrap(error, path, signal)
    }
    const out: FsDirEntry[] = entries.map((child) => {
      // Keys join deterministically from the listed directory: entry paths
      // are presentation, while identity stays under this provider's control.
      const childPath = posix.join(path, child.name)
      return {
        name: child.name,
        type: child.type === FileType.FILE ? 'file' : child.type === FileType.DIR ? 'directory' : 'other',
        target: { targetKey: FsTargetKey(childPath), displayPath: childPath },
        size: child.size,
      }
    })
    out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    return out
  }

  override async writeText(
    target: FsTarget, content: string, expected?: FsWriteIntent, signal?: AbortSignal, _sandboxPolicy?: SandboxExecutionPolicy,
  ): Promise<FsWriteOutcome> {
    const path = this.processPath(target)
    const after = normalize(content)
    const entry = await this.info(path, signal)
    if (entry !== undefined && entry.type !== FileType.FILE) {
      fail(`E2B write to non-regular file ${path}`, 'FS_NOT_REGULAR_FILE')
    }
    if (expected !== undefined) {
      if (expected.kind === 'createIfAbsent' && entry !== undefined) {
        fail(`E2B guarded create of existing file ${path}`, 'FS_NOT_OBSERVED')
      }
      if (expected.kind === 'replaceIfVersion'
        && (entry === undefined || String(versionOf(entry)) !== String(expected.version))) {
        fail(`E2B file ${path} changed since observation`, 'FS_STALE_VERSION')
      }
    }
    // Sizes here are policy-approved (read-before-edit observed the file), so
    // the basis is read whole; a binary prior file declines the basis.
    const before = entry === undefined ? undefined : await this.textOrNull(path, signal)
    try {
      await this.files().write(path, after, { requestTimeoutMs: this.timeout(), ...(signal === undefined ? {} : { signal }) })
    } catch (error) {
      throw this.wrap(error, path, signal)
    }
    const published = await this.info(path, signal)
    if (published === undefined) fail(`E2B file ${path} vanished after publication`, 'FS_IO_ERROR')
    return { operation: entry === undefined ? 'create' : 'update', version: versionOf(published), before: before ?? null, after }
  }

  override async editText(
    target: FsTarget, edit: FsEditRequest, expected?: { version: FsVersion },
    signal?: AbortSignal, _sandboxPolicy?: SandboxExecutionPolicy,
  ): Promise<FsEditOutcome> {
    const path = this.processPath(target)
    if (edit.oldString.length === 0) fail(`E2B edit of ${path} has an empty search string`, 'FS_EDIT_NOT_FOUND')
    const entry = await this.info(path, signal)
    if (entry === undefined) fail(`E2B edit of missing file ${path}`, 'FS_NOT_FOUND')
    if (entry.type !== FileType.FILE) fail(`E2B edit of non-regular file ${path}`, 'FS_NOT_REGULAR_FILE')
    if (expected !== undefined && String(versionOf(entry)) !== String(expected.version)) {
      fail(`E2B file ${path} changed since observation`, 'FS_STALE_VERSION')
    }
    const current = await this.readAll(path, signal)
    let before: string
    try {
      before = decode(current, path)
    } catch (error) {
      fail(`E2B file ${path} is not UTF-8 text`, 'FS_NOT_TEXT', { cause: error })
    }
    const matches = before.split(normalize(edit.oldString)).length - 1
    if (matches === 0) fail(`E2B edit of ${path} found no match`, 'FS_EDIT_NOT_FOUND')
    if (matches > 1 && !edit.replaceAll) fail(`E2B edit of ${path} is ambiguous (${matches} matches)`, 'FS_AMBIGUOUS_EDIT')
    const after = edit.replaceAll
      ? before.split(normalize(edit.oldString)).join(edit.newString)
      : before.replace(normalize(edit.oldString), edit.newString)
    if (expected !== undefined) await this.checkVersion(path, expected.version, signal)
    try {
      await this.files().write(path, after, { requestTimeoutMs: this.timeout(), ...(signal === undefined ? {} : { signal }) })
    } catch (error) {
      throw this.wrap(error, path, signal)
    }
    return { version: await this.freshVersion(path, signal), before, after }
  }

  private timeout(): number {
    return this.ctx.e2b.requestTimeoutMs
  }

  private files(): ReturnType<E2bConnection['connection']>['files'] {
    // The signal travels into each SDK call (not thrown here), and `wrap`
    // maps its abortion onto FS_ABORTED with the caller's signal.
    return this.ctx.e2b.connection().files
  }

  private async base(cwd?: string): Promise<string> {
    if (cwd !== undefined && posix.isAbsolute(cwd)) return cwd
    this.workspace ??= (await this.ctx.e2b.ready).workspace
    return cwd === undefined ? this.workspace : posix.resolve(this.workspace, cwd)
  }

  /** Chase symlinks to a canonical absolute path; missing targets keep spelling. */
  private async canonicalize(spelled: string, signal?: AbortSignal): Promise<string> {
    let current = spelled
    for (let hop = 0; hop < MAX_SYMLINK_HOPS; hop += 1) {
      const entry = await this.info(current, signal)
      if (entry === undefined || entry.type !== FileType.SYMLINK || entry.symlinkTarget === undefined) return current
      current = posix.resolve(posix.dirname(current), entry.symlinkTarget)
    }
    fail(`E2B resolve of ${spelled} exceeds ${MAX_SYMLINK_HOPS} symlink hops`, 'FS_IO_ERROR')
  }

  private async info(path: string, signal?: AbortSignal): Promise<EntryInfo | undefined> {
    try {
      return await this.files().getInfo(path, { requestTimeoutMs: this.timeout(), ...(signal === undefined ? {} : { signal }) })
    } catch (error) {
      if (error instanceof FileNotFoundError) return undefined
      throw this.wrap(error, path, signal)
    }
  }

  private async requireFile(path: string, signal?: AbortSignal): Promise<void> {
    const entry = await this.info(path, signal)
    if (entry === undefined) fail(`E2B read of missing file ${path}`, 'FS_NOT_FOUND')
    if (entry.type !== FileType.FILE) fail(`E2B read of non-regular file ${path}`, 'FS_NOT_REGULAR_FILE')
  }

  private async readAll(path: string, signal?: AbortSignal): Promise<Uint8Array> {
    try {
      return await this.files().read(path, { format: 'bytes', requestTimeoutMs: this.timeout(), ...(signal === undefined ? {} : { signal }) })
    } catch (error) {
      throw this.wrap(error, path, signal)
    }
  }

  /** Decoded prior text, or null when the prior file is not UTF-8 text. */
  private async textOrNull(path: string, signal?: AbortSignal): Promise<string | null> {
    try {
      return decode(await this.readAll(path, signal), path)
    } catch (error) {
      if (error instanceof FsError && error.code === 'FS_NOT_TEXT') return null
      throw error
    }
  }

  private async checkVersion(path: string, version: FsVersion, signal?: AbortSignal): Promise<void> {
    const entry = await this.info(path, signal)
    if (entry === undefined || String(versionOf(entry)) !== String(version)) {
      fail(`E2B file ${path} changed since observation`, 'FS_STALE_VERSION')
    }
  }

  private async freshVersion(path: string, signal?: AbortSignal): Promise<FsVersion> {
    const entry = await this.info(path, signal)
    if (entry === undefined) fail(`E2B file ${path} vanished after publication`, 'FS_IO_ERROR')
    return versionOf(entry)
  }

  /** Map SDK failures onto the seam's error codes. */
  private wrap(error: unknown, path: string, signal?: AbortSignal): FsError {
    if (error instanceof FsError) return error
    if (error instanceof FileNotFoundError) return new FsError(`E2B file not found: ${path}`, 'FS_NOT_FOUND', { cause: error })
    return new FsError(
      error instanceof Error ? error.message : String(error),
      signal?.aborted ? 'FS_ABORTED' : 'FS_IO_ERROR',
      { cause: error },
    )
  }
}

function fileTypeOf(entry: EntryInfo): FsInfo['type'] {
  return entry.type === FileType.FILE ? 'file' : entry.type === FileType.DIR ? 'directory' : 'other'
}

function pathTypeOf(entry: EntryInfo): FsPathInfo['type'] {
  return entry.type === FileType.FILE ? 'file' : entry.type === FileType.DIR ? 'directory' : entry.type === FileType.SYMLINK ? 'symlink' : 'other'
}

function decode(bytes: Uint8Array, path: string): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch (error) {
    fail(`E2B file ${path} is not UTF-8 text`, 'FS_NOT_TEXT', { cause: error })
  }
}

export default E2bFileSystem
