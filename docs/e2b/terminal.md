# E2B Terminal / PTY

English | [中文](terminal.zh.md)

How terminals stay identical across worlds while running in the E2B sandbox. Consumers (`tool-terminal`, `terminal-bash`, web tabs) only ever see `ctx.terminals` and `SubprocessTerminalHandle`; the provider behind them is compositional.

## Mapping

| Handle | E2B surface |
|---|---|
| allocation | `pty.create({ cols, rows, cwd, envs, onData })` (always `/bin/bash -i -l`) |
| `output` | `onData` bytes into the shared stream |
| `write` | `pty.sendInput(pid, bytes)` |
| `resize` | `pty.resize(pid, { cols, rows })` |
| non-shell argv | Delivered as the first input line (documented shell wrapping) |
| `TERM` | Passed through `envs` (the SDK defaults it only when absent) |
| `inspectForeground` | Unavailable: returns `undefined` (no foreground-group API) |
| `signalForeground` | `SIGINT`/`SIGTSTP` travel as input keys; other signals kill the session |
| `done` | `CommandHandle.wait()` plus `disconnect()`; resolves on natural exit |
| `terminate` | `pty.kill(pid)` |

## UI sameness

The terminal UI is provider-blind by construction: same tool, same tabs, same persistent shells in local and cloud runs. Only the execution world beneath changes.
