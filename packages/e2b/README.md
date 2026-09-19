---
description: "The E2B cloud-sandbox provider family: shared connection, remote filesystem, managed subprocesses and sandbox-boundary enforcement."
kind: "package-group"
---

# e2b/ — E2B cloud execution providers

> Bilingual counterpart pending (`dsh-translate-docs` on request).

## Summary

This family runs files, ordinary processes, and terminals inside one managed E2B cloud sandbox while the Harness stays local. One API-keyed E2B sandbox supplies the execution world; the paired filesystem, subprocess, and sandbox providers implement the existing `ctx.fs`, `ctx.subprocess`, and `ctx.sandbox` interfaces over it. Use it in headless or custom profiles whose consumers honor provider-owned paths. The local provider family remains the default; this family is opt-in per composition, so one user runs local while another runs cloud from the same checkout.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

<a id="packages"></a>
## Packages

| Package | Responsibility | Service |
|---|---|---|
| [`e2b`](e2b/README.md) | Sandbox reservation, lifecycle, and bounded transport helpers | `ctx.e2b` |
| [`fs-e2b`](fs-e2b/README.md) | Remote file identity, reads, and guarded atomic mutations | `ctx.fs` |
| [`subprocess-e2b`](subprocess-e2b/README.md) | Executable lookup, processes, bounded collection, and terminals | `ctx.subprocess` |
| [`sandbox-e2b`](sandbox-e2b/README.md) | Sandbox-boundary confinement facts | `ctx.sandbox` |

<a id="related-documentation"></a>
## Related documentation

- [E2B cloud execution proposal](../../../.agents/notes/proposed/architecture/2026-09-18-e2b-cloud-execution-providers.md) — use case, stage-1 scope, alternatives, and acceptance criteria.
- [E2B removal](../../../.agents/notes/implemented/simplification/2026-09-11-remove-e2b-providers.md) — why the previous integration was retired and the standing reintroduction conditions.
- [SSH provider family](../ssh/README.md) — the sibling remote-execution pattern this family mirrors.

<a id="dev-note"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Stage 1 excludes PTC Node control traffic (E2B exposes no extra descriptor transport), bounds all host-retained output to tail snapshots plus provider-owned spill files, and never replays a possibly executed program after connection loss. Remote capability implementations retain the shared asynchronous terminal and cancellation interfaces. Local path access must never be inferred from a remote path string.

</details>
