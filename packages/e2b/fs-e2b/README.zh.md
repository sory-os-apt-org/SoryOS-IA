---
description: "共享 E2B 云沙箱内的文件系统提供方。"
kind: "package-reference"
---

# @deepseek-ai/dsh-fs-e2b

[English](README.md) | 中文

## Summary

`dsh-fs-e2b` 在共享 E2B 沙箱内提供 `ctx.fs`。文件工具读写的文件，与 E2B Bash、终端、语言服务器看到的是同一批。标识是规范绝对沙箱路径，版本是 `ino|size|mtime` 令牌，一切字节传输走 `commands.run` 加 base64 分帧与 POSIX coreutils，因此提供方只依赖稳定的命令界面，绝不依赖版本敏感的 `files.*` 辅助。

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

将本提供方与 [`dsh-e2b`](../e2b/README.zh.md) 一起挂载；执行使用其配套 E2B 子进程与沙箱提供方。本提供方没有配置字段：连接标识与默认工作区属于 `dsh-e2b`。单次调用的沙箱策略被忽略，与裸本地后端一致 —— 隔离边界就是沙箱本身。

-----

<a id="model-experience"></a>
## Model Experience

路径为绝对沙箱路径。E2B 概念不泄漏到工具 schema 或结果；失败携带共享的 `FS_*` 码。

-----

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- 受保护写是网络往返上的先检查后发布（调用处有文档说明的最佳努力），不是单宿主原子区段。
- 别名稳定标识对已存在目标成立；缺失目标在创建前按拼写解析。
- 调用形态已按审计对 `e2b@2.51.0` 源码核对；每次 SDK 升级都要重新核对。
