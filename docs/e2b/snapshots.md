# E2B Snapshots and Templates

English | [中文](snapshots.zh.md)

Fast, prebuilt cloud environments (the Rust case first). Snapshots and template builds are externalized API calls, never reimplemented logic.

## Primitives

| Primitive | Surface | Use |
|---|---|---|
| `createSnapshot` | `sandbox.createSnapshot({ name })` | Freeze this sandbox as a reusable template id |
| `pause` | `sandbox.pause({ keepMemory })` | Suspend with memory (resume restores processes) or filesystem-only |
| `fork` | `sandbox.fork({ count })` | Clone running work from one snapshot |
| `Template.build` | template builder (`fromImage`, `aptInstall`, `runCmd`, `setEnvs`…) | Bake toolchains once, boot in seconds after |

## Rust prebuild (priority case)

```text
Rust Base Template
├── Rust toolchain + Cargo + rustfmt + clippy
└── warmed registry cache
    snapshot
      ↓
  new sandbox per task
      ↓
cargo check / build / test / run
```

The agent loop stays unchanged: create files, run Cargo, receive errors, fix with the model, rerun. Only the world beneath is a seconds-old clone instead of a cold machine.

## Connection wrappers

`E2bConnection` exposes `pause()`, `createSnapshot()`, `getHost()`, and `getInfo()` as thin operator wrappers; providers never call them mid-turn.
