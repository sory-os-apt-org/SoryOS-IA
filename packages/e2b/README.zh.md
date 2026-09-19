---
description: "E2B 云沙箱提供方系列：共享连接、远端文件系统、受管子进程与沙箱边界执行。"
kind: "package-group"
---

# e2b/ — E2B 云执行提供方

[English](README.md) | 中文

## Summary

本系列让文件、普通进程与终端运行在同一个受管 E2B 云沙箱中，Harness 留在本地。一个 API 密钥限定的 E2B 沙箱提供执行世界；配套的文件系统、子进程与沙箱提供方在其上实现既有的 `ctx.fs`、`ctx.subprocess` 与 `ctx.sandbox` 接口。适用于消费者遵守提供方自有路径的 headless 或自定义画像。本地提供方系列仍是默认；本系列按组合主动选用，同一检出下一个用户跑本地，另一个用户跑云端。

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

<a id="packages"></a>
## Packages

| Package | Responsibility | Service |
|---|---|---|
| [`e2b`](e2b/README.zh.md) | 沙箱预留、生命周期与有界传输辅助 | `ctx.e2b` |
| [`fs-e2b`](fs-e2b/README.zh.md) | 远端文件标识、读取与受保护的原子变更 | `ctx.fs` |
| [`subprocess-e2b`](subprocess-e2b/README.zh.md) | 可执行文件查找、进程、有界收集与终端 | `ctx.subprocess` |
| [`sandbox-e2b`](sandbox-e2b/README.zh.md) | 沙箱边界限制事实 | `ctx.sandbox` |

<a id="related-documentation"></a>
## Related documentation

- [E2B 云执行提案](../../../.agents/notes/proposed/architecture/2026-09-18-e2b-cloud-execution-providers.zh.md) — 用例、分阶段范围、备选方案与验收标准。
- [E2B 移除决策](../../../.agents/notes/implemented/simplification/2026-09-11-remove-e2b-providers.zh.md) — 此前集成退役的原因与现行重引入条件。
- [SSH 提供方系列](../ssh/README.zh.md) — 本系列镜像的姊妹远端执行模式。

<a id="dev-note"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

第一阶段排除 PTC Node 控制流量（E2B 不提供额外描述符传输），以尾部快照加提供方自有溢出文件界定所有宿主保留输出，连接丢失后绝不重放可能已执行的程序。远端能力实现保留共享的异步终端与取消接口。绝不能从远端路径字符串推导本地路径访问。

</details>
