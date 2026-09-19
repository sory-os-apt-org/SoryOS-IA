# E2B Runtime Map

[English](runtime.md) | 中文

官方 E2B runtime（Go，`/tmp/opencode/eb-runtime`）的客户端/服务端/沙箱内划分。SoryOS-IA 只接触客户端一行。

## Client (what we call)

- 公开 REST：sandboxes、templates/builds、volumes、secrets（`spec/openapi.yml`）。
- Edge 流量：`https://<port>-<sandboxID>.<domain>`（`packages/client-proxy/`）。
- 虚机内 envd API :49983（`packages/envd/spec/`）：`process/process.proto`（stdout/stderr/pty 流、SIGTERM/SIGKILL —— 无额外描述符）、`filesystem/filesystem.proto`、REST `/files`、`/init`、`/freeze`、`/upgrade`。
- SDK 兼容性在服务端设门（`template_start_build_v2.go`）。

## Server (never reimplemented)

- API control-plane（`packages/api/`）：sandboxes CRUD、templates、teams、volumes、keys、secrets、webhooks；best-of-K 放置；Redis 存运行沙箱，Postgres 存持久记录。
- Orchestrator（`packages/orchestrator/`）：每节点单二进制，gRPC `:5008`，哈希分层模板构建，本地调度与回收。
- Auth（`packages/auth/`）：`X-API-Key: e2b_*`、OIDC/admin JWT、按沙箱流量令牌、短时 volume JWT。

## In-sandbox (envd)

早期启动的 agent，拥有进程、文件系统、PTY、端口扫描/转发、暂停用 freeze/thaw、带 handover 的热升级。带版本（`pkg/version.go`）；服务端与 SDK 按版本设门（stdin close 需 0.5.2+，显式 `stdin:false` 需 0.3.0+）。

## Isolation (Firecracker)

一个沙箱就是一个 Firecracker 进程（自有 cgroup）加专用 netns、NAT/nftables 出口、cgroups v2 暂停前冻结、内存/磁盘快照为写时复制 diff 加懒页恢复。模板 finalize 烘焙预取提示。集成不重建也不绕过其中任何一项。
