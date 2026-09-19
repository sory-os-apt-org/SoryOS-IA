# E2B Capability Extraction

[English](extraction.md) | 中文

按 JS SDK v2.51.0（`extraire-fonctionnalité-code/E2B/packages/js-sdk/src`）与官方 runtime（`/tmp/opencode/eb-runtime`，Go）审计。以下每个结论都对该源码核对过；路径精确。

## Action taxonomy

REUTILISER（作为依赖使用发布的 SDK）、ADAPTER（包在自有 seam 之后）、REIMPLEMENTER（在仓库内重写逻辑）、WRAPPER（薄操作员透传）、EXTERNALISER（调用远端服务，绝不自己承载逻辑）、NE PAS INTEGRER（超出范围或不存在）、A ETUDIER（未定）。

## Matrix

| Function | Source / path | Language | Action | Notes |
|---|---|---|---|---|
| Sandbox create/connect/kill/timeout | js-sdk `sandbox/index.ts` | TS dep | REUTILISER | 锁定 `e2b@2.51.0`；生命周期归服务端 |
| `files.read/write/list/getInfo/exists` | js-sdk `sandbox/filesystem/` | TS dep | ADAPTER | 接到 `ctx.fs` + `FsError` 之后；symlink 经 `symlinkTarget` 处理 |
| `commands.run` + `CommandHandle` | js-sdk `sandbox/commands/` | TS dep | ADAPTER | `wait()` exit 映射；真 stdin；仅 SIGKILL 的 kill |
| `pty.create/sendInput/resize/kill` | js-sdk `sandbox/commands/pty.ts` | TS dep | ADAPTER | 仅 bytes；`/bin/bash -i -l` 固定 |
| Ports `getHost` | js-sdk `sandbox/index.ts:529` | TS dep | WRAPPER | 操作员数据，第二阶段消费者 |
| Snapshots/pause/fork, template builds | js-sdk + control-plane | API | EXTERNALISER | 绝不重写 Firecracker/COW resume |
| envd protocol, isolation, placement, auth | runtime `packages/envd`、`orchestrator`、`auth` | Go | NE PAS INTEGRER | 按设计就是外部服务 |
| PTC control channel, custom signals, terminal argv | — | — | NE PAS INTEGRER | 已证实在 SDK 与 proto 中都不存在 |
| World declaration + ask policy | `packages/context/execution-target/` | TS | REUTILISER | 持久插件消息，无新事件 |
| Execution Settings UI + key form | `packages/client/ui-execution-target/` | TS | REUTILISER | Credentials seam，与 models 分离 |
| French UI locale | `packages/client/locale/` | TS | REUTILISER | 内建 `fr`，按 key 回退到 `en` |
| Trilingual docs | — | — | A ETUDIER | Pairing gate 按合同就是双语 |

## Language policy

适配器代码保持 TypeScript 并调用发布的 SDK；Go/runtime 层绝不重写。只有当 SDK 没有对应界面而 seam 又要求时，才重写一个能力。
