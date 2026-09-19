---
description: "面向部署组合 POSIX 文件、进程与沙箱提供方的 E2B 云沙箱连接配置与沙箱生命周期。"
kind: "package-reference"
---

# @deepseek-ai/dsh-e2b

[English](README.md) | 中文

## Summary

`dsh-e2b` 为一次 Harness 组合预留一个 API 密钥限定的 E2B 云沙箱。配套的文件系统、子进程与沙箱提供方共享该沙箱；Harness 保留模型传输、凭证与会话持久化。沙箱在就绪时创建、释放时销毁；丢失会使每个在途操作失效，且不重放。

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

通过可选的 E2B 补丁覆盖层（见 `apps/cli/config/examples/e2b-cloud/`）将本服务与 [`fs-e2b`](../fs-e2b/README.zh.md)、[`subprocess-e2b`](../subprocess-e2b/README.zh.md)、[`sandbox-e2b`](../sandbox-e2b/README.zh.md) 一起组合。宿主运行 Harness；E2B 沙箱提供文件与进程。绝不提交 `apiKey`：将其放在未跟踪的 `cordis.patch.yml` 或等效本地覆盖层中。

| Field | Default | Meaning |
|---|---|---|
| `apiKey` | required | E2B API 密钥；缺失或为空则在加载时大声失败 |
| `template` | omitted | 沙箱模板 id；省略则使用 E2B 默认 |
| `workspace` | `/home/user/workspace` | 就绪时在沙箱内创建的绝对工作目录 |
| `sandboxTimeoutMs` | `300000` | 自创建起的沙箱存活毫秒数 |
| `requestTimeoutMs` | `30000` | 管理请求期限毫秒数，至多 2,147,483,647 |

`quoteArgv()` 是 `commands.run` 命令字符串唯一的 POSIX 引用步骤；提供方绝不以其他方式内插 argv。

-----

<a id="model-experience"></a>
## Model Experience

无面向模型的界面。连接标识、模板选择与超时均为部署配置，绝不是模型参数。失败或过期的沙箱以提供方 I/O 错误的形式到达工具，绝不是可重试的模型决策。就绪时连接写一行 stderr —— `dsh: execution-world: e2b-cloud (workspace …)` —— 让操作者看到运行的是哪个世界；本地运行不打印该行。

-----

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- 无 PTC Node 控制通道：E2B 不提供额外描述符传输，因此 `control` 句柄保持缺席，PTC 运行时暂不能挂载于此。
- 前台 `commands.run` 结果的 SDK 内部全量输出缓冲不受提供方界定；提供方以后台命令加有界尾部与溢出文件应对，消费者超时在专用流设计落地前界定失控输出。
- 第一阶段 `apiKey` 为普通 Config 字段；向 `ctx.credentials` seam 的迁移是后续工作。
- 调用形态已按审计对 `e2b@2.51.0` 源码核对；每次 SDK 升级都要重新核对（lockfile 锁定确切版本）。
