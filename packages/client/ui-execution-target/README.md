---
description: "Execution-target settings section: the Local vs E2B Cloud default plus E2B API key management, separate from model providers."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-execution-target

> UI copy ships inline in three dictionaries (`en` + `zh` + `fr` in `locales.ts`); the `.zh.md` prose counterpart is pending (`dsh-translate-docs` on request).

## Summary

The Web GUI edits the execution default in its own Execution settings section: Local vs E2B Cloud radio cards plus the E2B API key form (paste to store, empty means keep, remove to clear). It lives beside the Models page and shares its card language, but reads and writes a disjoint surface — the `execution-target` settings namespace and the `E2B_API_KEY` credential reference — so model providers and execution providers never mix. The default applies to later sessions; running and historical sessions keep their world.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount this plugin alongside the settings packages; the Execution section then registers at `settings.section` order 20 with its own `settings.execution` dictionary namespace. The Host half registers the durable `execution-target` settings section (defaulting to `local`) once a settings service is composed; without it the section reads unavailable and every default write is refused. Drafts (picked world, key input) stay component-local; the stored default rides the bound settings scope (revision fencing included) and the key rides the credentials seam. An unopened section never fetches; pushed settings/credential invalidations and connection resets refetch only after the first load.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser-side UI plugin layer that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

-----

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- The default applies to later sessions only; switching a running session's world needs the host-side execution-target composition work, which is a separate stage.
- No per-session header label yet: the section does not show which world the current session runs in.
- Written offline; `test:gui` plus the web bundle build must confirm the three registration surfaces once the network allows it.
