# E2B Security

[English](security.md) | 中文

E2B 执行的边界、凭证与故障处理。不变量：发往 E2B 的操作绝不能触及宿主，宿主路径绝不能泄漏进沙箱。

## Boundaries

- 沙箱即边界：每次调用背后都是 Firecracker 隔离，`sandbox-e2b` 如实报告，不虚构世界内拒绝。
- 远端路径保持不透明（`FsTargetKey`）；`processPath` 拼写沙箱世界；`contains` 只比较沙箱拼写。
- 宿主环境绝不混入沙箱执行（宿主 PATH 会毒化查找）；显式 spec 条目按名替换。
- `argv` 经一次 POSIX 引用（`quoteArgv`）；模型工具绝不亲手给 SDK 递 shell 字符串。

## Credentials

- `E2B_API_KEY` 走 credentials seam，经环境到达；绝不提交，也绝不隐式转交程序环境。
- 设置区密钥表单：空即保留，粘贴校验，按引用删除。

## Failures

- 连接丢失只使在途操作失效，不重放：未知结果如实报告，绝不盲目重执行。
- 超时界定传输，不界定进程：超限只抛错而远端命令可能还活着，因此取消要显式杀死。
- 缺失凭证、不支持的 envd 版本、缺席的控制通道，都在最早可判定点大声失败。
