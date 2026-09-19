# E2B Security

English | [中文](security.zh.md)

Boundaries, credentials, and failure handling for E2B execution. The invariant: an operation addressed to E2B can never touch the host, and a host path can never leak into the sandbox.

## Boundaries

- The sandbox is the boundary: Firecracker isolation stands behind every call, and `sandbox-e2b` reports it with no invented in-world denials.
- Remote paths stay opaque (`FsTargetKey`); `processPath` spells the sandbox world; `contains` compares sandbox spellings only.
- Host ambient environment is never merged into sandbox execution (host PATH would poison lookup); explicit spec entries replace by name.
- `argv` is POSIX-quoted once (`quoteArgv`); model tools never hand the SDK a shell string of their own.

## Credentials

- `E2B_API_KEY` travels the credentials seam and arrives via environment; it is never committed and never forwarded into program environments implicitly.
- The Settings key form keeps an empty field meaning keep, validates pastes, and removes by reference.

## Failures

- Connection loss invalidates pending operations without replay: an unknown outcome is reported honestly, never re-executed blindly.
- Timeouts bound transport, not processes: overrun raises while the remote command may still live, so cancellation kills explicitly.
- Missing credentials, unsupported envd versions, and absent control channels all fail loud at the earliest resolvable point.
