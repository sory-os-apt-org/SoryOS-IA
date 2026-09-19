# Agent Note: E2B cloud execution providers with local/cloud profile switch

Status: proposed

English | [中文](2026-09-18-e2b-cloud-execution-providers.zh.md)

## Problem

Operators on limited local machines need script, test, preview, and command execution to run somewhere with more headroom, while other operators keep everything on their own hardware. One hard-coded execution world cannot serve both: the choice of where files live and processes run belongs to the deployment, and it must be switchable per user without forking the product.
The [E2B removal](../simplification/2026-09-11-remove-e2b-providers.md) retired the previous managed-sandbox integration because the pinned SDK exposed no extra descriptor transport for PTC control traffic and retained complete stdout/stderr on the host, and it states explicit reintroduction conditions. The [POSIX SSH providers](../architecture/2026-09-11-posix-ssh-runtime.md) cover deployments that own an SSH host, but not deployments that want managed cloud sandboxes keyed by API token. No current composition offers a local/cloud switch for that second population.

## Proposal

Reintroduce E2B as a scoped provider family that mirrors the SSH family shape: one connection package plus filesystem, subprocess, and sandbox providers sharing one E2B sandbox world, with the Harness, credentials, model transport, and Session persistence staying on the host. The local/cloud switch happens at composition time, never as a runtime branch inside providers: the default profiles mount the local family, and an opt-in E2B overlay (profile or `--patch` file requiring `E2B_API_KEY`) replaces the whole execution world for that run. The first stage excludes PTC Node execution over E2B (no fd7 control channel exists there yet), bounds collected output with raw-byte tail snapshots owned by the provider, and treats connection loss as invalidation without replay of possibly executed programs.
Planned packages under a new `packages/e2b/` group are `e2b` (connection lifecycle over `ctx.e2b`), `fs-e2b` (registers on `ctx.fs`), `subprocess-e2b` (registers on `ctx.subprocess`), and `sandbox-e2b` (registers on `ctx.sandbox` with remote file-effect enforcement facts). Each provider owns path conversion, executable lookup, ordinary streams, terminal allocation, and managed cleanup for the E2B world, following the [portable execution-world decision](../architecture/2026-07-28-portable-execution-world-consumers.md); consumers keep tool semantics, policy, and presentation unchanged.

## Provider topology

The `e2b` connection package owns sandbox reservation and the server-side timeout lifecycle; no helper binary is installed in the sandbox and no heartbeat runs, because E2B requires neither. Filesystem, subprocess, and sandbox providers share that connection and describe E2B-world paths without a local/remote metadata flag. Terminal allocation, writes, foreground inspection, and signalling keep their asynchronous Promise contracts so the shared interfaces need no E2B-specific tools. E2B registers as a whole-world replacement, never as a `ctx.sandbox` backend: confinement stays same-world only, and the sandbox boundary itself (not in-world path fencing) is the enforced fact remote providers report.

## Composition and switching

Shipped profiles keep local providers as the default. An `e2b` bundle (or patch overlay) lists the four E2B rows in place of the local rows, so `dsh --profile headless` runs local while `dsh --profile headless-e2b` (or `--patch e2b.yml`) runs the same task in the cloud sandbox. Missing `E2B_API_KEY` fails loud at load; a present key never leaks into program environments. Per-session capability differences continue to use agent presets with an `isolate` realm where needed. Headless compositions adopt this arrangement first; Web workspace views with host-filesystem assumptions need their own integration before they can follow.

## Transport bounds

Collected stdout/stderr publish bounded raw-tail snapshots with whole-stream byte offsets, and the provider spills to provider-owned retained-output storage instead of accumulating unbounded host memory. Administrative RPC deadlines, consumer execution deadlines, and cleanup remain separate owners. Every stream reservation is created before its payload starts, closure is precise per channel, and cancellation never replays an ambiguous mutation.

## Alternatives considered

**Keep E2B retired and serve remote execution through SSH only.** This avoids a second remote transport and its SDK dependency, but leaves operators without an SSH host (and users who explicitly choose managed cloud sandboxes) with no supported path, which is the population this proposal serves.
**Switch execution worlds at runtime behind one provider.** A runtime `if local/else cloud` branch hides deployment choice inside `run()`, violating the explicit-resolve rule and the one-executor-per-composition invariant; profile composition already owns this switch.
**Register E2B as a `ctx.sandbox` backend.** Sandboxes confine same-world processes sharing host kernel and filesystem; a cloud sandbox replaces the filesystem, subprocess, and sandbox capabilities together, so a backend registration would misplace ownership of paths, lookup, and cleanup.
**Move the complete Harness into the cloud sandbox.** That moves model credentials, Session storage, and plugin state with execution instead of supplying remote implementations of existing capabilities; it is a separate deployment model, not a provider family.

## Acceptance criteria

A local profile and an E2B profile run the same headless task with identical model-visible output modulo execution-world paths. Missing credentials fail loud before any run. Bounded-tail, reservation-cancellation, precise-closure, and disconnect-without-replay behaviors are pinned by REAL-composition tests on source and built profiles plus a keyless recorded-session snapshot for the composition shape. Live E2B checks run against an explicitly configured disposable sandbox; keyless CI never provisions one. The removal note stays active and cross-linked as the retired realization it owns.

## Risks

The E2B SDK may still lack a suitable control transport, which would keep PTC Node execution out of scope indefinitely and cap the family at filesystem, subprocess, terminal, and LSP use. SDK output-retention behavior could force a separate authenticated stream design, turning the family into the remote-transport project the removal declined. A second remote family doubles transport, reservation, and disconnect verification obligations. Cloud execution also adds credential handling, network policy, and cost controls that local runs never need.
