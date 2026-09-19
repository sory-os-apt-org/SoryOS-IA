# E2B Snapshots and Templates

[English](snapshots.md) | 中文

快速预构建的云环境（优先 Rust）。快照与模板构建是外部 API 调用，绝不是重写的逻辑。

## Primitives

| Primitive | Surface | Use |
|---|---|---|
| `createSnapshot` | `sandbox.createSnapshot({ name })` | 把本沙箱冻结为可复用的模板 id |
| `pause` | `sandbox.pause({ keepMemory })` | 带内存挂起（恢复即恢复进程）或仅文件系统 |
| `fork` | `sandbox.fork({ count })` | 从同一快照克隆运行中的工作 |
| `Template.build` | 模板 builder（`fromImage`、`aptInstall`、`runCmd`、`setEnvs`……） | 工具链一次烘焙，之后秒级启动 |

## Rust prebuild (priority case)

```text
Rust Base Template
├── Rust toolchain + Cargo + rustfmt + clippy
└── warmed registry cache
    snapshot
      ↓
  new sandbox per task
      ↓
cargo check / build / test / run
```

agent loop 不变：建文件、跑 Cargo、收错误、随模型修复、重跑。变的只是底下世界从冷机变成秒级克隆。

## Connection wrappers

`E2bConnection` 以 `pause()`、`createSnapshot()`、`getHost()`、`getInfo()` 作薄操作员包装；提供方在轮次中途绝不调用它们。
