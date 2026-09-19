# E2B Process Execution

[English](process.md) | 中文

`ctx.subprocess` 在 E2B 沙箱内的服务方式（`packages/e2b/subprocess-e2b/`）。seam 合同在 `packages/subprocess/subprocess/`；这里只描述映射。

## Mapping

| Seam | E2B surface |
|---|---|
| `spawn` | `commands.run` 加 `background: true`（恒为 `/bin/bash -l -c`）；同步句柄、异步启动 |
| `done` | `CommandHandle.wait()`；非零退出经携带 exit 的拒绝转为解决（绝不拒绝） |
| `terminate` / abort | `CommandHandle.kill()`（仅 SIGKILL）；启动前 terminate 在发布后落地，绝不遗留孤儿 |
| stdin | 真 stdin：`stdin: true` + 启动前缓冲输入 + 存活 `sendStdin` + EOF 时 `closeStdin`（envd 0.5.2+） |
| collection | 流式 string 回调进入共享 `OutputCollector`（有界尾部 + 安全溢出） |
| `resolveExecutable` | `command -v` / `test -x` 探针；带分隔符的相对路径大声失败 |
| `waitForExit` | 顶层命令；沙箱侧残留子孙保持在范围外 |
| `control` | 按设计缺席（不存在额外描述符传输） |

## Timeouts

`timeoutMs` 界定 RPC/流，不界定进程：超限只抛错，不杀进程。提供方把 `Config.requestTimeoutMs` 与调用者 signal 传入每个 SDK 调用，而不是在 SDK 背后 race promise。

## Limits

无自定义信号，无执行杀死超时，只收 string 输出（非 UTF-8 被替换，绝不是 bytes），`envs` 替换而非合并 —— 环境基是沙箱模板环境，宿主环境绝不混入。
