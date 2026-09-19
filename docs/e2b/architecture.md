# E2B Integration Architecture

English | [中文](architecture.zh.md)

Reference map for the E2B cloud-execution integration in SoryOS-IA. The brain stays SoryOS-IA (agent, loop, tools); E2B is the remote computer those tools run on. For the decision record see the [E2B proposal](../../.agents/notes/proposed/architecture/2026-09-18-e2b-cloud-execution-providers.md); for the retired predecessor see the [removal note](../../.agents/notes/implemented/simplification/2026-09-11-remove-e2b-providers.md).

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

- Whole-world replacement, never a `ctx.sandbox` backend: confinement is same-world only, so the E2B family replaces filesystem, subprocess, and sandbox together, mirroring `packages/ssh/`.
- Composition-time switching: the overlay `apps/cli/config/examples/e2b-cloud/cordis.yml` replaces rows; no runtime `if local/else cloud` exists in providers.
- Model-visible means logged: the world declaration is a durable plugin message (`packages/context/execution-target/`), and the ask policy rides it only when `ask_user_question` is mounted.
- Secrets travel the credentials seam (`E2B_API_KEY`); the key is never committed and never reaches program environments implicitly.
- Connection loss invalidates without replay: a possibly executed program is never re-run blindly.

## Further reading

- [extraction.md](extraction.md) — audited SDK surface and per-function actions.
- [runtime.md](runtime.md) — what runs client-side, server-side, and in-sandbox.
- [filesystem.md](filesystem.md), [process.md](process.md), [terminal.md](terminal.md) — seam mappings.
- [security.md](security.md) — boundaries, credentials, failure handling.
- [snapshots.md](snapshots.md) — templates, snapshots, and the Rust prebuild.
- [integration.md](integration.md) — composition, UI, and agent wiring.
