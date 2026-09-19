---
description: "E2B cloud-sandbox connection configuration and sandbox lifecycle for deployments composing E2B file, process and sandbox providers."
kind: "package-reference"
---

# @deepseek-ai/dsh-e2b

> Bilingual counterpart pending (`dsh-translate-docs` on request).

## Summary

`dsh-e2b` reserves one API-keyed E2B cloud sandbox for a Harness composition. The paired filesystem, subprocess, and sandbox providers share that sandbox; the Harness keeps model transport, credentials, and Session storage. The sandbox is created at readiness and killed at disposal; loss invalidates every in-flight operation without replay.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Compose this service with [`fs-e2b`](../fs-e2b/README.md), [`subprocess-e2b`](../subprocess-e2b/README.md), and [`sandbox-e2b`](../sandbox-e2b/README.md) through the opt-in E2B patch overlay (see `apps/cli/config/examples/e2b-cloud/`). The host runs the Harness; the E2B sandbox supplies files and processes. Never commit `apiKey`: keep it in an untracked `cordis.patch.yml` or equivalent local overlay.

| Field | Default | Meaning |
|---|---|---|
| `apiKey` | required | E2B API key; missing or empty fails loud at load |
| `template` | omitted | Sandbox template id; omit for the E2B default |
| `workspace` | `/home/user/workspace` | Absolute working directory created inside the sandbox at readiness |
| `sandboxTimeoutMs` | `300000` | Sandbox lifetime in ms from creation |
| `requestTimeoutMs` | `30000` | Administrative-request deadline in ms, at most 2,147,483,647 |

`quoteArgv()` is the one POSIX quoting step for `commands.run` command strings; providers never interpolate argv any other way.

-----

<a id="model-experience"></a>
## Model Experience

No model-facing surface. Connection identity, template choice, and timeouts are deployment configuration, never model arguments. A failed or expired sandbox surfaces to tools as a provider I/O error, never as a retryable model decision. At readiness the connection writes one stderr line — `dsh: execution-world: e2b-cloud (workspace …)` — so the operator sees which world runs; local runs print no such line.

-----

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- No PTC Node control channel: E2B exposes no extra descriptor transport, so `control` handles stay absent and PTC runtimes cannot mount here yet.
- SDK-internal full-output buffering for foreground `commands.run` results is outside provider bounding; providers use background commands with bounded tails plus spill files, and consumer timeouts bound runaway output until a dedicated stream design lands.
- `apiKey` is a plain Config field in stage 1; migration to the `ctx.credentials` seam is deferred follow-up.
- Call shapes verified against `e2b@2.51.0` sources by audit; re-verify on every SDK bump (the lockfile pins the exact version).
