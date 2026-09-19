/**
 * E2B subprocess and PTY handles over background commands with provider-bounded
 * tails. The seam contract is synchronous-handle/async-start: {@link spawn}
 * returns a live handle immediately while reservation, launch, and collection
 * proceed asynchronously; `done` resolves exit facts (a nonzero exit resolves,
 * it never rejects), `waitForExit` observes the managed range, and `terminate`
 * (or the spec abort) kills the remote command.
 *
 * Bounding: streaming callbacks retain only the in-memory tail per
 * `SubprocessCollect.maxBytes`; the complete stream reaches a provider-owned
 * spill file up to `spill.maxBytes` when the spec requests one, both owned by
 * the shared `OutputCollector`. There is no control channel on E2B
 * (`DataEvent` is stdout/stderr/pty only), so `control` stays absent by design
 * and PTC traffic is excluded. Surviving E2B-side grandchildren are outside
 * the observable managed range and are documented as such.
 *
 * Verified against `e2b@2.51.0` typings by source audit
 * (`extraire-fonctionnalité-code/E2B/packages/js-sdk/src`); re-verify on every
 * SDK bump. Ambient environment is the sandbox template environment; explicit
 * spec entries replace by name (host ambient is never merged — host PATH would
 * poison sandbox lookup).
 * @module @deepseek-ai/dsh-subprocess-e2b
 */

import { PassThrough, type Readable, type Writable } from 'node:stream'
import { Context } from '@deepseek-ai/cordis'
import { SubprocessRuntime, SubprocessExecutableNotFoundError } from '@deepseek-ai/dsh-subprocess'
import type { SubprocessCollectedOutputs, SubprocessHandle, SubprocessOutcome, SubprocessSpawnSpec, SubprocessTerminalEnvironment, SubprocessTerminalHandle, SubprocessTerminalSignal, SubprocessTerminalSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { OutputCollector, prepareManagedProcessBinding } from '@deepseek-ai/dsh-subprocess-local/output'
import type { CommandHandle } from 'e2b'
import type { E2bConnection } from '@deepseek-ai/dsh-e2b'
import { quoteArgv } from '@deepseek-ai/dsh-e2b'

/**
 * A nonzero-exit rejection carrying its outcome. `CommandExitError` implements
 * `CommandResult`; the check is structural so it survives SDK export-surface
 * drift, and the single site is marked for the online typecheck to confirm.
 * @param error - the rejection from `CommandHandle.wait()` or foreground `run()`.
 * @returns the exit code when the rejection carries one, else undefined.
 */
export function commandExitCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code = (error as { exitCode?: unknown }).exitCode
  return typeof code === 'number' ? code : undefined
}

/**
 * Whether the sandbox envd meets a minimum version (feature gates).
 * @param version - the envd version string from sandbox info, if any.
 * @param major - required major version.
 * @param minor - required minor version.
 * @returns true when the version is known and meets the minimum.
 */
export function supportsEnvd(version: string | undefined, major: number, minor: number): boolean {
  if (version === undefined) return false
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version)
  if (match === null) return false
  const gotMajor = Number(match[1])
  const gotMinor = Number(match[2])
  return gotMajor > major || (gotMajor === major && gotMinor >= minor)
}

/**
 * Whether the sandbox envd supports stdin close (gated at 0.5.2).
 * @param version - the envd version string from sandbox info, if any.
 * @returns true when `closeStdin` may be called.
 */
export function supportsStdinClose(version: string | undefined): boolean {
  return supportsEnvd(version, 0, 5)
}

/** One E2B ordinary process with real stdin, bounded tails, and kill. */
class E2bProcess implements SubprocessHandle {
  readonly stdin: Writable | undefined
  readonly stdout: Readable | undefined
  readonly stderr: Readable | undefined
  readonly control = undefined
  readonly collected: SubprocessCollectedOutputs
  readonly done: Promise<SubprocessOutcome>
  private readonly inbound = new PassThrough()
  private readonly out = new PassThrough()
  private readonly err = new PassThrough()
  private readonly started: Promise<void>
  private readonly abortListener: () => void
  private remote: CommandHandle | undefined
  private stdinChain: Promise<void> = Promise.resolve()
  private stdinEnded = false
  private terminateRequested = false
  private quiescent = false
  private termination: Promise<void> | undefined
  private readonly collectors = new Map<'stdout' | 'stderr', OutputCollector>()

  constructor(private readonly e2b: E2bConnection, private readonly spec: SubprocessSpawnSpec) {
    this.stdin = spec.stdio.stdin === 'pipe' ? this.inbound : undefined
    this.stdout = spec.stdio.stdout === 'pipe' ? this.out : undefined
    this.stderr = spec.stdio.stderr === 'pipe' ? this.err : undefined
    for (const stream of [this.inbound, this.out, this.err]) stream.on('error', () => {})
    // Every streamed chunk is pushed, so collector totals stay whole-stream
    // coordinates and readers delegate without base translation. Spill files
    // use the collector's own secure O_EXCL handling.
    const spillDir = prepareManagedProcessBinding().spillDir
    const readers: SubprocessCollectedOutputs = {}
    for (const name of ['stdout', 'stderr'] as const) {
      const mode = spec.stdio[name]
      if (mode === 'pipe') continue
      if (mode === 'inherit') {
        const target = name === 'stdout' ? this.out : this.err
        target.pipe(name === 'stdout' ? process.stdout : process.stderr, { end: false })
        continue
      }
      const collector = new OutputCollector(mode.maxBytes, mode.spill?.maxBytes, name, spillDir)
      this.collectors.set(name, collector)
      readers[name] = { readFrom: (fromByte: number) => collector.readFrom(fromByte) }
    }
    this.collected = readers
    const onAbort = (): void => { this.terminate() }
    spec.signal?.addEventListener('abort', onAbort, { once: true })
    this.abortListener = () => { spec.signal?.removeEventListener('abort', onAbort) }
    this.inbound.on('data', (chunk: Buffer) => { this.sendInput(Buffer.from(chunk)) })
    this.inbound.on('end', () => { void this.endInput() })
    this.inbound.on('close', () => { void this.endInput() })
    this.started = this.start()
    this.done = this.started.then(async () => {
      const outcome = await this.finish()
      this.quiescent = true
      this.abortListener()
      return outcome
    }).catch((error: unknown) => {
      this.terminate()
      for (const stream of [this.inbound, this.out, this.err]) {
        stream.destroy(error instanceof Error ? error : new Error(String(error)))
      }
      throw error
    })
    void this.done.catch(() => {})
  }

  terminate(): void {
    if (this.quiescent || this.termination !== undefined) return
    this.terminateRequested = true
    const remote = this.remote
    this.termination = (async () => {
      // A pre-launch terminate lands once `start()` publishes the handle.
      if (remote === undefined) return
      await remote.kill().catch(() => {})
      this.quiescent = true
      this.abortListener()
    })()
    void this.termination.catch(() => {})
  }

  async waitForExit(signal?: AbortSignal): Promise<boolean> {
    if (this.quiescent) return true
    if (signal?.aborted) return false
    try {
      if (signal === undefined) { await this.done; return true }
      const cancelled = Promise.withResolvers<boolean>()
      const abort = (): void => { cancelled.resolve(false) }
      signal.addEventListener('abort', abort, { once: true })
      try { return await Promise.race([this.done.then(() => true), cancelled.promise]) }
      finally { signal.removeEventListener('abort', abort) }
    } catch { return true }
  }

  private async start(): Promise<void> {
    this.spec.signal?.throwIfAborted()
    const workspace = (await this.e2b.ready).workspace
    const sandbox = this.e2b.connection()
    const cwd = this.spec.cwd.length > 0 ? this.spec.cwd : workspace
    const env = this.spec.env === undefined ? undefined
      : Object.fromEntries(Object.entries(this.spec.env).filter((entry): entry is [string, string] => entry[1] !== undefined))
    const stdinMode = this.spec.stdio.stdin
    // Gate only on a known-old envd: an unreadable version proceeds and the
    // SDK fails loud if the feature is truly absent.
    const envdVersion = await sandbox.getInfo().then(info => info.envdVersion, () => undefined)
    if (envdVersion !== undefined && !supportsEnvd(envdVersion, 0, 3)) {
      throw new Error(`E2B execution requires envd 0.3.0 or newer (sandbox reports ${envdVersion})`)
    }
    if (stdinMode !== 'ignore' && envdVersion !== undefined && !supportsStdinClose(envdVersion)) {
      throw new Error(`E2B stdin requires envd 0.5.2 or newer (sandbox reports ${envdVersion})`)
    }
    this.spec.signal?.throwIfAborted()
    const remote = await sandbox.commands.run(quoteArgv(this.spec.argv), {
      background: true,
      cwd,
      ...(env === undefined ? {} : { envs: env }),
      stdin: stdinMode !== 'ignore',
      timeoutMs: this.e2b.requestTimeoutMs,
      requestTimeoutMs: this.e2b.requestTimeoutMs,
      signal: this.spec.signal,
      onStdout: (chunk) => { this.feed('stdout', chunk) },
      onStderr: (chunk) => { this.feed('stderr', chunk) },
    })
    this.remote = remote
    if (this.terminateRequested) {
      await remote.kill().catch(() => {})
      this.quiescent = true
      this.abortListener()
      throw new Error('E2B process terminated before launch acknowledgement')
    }
    if (typeof stdinMode === 'object') {
      await remote.sendStdin(stdinMode.data)
      await remote.closeStdin()
      this.stdinEnded = true
    }
  }

  /** Serialize one stdin write behind earlier ones; drops after EOF. */
  private sendInput(chunk: Buffer): void {
    if (this.stdinEnded) return
    this.stdinChain = this.stdinChain.then(async () => {
      if (this.stdinEnded) return
      await this.remote?.sendStdin(chunk).catch(() => { this.stdinEnded = true })
    })
    void this.stdinChain.catch(() => {})
  }

  /** Send EOF once the piped input ends. */
  private async endInput(): Promise<void> {
    await this.stdinChain.catch(() => {})
    if (this.stdinEnded) return
    this.stdinEnded = true
    await this.remote?.closeStdin().catch(() => {})
  }

  private feed(name: 'stdout' | 'stderr', chunk: string): void {
    const bytes = Buffer.from(chunk, 'utf-8')
    this.collectors.get(name)?.push(bytes)
    const stream = name === 'stdout' ? this.out : this.err
    if (!stream.destroyed) stream.write(bytes)
  }

  private async finish(): Promise<SubprocessOutcome> {
    const remote = this.remote
    if (remote === undefined) throw new Error('E2B process never launched')
    let exitCode: number
    try {
      exitCode = (await remote.wait()).exitCode
    } catch (error) {
      const code = commandExitCode(error)
      if (code === undefined) throw error
      exitCode = code
    }
    await this.drainOutput()
    for (const stream of [this.out, this.err, this.inbound]) stream.end()
    return { exitCode, signal: null }
  }

  private async drainOutput(): Promise<void> {
    // Race real stream end against the grace window; never wait the full
    // grace when readers already observed the end.
    const pending = (['stdout', 'stderr'] as const)
      .filter(name => typeof this.spec.stdio[name] !== 'object')
      .map((name) => {
        const stream = name === 'stdout' ? this.out : this.err
        if (stream.readableEnded || stream.destroyed) return Promise.resolve()
        return new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, this.spec.graceMs)
          timer.unref?.()
          const done = (): void => { clearTimeout(timer); resolve() }
          for (const event of ['end', 'close', 'error']) stream.once(event, done)
        })
      })
    await Promise.all(pending)
  }
}

/** E2B provider paired with the E2B filesystem; the sandbox owns process lifetimes. */
export class E2bSubprocessRuntime extends SubprocessRuntime {
  static inject = ['e2b']
  private readonly live = new Set<E2bProcess>()
  private readonly terminals = new Set<SubprocessTerminalHandle>()
  private readonly terminalAllocations = new Set<Promise<SubprocessTerminalHandle>>()
  private readonly lifetime = new AbortController()

  constructor(ctx: Context) {
    super(ctx)
    ctx.effect(() => async () => {
      this.lifetime.abort(new Error('E2B subprocess provider disposed'))
      for (const handle of this.live) handle.terminate()
      const results = await Promise.allSettled([
        ...[...this.live].map(handle => handle.waitForExit()),
        ...[...this.terminalAllocations].map(allocation => allocation.catch(() => {})),
        ...[...this.terminals].map(handle => handle.terminate()),
      ])
      const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason as unknown] : [])
      if (errors.length > 0) throw new AggregateError(errors, 'E2B process cleanup could not be confirmed')
    })
  }

  override async resolveExecutable(command: string, env?: Readonly<Record<string, string>>, signal?: AbortSignal): Promise<string> {
    if (command.length === 0) throw new SubprocessExecutableNotFoundError('E2B executable lookup requires a non-empty command')
    if (/[/\\]/.test(command) && !command.startsWith('/')) {
      throw new SubprocessExecutableNotFoundError(`E2B executable lookup rejects relative paths with separators: ${command}`)
    }
    const e2b = this.ctx.e2b
    const workspace = (await e2b.ready).workspace
    const clean = env === undefined ? undefined
      : Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined))
    const probe = command.startsWith('/')
      ? `test -x ${quoted(command)} && printf '%s' ${quoted(command)}`
      : `command -v ${quoted(command)}`
    let resolved: string
    try {
      const result = await e2b.bounded(
        e2b.connection().commands.run(probe, {
          cwd: workspace,
          ...(clean === undefined ? {} : { envs: clean }),
          timeoutMs: e2b.requestTimeoutMs,
          requestTimeoutMs: e2b.requestTimeoutMs,
          signal,
        }),
        signal,
      )
      resolved = result.stdout.trim()
    } catch (error) {
      // Foreground `run` rejects with the exit outcome instead of returning it.
      if (commandExitCode(error) !== undefined) throw new SubprocessExecutableNotFoundError(`E2B executable not found: ${command}`, { cause: error })
      throw error
    }
    if (resolved.length === 0) throw new SubprocessExecutableNotFoundError(`E2B executable not found: ${command}`)
    return resolved
  }

  override async terminalEnvironment(signal?: AbortSignal): Promise<SubprocessTerminalEnvironment> {
    const e2b = this.ctx.e2b
    const workspace = (await e2b.ready).workspace
    const result = await e2b.bounded(
      e2b.connection().commands.run('printf %s "$SHELL"', {
        cwd: workspace, timeoutMs: e2b.requestTimeoutMs, requestTimeoutMs: e2b.requestTimeoutMs, signal,
      }),
      signal,
    )
    return {
      platform: 'posix',
      ...(result.exitCode === 0 && result.stdout.length > 0 ? { defaultShell: result.stdout } : {}),
    }
  }

  override spawn(spec: SubprocessSpawnSpec): SubprocessHandle {
    this.lifetime.signal.throwIfAborted()
    spec.signal?.throwIfAborted()
    if (spec.argv.length === 0) throw new Error('E2B spawn requires a non-empty argv')
    if (spec.stdio.control !== undefined) throw new Error('E2B subprocesses carry no control channel')
    const handle = new E2bProcess(this.ctx.e2b, spec)
    this.live.add(handle)
    void handle.done.then(() => handle.waitForExit()).then(() => { this.live.delete(handle) }).catch(() => {})
    return handle
  }

  override async spawnTerminal(spec: SubprocessTerminalSpawnSpec): Promise<SubprocessTerminalHandle> {
    this.lifetime.signal.throwIfAborted()
    const signal = spec.signal === undefined ? this.lifetime.signal : AbortSignal.any([spec.signal, this.lifetime.signal])
    signal.throwIfAborted()
    const allocation = this.createTerminal(spec, signal)
    this.terminalAllocations.add(allocation)
    try { return await allocation } finally { this.terminalAllocations.delete(allocation) }
  }

  private async createTerminal(spec: SubprocessTerminalSpawnSpec, signal: AbortSignal): Promise<SubprocessTerminalHandle> {
    const e2b = this.ctx.e2b
    const sandbox = e2b.connection()
    const output = new PassThrough()
    output.on('error', () => {})
    const handle = await e2b.bounded(
      sandbox.pty.create({
        cols: spec.cols > 0 ? spec.cols : 80,
        rows: spec.rows > 0 ? spec.rows : 24,
        cwd: spec.cwd,
        ...(spec.env === undefined
          ? { envs: { TERM: spec.terminalType } }
          : { envs: { ...spec.env, TERM: spec.env['TERM'] ?? spec.terminalType } }),
        timeoutMs: e2b.requestTimeoutMs,
        requestTimeoutMs: e2b.requestTimeoutMs,
        signal,
        onData: (data: Uint8Array) => { if (!output.destroyed) output.write(Buffer.from(data)) },
      }),
      signal,
    )
    signal.throwIfAborted()
    // The SDK always starts `/bin/bash -i -l`; a non-shell argv is delivered
    // as the first input line so the requested command still runs.
    if (!isShellArgv(spec.argv)) {
      await sandbox.pty.sendInput(handle.pid, Buffer.from(`${quoteArgv(spec.argv)}\n`, 'utf-8')).catch(() => {})
      signal.throwIfAborted()
    }
    const pid = handle.pid
    let closing: Promise<void> | undefined
    const exited = Promise.withResolvers<SubprocessOutcome>()
    void exited.promise.catch(() => {})
    const stop = async (): Promise<void> => {
      try {
        const exitCode = (await handle.wait()).exitCode
        exited.resolve({ exitCode, signal: null })
      } catch (error) {
        const code = commandExitCode(error)
        if (code === undefined) exited.reject(error instanceof Error ? error : new Error(String(error)))
        else exited.resolve({ exitCode: code, signal: null })
      } finally {
        output.end()
        await handle.disconnect().catch(() => {})
      }
    }
    void stop()
    const terminal: SubprocessTerminalHandle = {
      pid,
      output,
      done: exited.promise,
      write: async (data) => { await sandbox.pty.sendInput(pid, Buffer.from(data, 'utf-8')) },
      resize: async (cols, rows) => { await sandbox.pty.resize(pid, { cols, rows }) },
      inspectForeground: async () => undefined,
      signalForeground: async (terminalSignal: SubprocessTerminalSignal) => {
        // No foreground-group API exists on E2B ptys: interrupt keys travel as
        // input, terminal signals end the session. The pid stands in for the group id.
        if (terminalSignal === 'SIGINT') await sandbox.pty.sendInput(pid, new Uint8Array([0x03]))
        else if (terminalSignal === 'SIGTSTP') await sandbox.pty.sendInput(pid, new Uint8Array([0x1a]))
        else await sandbox.pty.kill(pid)
        return pid
      },
      terminate: () => {
        closing ??= sandbox.pty.kill(pid).then(() => {
          output.destroy()
          signal.removeEventListener('abort', abort)
          this.terminals.delete(terminal)
        }).catch((error: unknown) => { closing = undefined; throw error })
        return closing
      },
    }
    const abort = (): void => { void terminal.terminate().catch(() => { void e2b.dispose().catch(() => {}) }) }
    signal.addEventListener('abort', abort, { once: true })
    this.terminals.add(terminal)
    return terminal
  }
}

/**
 * Whether argv already selects an interactive shell (the only thing
 * `pty.create` starts natively).
 * @param argv - the requested terminal argv.
 * @returns true for empty, `sh`, `bash`, or absolute shell paths.
 */
function isShellArgv(argv: readonly string[]): boolean {
  if (argv.length === 0) return true
  const program = argv[0].split('/').pop() ?? ''
  return program === 'sh' || program === 'bash' || program === 'zsh' || program === 'fish';
}

/** Single-quote one shell word for lookup probes. */
function quoted(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

export default E2bSubprocessRuntime
