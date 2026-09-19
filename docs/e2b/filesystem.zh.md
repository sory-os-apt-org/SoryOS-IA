# E2B Remote Filesystem

[English](filesystem.md) | 中文

`ctx.fs` 在 E2B 沙箱内的服务方式（`packages/e2b/fs-e2b/`）。seam 合同在 `packages/fs/fs/`；这里只描述映射。

## Mapping

| Seam | E2B surface |
|---|---|
| `resolve` | 拼写规范化加 `symlinkTarget` 追踪（40 跳上限）；缺失目标保留拼写 |
| `stat` / `lstat` | `files.getInfo`；`lstat` 不跟随末组件地报告 symlink |
| `readText` / `readBytes` | `files.read` text/bytes 加 fatal UTF-8 解码；size 预检喂 `FS_TOO_LARGE` |
| `streamText` | `files.read` stream 加单遍 fatal 解码 |
| `readByteRange` | 流式跳过前缀、保留窗口（以 `length` 为界；SDK 无部分读） |
| `listDir` | `files.list`，稳定名序，确定性拼接键 |
| `writeText` / `editText` | 发布前重 stat 保护；`files.write` 发布；二进制旧文件谢绝 `before` 依据 |
| versions | 条目元数据的 `size\|mtimeMs` |

## Safety

远端路径绝不解释为本地：`targetKey` 保持不透明，`processPath` 拼写沙箱世界，`contains` 比较沙箱拼写。单次调用沙箱策略被忽略，与裸本地后端一致，因为隔离边界就是沙箱本身。

## Limits

受保护写是网络往返上的先检查后发布（最佳努力）。SDK 中没有 `chmod`、部分读、glob、服务端复制；消费者保持现有语义。
