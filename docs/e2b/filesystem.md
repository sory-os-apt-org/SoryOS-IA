# E2B Remote Filesystem

English | [中文](filesystem.zh.md)

How `ctx.fs` is served inside the E2B sandbox (`packages/e2b/fs-e2b/`). The seam contract lives in `packages/fs/fs/`; only the mapping is described here.

## Mapping

| Seam | E2B surface |
|---|---|
| `resolve` | Spelling normalization plus `symlinkTarget` chasing (40-hop guard); missing targets keep spelling |
| `stat` / `lstat` | `files.getInfo`; `lstat` reports symlinks without following the final component |
| `readText` / `readBytes` | `files.read` text/bytes with fatal UTF-8 decode; size pre-check feeds `FS_TOO_LARGE` |
| `streamText` | `files.read` stream with single-pass fatal decode |
| `readByteRange` | Stream, skip prefix, keep the window (bounded by `length`; the SDK has no partial read) |
| `listDir` | `files.list`, stable name order, deterministic joined keys |
| `writeText` / `editText` | Guards re-stat before publish; `files.write` publishes; binary priors decline the `before` basis |
| versions | `size\|mtimeMs` from entry metadata |

## Safety

A remote path is never interpreted as local: `targetKey` stays opaque, `processPath` spells the sandbox world, and `contains` compares sandbox spellings. Per-call sandbox policy is ignored like the bare local backend because the isolation boundary is the sandbox itself.

## Limits

Guarded writes are check-then-publish over network round-trips (best-effort). No `chmod`, partial read, glob, or server copy exists in the SDK; consumers keep their current semantics.
