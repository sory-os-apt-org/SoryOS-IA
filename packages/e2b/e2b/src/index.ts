/**
 * E2B cloud-sandbox connection owner for one API-keyed sandbox and its bounded
 * command/files/pty surface.
 *
 * Stage-1 scope: filesystem, subprocess, and terminal traffic only. There is no
 * PTC control channel here (E2B exposes no extra descriptor transport), and the
 * provider layer — not this connection — owns tail bounding and spill files.
 *
 * Verified against `e2b@2.51.0` typings by source audit
 * (`extraire-fonctionnalité-code/E2B/packages/js-sdk/src`); re-verify on every
 * SDK bump. No helper binary is installed in the sandbox and no heartbeat
 * runs: the server-side `timeoutMs` owns sandbox lifetime.
 * @module @deepseek-ai/dsh-e2b
 */

import { Context, Service } from '@deepseek-ai/cordis'
import schema from '@deepseek-ai/schemastery'
import { Sandbox, type SandboxInfo, type SnapshotInfo } from 'e2b'
import { z } from 'zod'

/** Deployment-owned E2B identity and sandbox tuning; no model argument selects these values. */
export interface Config {
  /** E2B API key. Never commit it: keep it in an untracked patch overlay or environment-fed config. */
  apiKey: string
  /** Sandbox template to create from; omit for the E2B default. */
  template?: string
  /** Absolute working directory inside the sandbox created at readiness. */
  workspace?: string
  /** Sandbox lifetime in milliseconds from creation. */
  sandboxTimeoutMs?: number
  /** Administrative-request deadline in milliseconds, at most 2,147,483,647. */
  requestTimeoutMs?: number
}

declare module '@deepseek-ai/cordis' {
  interface Context { e2b: E2bConnection }
}

/** Quoted POSIX argv joined for `commands.run`; E2B executes a command string, never raw argv. */
export function quoteArgv(argv: readonly string[]): string {
  if (argv.length === 0) throw new Error('E2B execution requires a non-empty argv')
  return argv.map(arg => `'${arg.replaceAll("'", "'\\''")}'`).join(' ')
}

/** One non-reconnecting E2B sandbox session; loss invalidates all active operations. */
export class E2bConnection extends Service {
  static Config: schema<Config> = schema.object({
    apiKey: schema.string().required(),
    template: schema.string(),
    workspace: schema.string().default('/home/user/workspace'),
    sandboxTimeoutMs: schema.number().default(300_000),
    requestTimeoutMs: schema.number().default(30_000),
  })

  /** Verified sandbox coordinates; callers must await this before launch. */
  readonly ready: Promise<{ workspace: string }>
  private readonly config: Required<Config>
  private sandbox: Sandbox | undefined
  private failure: Error | undefined
  private closed = false
  private disposal: Promise<void> | undefined
  private readonly lifetime = new AbortController()

  constructor(ctx: Context, config: Config) {
    super(ctx, 'e2b')
    this.config = z.object({
      apiKey: z.string().min(1),
      template: z.string().min(1).optional(),
      workspace: z.string().startsWith('/'),
      sandboxTimeoutMs: z.number().int().positive().max(2_147_483_647),
      requestTimeoutMs: z.number().int().positive().max(2_147_483_647),
    }).parse(config) as Required<Config>
    this.ready = this.start()
    // Startup uses SDK I/O and local validation; a failed start poisons later calls.
    void this.ready.catch((error: unknown) => { this.fail(error as Error) })
    ctx.effect(() => () => this.dispose())
  }

  /** Hold plugin readiness until the sandbox is reserved and the workspace exists. */
  async [Service.init](): Promise<void> { await this.ready }

  /**
   * Administrative-request deadline for providers to forward into SDK calls
   * (`requestTimeoutMs`/`signal` per call), instead of racing promises while
   * the SDK stream continues behind them.
   * @returns the configured deadline in milliseconds.
   */
  get requestTimeoutMs(): number {
    return this.config.requestTimeoutMs
  }

  /**
   * One-line execution-world banner on stderr, in the `dsh:` diagnostic
   * dialect the headless runner already uses there. This is how an operator
   * tells cloud from local at a glance; `--json` keeps stdout machine-clean
   * because the banner never touches it.
   * @param workspace - the reserved sandbox working directory.
   */
  private announce(workspace: string): void {
    process.stderr.write(`dsh: execution-world: e2b-cloud (workspace ${workspace})\n`)
  }

  /**
   * The live sandbox for provider calls; throws before readiness or after failure.
   * Providers must not cache this across `dispose()`.
   * @returns the connected E2B sandbox.
   */
  connection(): Sandbox {
    if (this.sandbox === undefined || this.failure !== undefined) {
      throw this.failure ?? new Error('E2B sandbox is not ready')
    }
    return this.sandbox
  }

  /**
   * Race an operation against the administrative deadline plus caller cancellation.
   * Cancellation never replays an ambiguous mutation.
   * @param operation - the in-flight SDK promise.
   * @param signal - caller cancellation, which does not undo completed remote effects.
   * @returns the operation result.
   */
  async bounded<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
    this.assertOpen()
    const timeout = AbortSignal.timeout(this.config.requestTimeoutMs)
    const combined = signal === undefined ? timeout : AbortSignal.any([signal, timeout])
    combined.throwIfAborted()
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- The abort reason is the contract.
        combined.addEventListener('abort', () => { reject(combined.reason) }, { once: true })
      }),
    ])
  }

  /** Tear down the sandbox, invalidating every in-flight provider operation. */
  dispose(): Promise<void> {
    this.disposal ??= this.disposeOnce()
    return this.disposal
  }

  /**
   * Public URL of one sandbox port for port-forwarded previews (e.g. a dev
   * server the agent started). The URL is deployment data for the operator,
   * never a model argument.
   * @param port - the sandbox port to expose.
   * @returns the public host URL serving that port.
   */
  getHost(port: number): string {
    return this.connection().getHost(port)
  }

  /**
   * Pause the sandbox, keeping memory when asked so resume restores processes.
   * @param keepMemory - snapshot memory as well as the filesystem.
   * @returns true when the sandbox paused.
   */
  async pause(keepMemory: boolean = false): Promise<boolean> {
    return this.connection().pause({ keepMemory })
  }

  /**
   * Snapshot the sandbox; the id doubles as a template id for fast clones
   * (e.g. a prebuilt Rust toolchain environment).
   * @param name - optional snapshot name (reuses the template name when set).
   * @returns the snapshot identity.
   */
  async createSnapshot(name?: string): Promise<SnapshotInfo> {
    const sandbox = this.connection()
    return sandbox.createSnapshot(name === undefined ? {} : { name })
  }

  /**
   * Sandbox facts (template, state, resources) for operators and diagnostics.
   * @returns the sandbox info record.
   */
  async getInfo(): Promise<SandboxInfo> {
    return this.connection().getInfo()
  }

  private async disposeOnce(): Promise<void> {
    this.closed = true
    this.lifetime.abort(new Error('E2B connection is closing'))
    const sandbox = this.sandbox
    this.sandbox = undefined
    await sandbox?.kill().catch(() => {})
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('E2B connection is closed')
    if (this.failure !== undefined) throw this.failure
  }

  private fail(error: Error): void {
    if (this.failure !== undefined) return
    this.failure = error
    this.lifetime.abort(error)
    void this.disposeOnce().catch(() => {})
  }

  private async start(): Promise<{ workspace: string }> {
    const sandbox = await Sandbox.create({
      apiKey: this.config.apiKey,
      template: this.config.template,
      timeoutMs: this.config.sandboxTimeoutMs,
    })
    if (this.closed) {
      await sandbox.kill().catch(() => {})
      throw new Error('E2B connection closed before startup')
    }
    this.sandbox = sandbox
    // The workspace is ordinary sandbox state created once, before publication.
    await sandbox.files.makeDir(this.config.workspace)
    this.announce(this.config.workspace)
    return { workspace: this.config.workspace }
  }
}

export default E2bConnection
