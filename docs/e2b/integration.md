# E2B Integration Wiring

English | [中文](integration.zh.md)

How the pieces compose: profiles, UI, and agent guidance. One interface throughout — local and cloud differ only beneath it.

## Composition

- Local is the default: `dsh --profile headless "task"`.
- Cloud is one overlay: `E2B_API_KEY=... dsh --profile headless --patch apps/cli/config/examples/e2b-cloud/cordis.yml "task"`.
- The overlay replaces the `subprocess`, `sandbox`, and `fs-sandbox` rows, re-roots `sandbox-policy`, and disables PTC, the PTC workflow, and host-binary file search.
- Persistent cloud: the same rows in `$DSH_HOME/cordis.patch.yml`.

## UI

- Settings holds a separate Execution section (Local/E2B Cloud default plus the key form), never mixed with model providers.
- The French UI locale ships built-in with per-key English fallback.
- Terminals, file views, and tools render identically in both worlds; a per-session world label is deferred stage 2.

## Agent

- The world declaration arrives as durable context once per world per turn (`dsh-execution-target`, always mounted).
- When tests or heavy commands lack a chosen world and `ask_user_question` is mounted, the agent asks (Local/E2B Cloud) before running; a mismatched answer stops the run with relaunch guidance instead of switching silently.
- The brain never changes: reasoning, planning, and tools stay SoryOS-IA; E2B is the remote computer.
