# E2B Integration Architecture

[English](architecture.md) | 中文

SoryOS-IA 中 E2B 云执行集成的参考地图。大脑仍是 SoryOS-IA（agent、loop、tools）；E2B 是这些工具运行的远端计算机。决策记录见 [E2B 提案](../../.agents/notes/proposed/architecture/2026-09-18-e2b-cloud-execution-providers.zh.md)；已退役的前任见 [移除决策](../../.agents/notes/implemented/simplification/2026-09-11-remove-e2b-providers.zh.md)。

## Layering

```text
SoryOS-IA agent (reasoning, planning, tool execution)
        │ decides
        ▼
      Tools (unchanged: bash, fs, terminal, ask_user_question)
        │ capability seams, never E2B imports
        ▼
Execution world (one per composition)
        ├── Local (fs/subprocess/sandbox-local, default)
        └── E2B (`packages/e2b/`: connection + 3 providers, opt-in overlay)
                ├── Sandbox lifecycle (SDK direct)
                ├── Filesystem (`files.*` + `FsError` vocabulary)
                ├── Process (`CommandHandle`: wait→outcome, real stdin, kill)
                ├── Terminal/PTY (`pty.*` per pid, same `ctx.terminals` UI)
                ├── Ports (`getHost` wrapper, stage 2 consumer)
                └── Snapshots/templates (externalized, never reimplemented)
```

## Rules the integration follows

- 整体世界替换，绝不做 `ctx.sandbox` 后端：confinement 仅限同世界，因此 E2B 系列整体替换文件系统、子进程与沙箱，镜像 `packages/ssh/`。
- 组合时切换：覆盖层 `apps/cli/config/examples/e2b-cloud/cordis.yml` 替换行；提供方内不存在运行时 `if local/else cloud`。
- 模型可见即已记录：世界声明是持久插件消息（`packages/context/execution-target/`），仅在挂载 `ask_user_question` 时附带询问策略。
- 密钥走 credentials seam（`E2B_API_KEY`）；密钥绝不提交，也绝不隐式进入程序环境。
- 连接丢失只失效不重放：可能已执行的程序绝不盲目重跑。

## Further reading

- [extraction.md](extraction.zh.md) — 已审计的 SDK 界面与按函数动作。
- [runtime.md](runtime.zh.md) — 客户端、服务端与沙箱内各自运行什么。
- [filesystem.md](filesystem.zh.md)、[process.md](process.zh.md)、[terminal.md](terminal.zh.md) —— seam 映射。
- [security.md](security.zh.md) —— 边界、凭证与故障处理。
- [snapshots.md](snapshots.zh.md) —— 模板、快照与 Rust 预构建。
- [integration.md](integration.zh.md) —— 组合、UI 与 agent 接线。
