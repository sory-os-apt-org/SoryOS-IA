# E2B 云执行

[English](e2b.md) | 中文

E2B 云执行子系统在受管 E2B 沙箱（而非操作员本机）中运行 shell 命令、文件工具与终端。[dsh-e2b](../../packages/e2b/e2b) 为每个 API key 拥有一个不重连的沙箱会话；[dsh-subprocess-e2b](../../packages/e2b/subprocess-e2b)、[dsh-fs-e2b](../../packages/e2b/fs-e2b)、[dsh-sandbox-e2b](../../packages/e2b/sandbox-e2b) 与终端提供方在其上挂载标准能力接缝，因此 agent 在两个世界中共用同一接口。本地为默认组合；云端经 `e2b-cloud` overlay patch 接入。已按 `e2b@2.51.0` 类型校验；每次升级 SDK 必须重验。

Source: [`packages/e2b/e2b/src/index.ts`](../../packages/e2b/e2b/src/index.ts)

## 部署配置

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

## 世界词汇

```ts type-equiv
/** Where one session's tools execute. */
export type ExecutionWorld = 'local' | 'e2b-cloud'
```

世界是组合事实：挂载 `e2b` 服务即选 `e2b-cloud`，缺席即 `local`。连接在就绪时向 stderr 通告 `dsh: execution-world: e2b-cloud (workspace …)`；`dsh-execution-target` 插件按世界按轮次以持久插件消息声明世界。设置 Execution 区在 `execution-target` 命名空间下为后续会话持久化默认值，ready 帧把实时世界带给浏览器头徽标。默认值永不切换运行中的会话。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

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
