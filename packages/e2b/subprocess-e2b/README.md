---
description: "Managed E2B subprocess and terminal behavior for Bash and LSP consumers."
kind: "package-reference"
---

# @deepseek-ai/dsh-subprocess-e2b

> Bilingual counterpart pending (`dsh-translate-docs` on request).

## Summary

`dsh-subprocess-e2b` implements `ctx.subprocess` over E2B background commands. `spawn()` returns a live handle synchronously while reservation and launch proceed asynchronously; streaming callbacks retain bounded tails through the shared `OutputCollector` (with secure spill files when requested), and `terminate()` or the spec abort kills the remote command. Terminals mount E2B ptys behind the shared asynchronous terminal interface. There is no control channel: `control` stays absent by design.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount this provider with [`dsh-e2b`](../e2b/README.md) and its filesystem provider. It has no deployment configuration of its own. `resolveExecutable()` checks the sandbox executable namespace; fully specified spawn requests supply the sandbox cwd, environment, stream dispositions, and cleanup grace. Piped stdin accepts input buffered during allocation; writes after launch fail loudly. `waitForExit()` observes the top-level command; surviving sandbox-side grandchildren are outside the observable managed range.

-----

<a id="model-experience"></a>
## Model Experience

No E2B concept leaks into tool schemas or results. Lookup misses raise the shared executable-not-found error; transport failures surface as provider errors.

-----

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- No `control` channel (PTC traffic excluded in stage 1); `spawn` with `control: 'pipe'` fails loud.
- Foreground-group inspection is unavailable: `inspectForeground()` returns `undefined`, and `signalForeground()` maps interrupts to input keys (`SIGINT`, `SIGTSTP`) or session kill.
- SDK-internal full-output buffering for foreground command results is outside provider bounding; this provider uses background commands with bounded tails, and consumer timeouts bound runaway output until a dedicated stream design lands.
- Background-command and pty call shapes verified against `e2b@2.51.0` sources by audit; re-verify on every SDK bump.
