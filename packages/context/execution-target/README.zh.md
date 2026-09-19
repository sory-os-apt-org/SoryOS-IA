---
description: "模型可见的执行世界上下文：本会话的工具在哪里运行。"
kind: "package-reference"
---

# @deepseek-ai/dsh-execution-target

[English](README.md) | 中文

## Summary

`dsh-execution-target` 告诉模型它的 shell 命令、文件工具与终端在哪里运行：本机还是 E2B 云沙箱。前置的 `agent/pre-step` 监听器按世界按轮次追加一条持久插件 `user/message`，因此该声明与其他模型输入一样可从会话日志重建。换组合恢复的会话在下一个被接纳的 step 重新声明。世界从挂载的提供方读取（`ctx.get('e2b')` 存在即云端）；插件无配置。

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

在每个需要 agent 知晓其执行世界的组合中挂载本插件（本地与 E2B 画像都要）。它没有配置字段，也没有面向模型的工具。E2B 连接未就绪时会跳过该 step 的注入，而不是让轮次失败。

-----

<a id="model-experience"></a>
## Model Experience

按世界按轮次一条 `user/message`，只用模型词汇（世界、工作目录、沙箱持久事实）。无 UI、传输或实现术语。

#### KV Cache effect

按世界按轮次一个简短前缀块；不变的轮次复用缓存。

-----

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- 声明按世界按轮次，不按 step；不支持轮次中途更换提供方。
- 离线编写；网络恢复后 REAL-composition 测试必须锁定两个世界的注入 transcript。
