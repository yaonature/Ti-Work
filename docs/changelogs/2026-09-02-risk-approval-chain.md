# 改动说明

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-09-02 |
| 作者 | AI 助手 |
| 分支 | 当前工作区 |
| 起始 commit | working-tree |
| 结束 commit | working-tree |
| 关联需求/单号 | 勾选清单 3.3「高风险动作确认 / 审批链正式接入执行链路」 |

## 功能改动点

将「高风险动作确认 / 审批链」从门禁决策层（`evaluateRiskAction / assertTerminalAccess` 抛错）正式接通到桌面端执行链路，形成「拦截 → 用户决策 → 放行回写 → 审计」闭环：

- 新增 `src/server/risk-approval.ts`：本地风险动作确认 / 审批请求管理模块。
  - `createRiskApprovalRequest`：门禁命中时创建待确认 / 待审批请求（带 TTL，默认取策略 `approvals.timeout`，下限 15s）。
  - `getRiskApprovalRequest`：读取请求，过期即标记 `expired` 并从存储移除。
  - `resolveRiskApproval`：落定 `approved / denied`，支持 `once / session / always` 三档范围；`always` 写回 `security.risk_controls` 配置（移除该动作确认 / 审批要求，写失败静默降级不阻断审批）；每次落定经 `recordAuthorizationDecision` 沉淀统一策略事件流（审计 / 画像）。
  - `consumeRiskApprovalGrant`：放行凭据消费校验（已批准、未过期、动作匹配），用于终端会话创建前门禁放行。
- 改造 `src/routes/api/terminal-stream.ts`：创建终端会话前接入 `enforceTerminalAccess`。
  - 命中「需要确认 / 需要审批」且未携带凭据 → 创建审批请求并返回 JSON（`code / requestId / action / subject / decision`）。
  - 携带凭据 → `consumeRiskApprovalGrant` 校验通过则放行创建会话，否则拒绝（防重放 / 过期）。
- 新增 `src/routes/api/risk-approvals.$requestId.resolve.ts`：确认 / 审批落定端点（`POST /api/risk-approvals/:requestId/resolve`），入参 `decision: approved | denied` + `scope: once | session | always`；请求不存在 / 已过期 / 已落定返回 404。
- 新增 `src/components/terminal/risk-approval-panel.tsx`：执行中心高风险动作确认 / 审批面板，与聊天页审批卡片保持同设计语言。
  - 待处理态：琥珀色卡片，标题区分「该操作需要审批 / 该操作需要您确认」，详情可折叠，四个决策入口（仅本次允许 / 本次会话允许 / 始终允许 / 拒绝）+ 稍后处理。
  - 已响应态：收据（已允许 / 已拒绝）。
- 改造 `src/components/terminal/terminal-workspace.tsx`：执行中心终端接线确认 / 审批链。
  - `connectTab` 请求体携带放行凭据（「仅本次允许」一次性注入优先，其次读取会话内 `sessionStorage` 凭据）。
  - 处理 403 拦截响应：识别 `terminal_requires_confirmation / terminal_requires_approval` 后弹出确认面板。
  - `handleResolveRiskApproval`：调用落定端点；`session / always` 凭据写入 `sessionStorage`（`ti.riskGrant.execute_shell`），`once` 仅注入当前重试；获批后自动重试建立终端会话。
  - 关闭标签页 / 关闭面板时同步清理待审批状态。

## 涉及文件列表

- `src/server/risk-approval.ts`（新增）
- `src/routes/api/terminal-stream.ts`（门禁接入）
- `src/routes/api/risk-approvals.$requestId.resolve.ts`（新增）
- `src/components/terminal/risk-approval-panel.tsx`（新增）
- `src/components/terminal/terminal-workspace.tsx`（确认 / 审批链接线）
- `src/test/risk-approval.test.ts`（新增，12 个用例）

## 影响到的功能模块

- 执行中心（终端）
- 权限与安全（高风险动作确认 / 审批链）
- 授权门禁（Authorization Guard 终端执行）
- 策略事件流（审计 / 画像）
- 单元测试

## 测试要点（AI 生成脚本时按此展开）

- 创建待确认 / 待审批请求：字段、TTL（默认 60s、下限 15s）。
- 过期请求失效并从存储移除。
- `approved`（once）落定 + 统一策略事件流（`desktop.policy_decision`，disposition=confirmed）。
- `denied` 落定（disposition=rejected）。
- 已落定 / 已过期请求不可重复解析。
- 「始终允许」写回 `config.yaml` 移除该动作确认 / 审批要求；配置缺失时静默降级不阻断审批。
- 放行凭据消费：已批准且动作匹配才放行；未批准 / 已拒绝 / 不存在消费失败。
- `clearRiskApprovalRequests` 清空全部请求。

## 风险点 / 遗留事项

- 审批凭据存储于进程内 `globalThis` Map（与 `policy-telemetry` 队列一致），服务重启后凭据失效，需用户重新发起终端操作。
- 终端会话创建后门禁即完成（`execute_shell` 一次性决策）；终端内逐条命令的细粒度拦截仍属 Hermes 引擎（Python PTY）侧职责，不在本次范围。
- `always` 写回失败仅静默降级（不阻断审批），写回是否成功未回传前端。
