# E2B Terminal / PTY

[English](terminal.md) | 中文

终端如何在两世界保持一致、同时跑在 E2B 沙箱内。消费者（`tool-terminal`、`terminal-bash`、web 标签页）永远只看到 `ctx.terminals` 与 `SubprocessTerminalHandle`；背后的提供方是组合项。

## Mapping

| Handle | E2B surface |
|---|---|
| allocation | `pty.create({ cols, rows, cwd, envs, onData })`（恒为 `/bin/bash -i -l`） |
| `output` | `onData` bytes 进入共享流 |
| `write` | `pty.sendInput(pid, bytes)` |
| `resize` | `pty.resize(pid, { cols, rows })` |
| non-shell argv | 作为首个输入行投递（有文档的 shell 包装） |
| `TERM` | 经 `envs` 透传（SDK 只在缺席时给默认） |
| `inspectForeground` | 不可用：返回 `undefined`（无前台组 API） |
| `signalForeground` | `SIGINT`/`SIGTSTP` 作为输入键传递；其他信号结束会话 |
| `done` | `CommandHandle.wait()` 加 `disconnect()`；自然退出时解决 |
| `terminate` | `pty.kill(pid)` |

## UI sameness

终端 UI 按构造与提供方无关：本地与云端运行是同一工具、同一标签页、同一持久 shell。变的只是底下的执行世界。
