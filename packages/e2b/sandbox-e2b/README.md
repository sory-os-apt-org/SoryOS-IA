---
description: "Sandbox-boundary confinement facts for E2B cloud execution."
kind: "package-reference"
---

# @deepseek-ai/dsh-sandbox-e2b

> Bilingual counterpart pending (`dsh-translate-docs` on request).

## Summary

`dsh-sandbox-e2b` resolves `ctx.sandbox` confinement at the E2B sandbox boundary. Argv passes through unchanged with `full` enforcement: the sandbox's isolation from the harness host is the enforced boundary. No in-world path fence is applied, and the provider reports no denial signatures it cannot produce.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount this provider with [`dsh-e2b`](../e2b/README.md) and its paired filesystem and subprocess providers. It has no configuration fields. A missing or failed sandbox fails closed with `SANDBOX_UNAVAILABLE` instead of running unconfined.

-----

<a id="model-experience"></a>
## Model Experience

No model-facing surface. Confinement mode selection stays a deployment concern; denials never arise from this backend.

-----

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- In-sandbox path fencing (workspace containment finer than the whole sandbox) is not performed; compositions needing it must add a dedicated backend.
- Written offline; typecheck against the workspace once the network allows it.
