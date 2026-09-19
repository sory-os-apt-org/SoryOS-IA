---
description: "面向 Bash 与 LSP 消费者的受管 E2B 子进程与终端行为。"
kind: "package-reference"
---

# @deepseek-ai/dsh-subprocess-e2b

[English](README.md) | 中文

## Summary

`dsh-subprocess-e2b` 在 E2B 后台命令之上实现 `ctx.subprocess`。`spawn()` 同步返回存活句柄，预留与启动异步进行；流式回调经共享的 `OutputCollector` 只保留有界尾部（按需配安全溢出文件），`terminate()` 或 spec abort 杀死远端命令。终端把 E2B pty 挂到共享异步终端接口之后。不存在控制通道：`control` 按设计保持缺席。

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

将本提供方与 [`dsh-e2b`](../e2b/README.zh.md) 及其文件系统提供方一起挂载。本提供方没有独立部署配置。`resolveExecutable()` 检查沙箱可执行文件命名空间；完整的 spawn 请求提供沙箱 cwd、环境、流处置与清理宽限期。管道 stdin 只接受分配窗口内缓冲的输入；启动后的写入大声失败。`waitForExit()` 观察顶层命令；沙箱侧残留子孙超出可观察的受管范围。

-----

<a id="model-experience"></a>
## Model Experience

E2B 概念不泄漏到工具 schema 或结果。查找未命中抛出共享的可执行文件缺失错误；传输失败以提供方错误呈现。

-----

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- 无 `control` 通道（第一阶段排除 PTC 流量）；带 `control: 'pipe'` 的 `spawn` 大声失败。
- 前台组检查不可用：`inspectForeground()` 返回 `undefined`，`signalForeground()` 把中断映射为输入键（`SIGINT`、`SIGTSTP`）或会话杀死。
- 前台命令结果的 SDK 内部全量输出缓冲不受提供方界定；本提供方使用带有界尾部的后台命令，消费者超时在专用流设计落地前界定失控输出。
- 后台命令与 pty 调用形态已按审计对 `e2b@2.51.0` 源码核对；每次 SDK 升级都要重新核对。
