---
description: "执行目标设置区：本地/E2B 云端默认值与 E2B API 密钥管理，与模型提供方分离。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-execution-target

[English](README.md) | 中文

UI 文案以三种字典内联提供（`locales.ts` 中的 `en` + `zh` + `fr`）。

## Summary

Web GUI 在独立的 Execution 设置区编辑执行默认值：本地/E2B 云端单选卡加 E2B API 密钥表单（粘贴即保存，留空即保留，另有清除）。它与 Models 页并列、语言一致，但读写完全不交的界面 —— `execution-target` 设置命名空间与 `E2B_API_KEY` 凭证引用 —— 模型提供方与执行提供方绝不混合。默认值只对之后的会话生效；运行中与历史会话保持原世界。

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

将本插件与 settings 包一起挂载；Execution 区随后以 `settings.section` 顺序 20 与自有 `settings.execution` 字典命名空间注册。Host 侧在 settings 服务组合后注册持久 `execution-target` 设置区（默认为 `local`）；缺少它时该区显示不可用，默认值写入一律被拒。草稿（所选世界、密钥输入）留在组件本地；已存默认值走带修订 fence 的绑定设置 scope，密钥走 credentials seam。未打开的区绝不拉取；推送的设置/凭证失效与连接重置只在首次加载后重拉。

-----

<a id="model-experience"></a>
## Model Experience

无，作为只注册浏览器侧界面的 UI 插件层，不注册任何面向模型的东西。

#### KV Cache effect

无；本包既不组装也不发送提供方请求。

-----

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- 默认值只对之后的会话生效；切换运行中会话的世界需要宿主侧执行目标组合工作，那是另一个阶段。
- 暂无按会话 header 标签：本区不显示当前会话运行在哪个世界。
- 离线编写；网络恢复后 `test:gui` 与 web bundle 构建必须确认三个注册界面。
