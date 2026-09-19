# E2B Runtime Map

English | [中文](runtime.zh.md)

Client/server/sandbox split of the official E2B runtime (Go, `/tmp/opencode/eb-runtime`). SoryOS-IA only ever touches the client row.

## Client (what we call)

- Public REST: sandboxes, templates/builds, volumes, secrets (`spec/openapi.yml`).
- Edge traffic: `https://<port>-<sandboxID>.<domain>` (`packages/client-proxy/`).
- envd in-VM API on :49983 (`packages/envd/spec/`): `process/process.proto` (stdout/stderr/pty streams, SIGTERM/SIGKILL — no extra descriptors), `filesystem/filesystem.proto`, REST `/files`, `/init`, `/freeze`, `/upgrade`.
- SDK compatibility is gated server-side (`template_start_build_v2.go`).

## Server (never reimplemented)

- API control-plane (`packages/api/`): CRUD sandboxes, templates, teams, volumes, keys, secrets, webhooks; best-of-K placement; Redis holds running sandboxes, Postgres holds durable records.
- Orchestrator (`packages/orchestrator/`): one binary per node, gRPC `:5008`, template builds with hashed layers, local scheduling and reclaim.
- Auth (`packages/auth/`): `X-API-Key: e2b_*`, OIDC/admin JWT, per-sandbox traffic tokens, short-lived volume JWTs.

## In-sandbox (envd)

Early-boot agent owning processes, filesystem, PTY, port scan/forward, freeze/thaw for pause, and live upgrade with handover. Versioned (`pkg/version.go`); server and SDK gate on it (stdin close needs 0.5.2+, explicit `stdin:false` needs 0.3.0+).

## Isolation (Firecracker)

One sandbox is one Firecracker process in its cgroup plus a dedicated netns, NAT/nftables egress, cgroups v2 freeze pre-pause, memory/disk snapshots as copy-on-write diffs with lazy page restore. Template finalize bakes prefetch hints. None of this is rebuilt or bypassed by the integration.
