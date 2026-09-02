# 改动说明

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-24 |
| 作者 | AI 助手 |
| 分支 | 当前工作区 |
| 起始 commit | working-tree |
| 结束 commit | working-tree |
| 关联需求/单号 | 授权确认 / 用户纠偏事件沉淀（本地化 TDD 落地） |

## 功能改动点

- 将「用户对授权/高危动作的决策响应」沉淀进统一事件流 `desktop.policy_decision`，补齐了 `approach` 域（`source: approval`）在守卫侧之外的用户侧闭环。
- `policy-telemetry.ts` 新增 `recordAuthorizationDecision(input)`：把用户在审批/确认后的**实际决策**（approve→allowed / deny→denied）发布为 `source: approval` 的政策事件，并返回 `{ disposition, decision }` 供审计/画像消费。
- 定义 `AuthorizationDisposition`（`confirmed / rejected / corrected`），用于区分「用户决策相对守卫默认判定的立场」：
  - `confirmed`：用户同意了一次放行或确认提示。
  - `rejected`：用户拒绝了确认提示。
  - `corrected`（纠偏）：用户做出了与守卫「**明确的**放行/拦截」相反的决定（示例：守卫已拦截，用户仍放行；守卫已放行，用户仍拒绝）。
- `recordAuthorizationDecision` 在发布前会**关联最近的先序决策**（依据 `approvalId` / `subject` / `action` 匹配），据此推导 disposition；关联不到先序自动回落为 `confirmed/rejected`。为避免用户自身此前的最终决策污染纠偏判定，关联时跳过 `source: approval` 且结果为 `allowed`/`denied` 的用户决策，仅以守卫决策或仍在途的提示（`needs_approval`）作为「先序自动立场」。
- `publishPolicyDecision` 改为返回创建的 `UnifiedPolicyDecision`（向后兼容，既有调用忽略返回值），使 `recordAuthorizationDecision` 能直接携带新决策对象返回。
- 接线三处集成点（保持 TS 层为纯函数可测，接线为薄层）：
  - `send-stream.ts`：网关下发 `approval.required/tool.approval/exec.approval` 时，除透传 `approval` 事件外，同步向 telemetry 队列沉淀一条 `source: approval`、`result: needs_approval` 的**待审批提示**（`subject = approvalId`），作为 approve/deny 侧关联对象。因 `publishPolicyDecision` 的 `pushDecision` 在事件总线广播之前执行，即使该流处于活跃 run（总线广播被抑制），待审批决策仍可靠入列。
  - `approvals.$approvalId.approve.ts`：网关原生 `/approve` 端点或 `/approve` 聊天命令任一路径成功回写后，调用 `recordAuthorizationDecision({ outcome: 'approved', approvalId, scope })`。
  - `approvals.$approvalId.deny.ts`：`/deny` 成功回写后，调用 `recordAuthorizationDecision({ outcome: 'denied', approvalId })`。

## 涉及文件列表

- `src/server/policy-telemetry.ts`（新增 `recordAuthorizationDecision` + 关联/推导辅助；`publishPolicyDecision` 改为返回决策对象）
- `src/routes/api/send-stream.ts`（网关审批提示沉淀为 `needs_approval` 政策事件）
- `src/routes/api/approvals.$approvalId.approve.ts`（审批成功回写后发布授权确认事件）
- `src/routes/api/approvals.$approvalId.deny.ts`（拒绝成功回写后发布授权确认事件）
- `src/test/policy-telemetry.test.ts`（新增 `policy-telemetry authorization decisions` 测试套件，共 5 个用例）

## 影响到的功能模块

- 权限与安全
- Authorization Guard（目录 / 网站 / 终端 + 高风险动作确认 / 审批链）
- 事件驱动沉淀（统一 Telemetry Queue）
- 审计与行为画像（用户立场来源）
- 单元测试

## 测试要点（AI 生成脚本时按此展开）

- 验证批准一个待审批提示 → disposition 为 `confirmed`，发布 `source: approval`、`result: allowed`，事件总数 +1（先序提示 + 用户决策共 2 次）。
- 验证拒绝一个待审批提示 → disposition 为 `rejected`，`result: denied`。
- 验证「守卫已拦截却批准」→ `corrected`。
- 验证「守卫已放行却拒绝」→ `corrected`。
- 验证无先序决策时回落为 `confirmed / rejected`，且用户的既往最终决策不干扰后续纠偏判定。
- 验证 `publishPolicyDecision` 返回创建的决策对象。

## 风险点 / 遗留事项

- 关联（correlation）依赖待审批提示与用户响应落在同一 telemetry 队列（进程内 `globalThis` 内存态）；跨进程、跨重启或经网关直连（不经本仓库 send-stream）的审批，可能缺失先序提示，从而回落为 `confirmed/rejected` 而无法标记 `corrected`。此为数据可得性限制，后续可用 `event-store` 持久化 `desktop.policy_decision` 作为审计源。
- `corrected` 判定仅覆盖「守卫有明确放行/拦截先序」的纠偏场景；纯提示型确认（`needs_approval/needs_confirmation`）不视为纠偏。
- 「画像提炼与事件流打通」（消费上述事件做习惯/画像归纳）仍为后续开发项，不在本次范围。
