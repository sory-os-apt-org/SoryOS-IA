# E2B Cloud Execution

English | [中文](e2b.zh.md)

The E2B cloud-execution subsystem runs shell commands, file tools, and terminals inside a managed E2B sandbox instead of the operator's machine. [dsh-e2b](../../packages/e2b/e2b) owns one non-reconnecting sandbox session per API key; [dsh-subprocess-e2b](../../packages/e2b/subprocess-e2b), [dsh-fs-e2b](../../packages/e2b/fs-e2b), [dsh-sandbox-e2b](../../packages/e2b/sandbox-e2b), and the terminal provider mount the standard capability seams over it, so agents keep one interface across worlds. Local is the default composition; cloud arrives through the `e2b-cloud` overlay patch. Verified against `e2b@2.51.0` typings; re-verify on every SDK bump.

Source: [`packages/e2b/e2b/src/index.ts`](../../packages/e2b/e2b/src/index.ts)

## Deployment configuration

```ts type-equiv
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
```

## World vocabulary

```ts type-equiv
/** Where one session's tools execute. */
export type ExecutionWorld = 'local' | 'e2b-cloud'
```

The world is a composition fact: the mounted `e2b` service selects `e2b-cloud`, its absence means `local`. The connection announces `dsh: execution-world: e2b-cloud (workspace …)` on stderr at readiness; the `dsh-execution-target` plugin declares the world once per world per turn as a durable plugin message. The Settings Execution section persists the default for later sessions under the `execution-target` namespace, and the ready frame carries the live world to the browser header badge. The default never switches a running session.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxe2b--e2bconnection"></a>

### `ctx.e2b` — `E2bConnection`

One non-reconnecting E2B sandbox session; loss invalidates all active operations.

```ts cordis-catalog
/**
 * The live sandbox for provider calls; throws before readiness or after failure.
 * Providers must not cache this across `dispose()`.
 * @returns the connected E2B sandbox.
 */
connection(): Sandbox

/**
 * Race an operation against the administrative deadline plus caller cancellation.
 * Cancellation never replays an ambiguous mutation.
 * @param operation - the in-flight SDK promise.
 * @param signal - caller cancellation, which does not undo completed remote effects.
 * @returns the operation result.
 */
async bounded<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T>

/** Tear down the sandbox, invalidating every in-flight provider operation. */
dispose(): Promise<void>

/**
 * Public URL of one sandbox port for port-forwarded previews (e.g. a dev
 * server the agent started). The URL is deployment data for the operator,
 * never a model argument.
 * @param port - the sandbox port to expose.
 * @returns the public host URL serving that port.
 */
getHost(port: number): string

/**
 * Pause the sandbox, keeping memory when asked so resume restores processes.
 * @param keepMemory - snapshot memory as well as the filesystem.
 * @returns true when the sandbox paused.
 */
async pause(keepMemory: boolean = false): Promise<boolean>

/**
 * Snapshot the sandbox; the id doubles as a template id for fast clones
 * (e.g. a prebuilt Rust toolchain environment).
 * @param name - optional snapshot name (reuses the template name when set).
 * @returns the snapshot identity.
 */
async createSnapshot(name?: string): Promise<SnapshotInfo>

/**
 * Sandbox facts (template, state, resources) for operators and diagnostics.
 * @returns the sandbox info record.
 */
async getInfo(): Promise<SandboxInfo>
```

Source: [`packages/e2b/e2b/src/index.ts`](../../packages/e2b/e2b/src/index.ts)
<!-- END GENERATED cordis-surface -->
