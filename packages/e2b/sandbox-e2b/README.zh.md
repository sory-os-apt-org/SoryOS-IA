---
description: "面向 E2B 云执行的沙箱边界限制事实。"
kind: "package-reference"
---

# @deepseek-ai/dsh-sandbox-e2b

[English](README.md) | 中文

## Summary

`dsh-sandbox-e2b` 在 E2B 沙箱边界解析 `ctx.sandbox` 限制。argv 原样通过，执行完整度为 `full`：沙箱相对 Harness 宿主的隔离就是被强制的边界。不施加世界内路径围栏，提供方也不报告它产生不出的拒绝签名。

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

将本提供方与 [`dsh-e2b`](../e2b/README.zh.md) 及其配套文件系统与子进程提供方一起挂载。它没有配置字段。沙箱缺失或失败时以 `SANDBOX_UNAVAILABLE` 关闭失败，而不是无限制运行。

-----

<a id="model-experience"></a>
## Model Experience

无面向模型的界面。限制模式选择仍是部署关心的事；拒绝绝不会来自本后端。

-----

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- 不执行沙箱内路径围栏（细于整个沙箱的工作区约束）；需要它的组合必须另加专用后端。
- 离线编写；网络恢复后先对工作区做 typecheck。
