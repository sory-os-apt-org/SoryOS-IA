# E2B Integration Wiring

[English](integration.md) | 中文

各部件如何组合：画像、UI 与 agent 指引。全程一个界面 —— 本地与云端只在底下不同。

## Composition

- 本地是默认：`dsh --profile headless "task"`。
- 云端只需一个覆盖层：`E2B_API_KEY=... dsh --profile headless --patch apps/cli/config/examples/e2b-cloud/cordis.yml "task"`。
- 覆盖层替换 `subprocess`、`sandbox`、`fs-sandbox` 行，重定 `sandbox-policy` 根，禁用 PTC、PTC workflow 与宿主二进制文件搜索。
- 持久云端：把同样行放进 `$DSH_HOME/cordis.patch.yml`。

## UI

- 设置区有独立的 Execution 区（本地/E2B 云端默认值加密钥表单），绝不与模型提供方混合。
- 法语 UI locale 内建，未译 key 按条回退英文。
- 终端、文件视图与工具在两世界渲染一致；按会话世界标签是第二阶段。

## Agent

- 世界声明以持久上下文按世界按轮次到达（`dsh-execution-target`，常驻挂载）。
- 测试或重命令缺所选世界、且挂载 `ask_user_question` 时，agent 先问（本地/E2B 云端）再跑；答案不符即停跑并给出重启动指引，而不明换。
- 大脑不变：推理、规划、工具仍是 SoryOS-IA；E2B 是远端计算机。
