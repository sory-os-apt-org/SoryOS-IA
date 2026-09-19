# E2B Capability Extraction

English | [中文](extraction.zh.md)

Audited against JS SDK v2.51.0 (`extraire-fonctionnalité-code/E2B/packages/js-sdk/src`) and the official runtime (`/tmp/opencode/eb-runtime`, Go). Every conclusion below was checked against that source; paths are exact.

## Action taxonomy

REUTILISER (use the published SDK as a dependency), ADAPTER (wrap it behind house seams), REIMPLEMENTER (rewrite the logic in-repo), WRAPPER (thin operator pass-through), EXTERNALISER (call the remote service, never host the logic), NE PAS INTEGRER (out of scope or nonexistent), A ETUDIER (undecided).

## Matrix

| Function | Source / path | Language | Action | Notes |
|---|---|---|---|---|
| Sandbox create/connect/kill/timeout | js-sdk `sandbox/index.ts` | TS dep | REUTILISER | Pin `e2b@2.51.0`; server owns lifetime |
| `files.read/write/list/getInfo/exists` | js-sdk `sandbox/filesystem/` | TS dep | ADAPTER | Behind `ctx.fs` + `FsError`; symlinks via `symlinkTarget` |
| `commands.run` + `CommandHandle` | js-sdk `sandbox/commands/` | TS dep | ADAPTER | `wait()` exit mapping; real stdin; SIGKILL-only kill |
| `pty.create/sendInput/resize/kill` | js-sdk `sandbox/commands/pty.ts` | TS dep | ADAPTER | Bytes only; `/bin/bash -i -l` fixed |
| Ports `getHost` | js-sdk `sandbox/index.ts:529` | TS dep | WRAPPER | Operator data, stage 2 consumer |
| Snapshots/pause/fork, template builds | js-sdk + control-plane | API | EXTERNALISER | Never reimplement Firecracker/COW resume |
| envd protocol, isolation, placement, auth | runtime `packages/envd`, `orchestrator`, `auth` | Go | NE PAS INTEGRER | External service by design |
| PTC control channel, custom signals, terminal argv | — | — | NE PAS INTEGRER | Proven absent from SDK and proto |
| World declaration + ask policy | `packages/context/execution-target/` | TS | REUTILISER | Durable plugin message, no new event |
| Execution Settings UI + key form | `packages/client/ui-execution-target/` | TS | REUTILISER | Credentials seam, separate from models |
| French UI locale | `packages/client/locale/` | TS | REUTILISER | Built-in `fr`, per-key fallback to `en` |
| Trilingual docs | — | — | A ETUDIER | Pairing gate is bilingual by contract |

## Language policy

Adapter code stays TypeScript and calls the published SDK; Go/runtime layers are never rewritten. A capability is reimplemented only when no SDK surface carries it and the seam requires it.
