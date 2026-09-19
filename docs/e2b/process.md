# E2B Process Execution

English | [中文](process.zh.md)

How `ctx.subprocess` is served in the E2B sandbox (`packages/e2b/subprocess-e2b/`). The seam contract lives in `packages/subprocess/subprocess/`; only the mapping is described here.

## Mapping

| Seam | E2B surface |
|---|---|
| `spawn` | `commands.run` with `background: true` (always `/bin/bash -l -c`); sync handle, async start |
| `done` | `CommandHandle.wait()`; nonzero exits resolve (never reject) via the exit-carrying rejection |
| `terminate` / abort | `CommandHandle.kill()` (SIGKILL only); pre-launch terminates land after publication, never orphaned |
| stdin | Real: `stdin: true` + buffered pre-launch input + live `sendStdin` + `closeStdin` on EOF (envd 0.5.2+) |
| collection | Streaming string callbacks into the shared `OutputCollector` (bounded tail + secure spill) |
| `resolveExecutable` | `command -v` / `test -x` probes; relative paths with separators fail loud |
| `waitForExit` | The top-level command; sandbox-side grandchildren stay outside the range |
| `control` | Absent by design (no extra descriptor transport exists) |

## Timeouts

`timeoutMs` bounds the RPC/stream, not the process: overrun raises, it never kills. Providers forward `Config.requestTimeoutMs` and the caller signal into every SDK call instead of racing promises behind the SDK's back.

## Limits

No custom signals, no execution-kill timeout, string-only output (non-UTF8 is replaced, never bytes), and `envs` replace rather than merge — the ambient base is the sandbox template environment, so host ambient is never merged in.
