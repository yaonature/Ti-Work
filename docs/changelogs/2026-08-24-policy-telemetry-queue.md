# 改动说明

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-24 |
| 作者 | AI 助手 |
| 分支 | 当前工作区 |
| 起始 commit | working-tree |
| 结束 commit | working-tree |
| 关联需求/单号 | 统一 Telemetry Queue（本地化 TDD 落地） |

## 功能改动点

- 新增事件驱动收口模块 `src/server/policy-telemetry.ts`，将目录 / 网站 / 终端 / 审批四类守卫的决策统一沉淀为一条标准化事件流 `desktop.policy_decision`，避免各守卫各自维护事件命名空间（`desktop.directory_policy` 等）导致审计与行为画像碎片化。
- 定义统一决策类型 `UnifiedPolicyDecision`：`source`（directory / website / terminal / approval）+ `result`（allowed / denied / needs_confirmation / needs_approval）+ 动作、主体、原因、profile、细节、时间戳，所有守卫输出同构，方便下游统一消费。
- `publishPolicyDecision(input)`：单入口发布决策，同时完成两件事——
  - 先入内存队列 `getPolicyTelemetry` 沉淀（容量 500，超限自动丢弃最旧条目，环形裁剪）；
  - 再经 `chat-event-bus` 广播 `desktop.policy_decision`，与既有 SSE 回放 / 持久化链路互通。
- `getPolicyTelemetry(options?)`：按 `source` / `result` 过滤、`limit` 截取队列，默认取最近 100 条。
- `clearPolicyTelemetry()`：清空队列（供测试 / 会话重置使用）。
- 重构 `src/server/authorization-guard.ts`：目录、网站、终端三处守卫的决策发布由各自的 `publishChatEvent('desktop.*_policy', ...)` 统一改为 `publishPolicyDecision({ source: ..., ... })`，行为不变、事件名归一；事件名 `desktop.directory_policy / website_policy / terminal_policy` 无其它消费者，整体更名安全。

## 涉及文件列表

- `src/server/policy-telemetry.ts`（新增统一决策收口模块）
- `src/server/authorization-guard.ts`（目录 / 网站 / 终端三处守卫改走 `publishPolicyDecision`）
- `src/test/policy-telemetry.test.ts`（新增 `policy-telemetry` 测试套件，共 6 个用例）
- `src/test/authorization-guard.test.ts`（守卫回归，确认重构无副作用）

## 影响到的功能模块

- 权限与安全
- Authorization Guard（目录 / 网站 / 终端）
- 高风险动作确认 / 审批链
- 事件驱动沉淀
- 审计与行为画像（后续事件消费）
- 单元测试

## 测试要点（AI 生成脚本时按此展开）

- 验证 `publishPolicyDecision` 向 chat-event-bus 发布 `desktop.policy_decision`，payload 完整（source / result / action / subject / reason / profileName / ts）。
- 验证决策沉淀进 telemetry 队列，可被 `getPolicyTelemetry` 读取。
- 验证按 `source` 过滤。
- 验证按 `result` 过滤。
- 验证 `limit` 截取最近 N 条。
- 验证 `clearPolicyTelemetry` 清空队列。
- 验证三处守卫重构后仍分别发布正确 source 的 `desktop.policy_decision`（回归）。

## 风险点 / 遗留事项

- 队列为内存态（挂 `globalThis` 以规避 Vite HMR 重置），当前不落盘；如需跨重启审计回溯，后续应接入 `event-store`（`desktop.policy_decision` 事件经 `chat-event-bus` 时已持久化，可作为权威审计源）。
- `approval` source 已预留为统一事件流的组成部分，但其确认 / 审批链的正式接入（网关 SSE 转发 + approve/deny 回写闭环）仍需在高风险动作确认/审批链开发项中完成。
