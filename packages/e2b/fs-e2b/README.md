---
description: "Filesystem provider inside the shared E2B cloud sandbox."
kind: "package-reference"
---

# @deepseek-ai/dsh-fs-e2b

> Bilingual counterpart pending (`dsh-translate-docs` on request).

## Summary

`dsh-fs-e2b` provides `ctx.fs` inside the shared E2B sandbox. File tools read and mutate the same files that E2B Bash, terminals, and language servers see. Identity is the canonical absolute sandbox path, versions are `ino|size|mtime` tokens, and every byte transfer goes through `commands.run` with base64 framing plus POSIX coreutils, so the provider depends only on the stable command surface.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount this provider with [`dsh-e2b`](../e2b/README.md); use its paired E2B subprocess and sandbox providers for execution. This provider has no configuration fields: connection identity and the default workspace belong to `dsh-e2b`. Per-call sandbox policy is ignored like the bare local backend — the isolation boundary is the sandbox itself.

-----

<a id="model-experience"></a>
## Model Experience

Paths are absolute sandbox paths. No E2B concept leaks into tool schemas or results; failures carry the shared `FS_*` codes.

-----

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- Guarded writes are check-then-publish over network round-trips (best-effort, documented at the call site), not a single-host atomic section.
- Alias-stable identity holds via `symlinkTarget` chasing; missing targets resolve by spelling until creation.
- Call shapes verified against `e2b@2.51.0` sources by audit; re-verify on every SDK bump.
