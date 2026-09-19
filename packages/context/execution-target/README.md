---
description: "Model-visible execution-world context: where this session's tools run."
kind: "package-reference"
---

# @deepseek-ai/dsh-execution-target

> Bilingual prose counterpart pending (`dsh-translate-docs` on request).

## Summary

`dsh-execution-target` tells the model where its shell commands, file tools, and terminals run: the local machine or the E2B cloud sandbox. A prepended `agent/pre-step` listener appends one durable plugin `user/message` per world per turn, so the declaration is reconstructable from the session log like every other model input. A session resumed under the other composition re-declares on its next admitted step. The world is read from the mounted providers (`ctx.get('e2b')` present means cloud); the plugin carries no configuration.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount this plugin in every composition whose agents should know their execution world (both local and E2B profiles). It has no configuration fields and no model-facing tools. An unready E2B connection skips the injection for that step instead of failing the turn.

-----

<a id="model-experience"></a>
## Model Experience

One `user/message` per world per turn, in model vocabulary only (world, working directory, sandbox persistence facts). No UI, transport, or implementation terms.

#### KV Cache effect

One short prefix block per world per turn; unchanged turns reuse the cache.

-----

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- The declaration is per world per turn, not per step; mid-turn provider changes are not a supported composition.
- Written offline; REAL-composition tests must pin the injected transcript once the network allows it.
