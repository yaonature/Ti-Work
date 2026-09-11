# 改动说明

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-09-04 |
| 作者 | AI 助手 |
| 分支 | 当前工作区 |
| 起始 commit | working-tree |
| 结束 commit | working-tree |
| 关联需求/单号 | 设计蓝图《docs/Ti Work 桌面执行账本交互设计蓝图.md》D1-D6 + 「账本批次收口 = 分两批」，「空态 = 完全隐藏 0 宽不占栅格」，「开启信号 = 发送受理即开启、标题取当前消息业务摘要」三项已确认决策 |

## 功能改动点

首期（B1）落地「会话页右区执行账本」：在桌面端完整会话页新增第三列运行账本（Run Ledger），对前台「对话式业务编排」的每次会话 Run 提供实时的业务进度呈现。不改沉淀链路、不新增后端存储，账本为纯前端运行视图模型（复用 send-stream 链路的 tool 事件，agent-run-sediment 保持只读观测纪律）。

- 新增 `src/components/run-ledger/run-ledger-store.ts`（执行账本数据层）。
  - 类型模型：`LedgerRun`（active/complete/error）、`LedgerNode`（running/success/error）、`LedgerToolKind`（search/read/write/edit/browser/command/memory/approval/other）、传输层宽松事件 `LedgerToolEvent`。
  - 语义翻译：`classifyTool`（工具名 → 业务归类）、`KIND_LABELS` 中文办公语义（如「正在检索资料 / 检索资料完成 / 检索资料失败」）、`extractSubject`（文件动作取文件名、检索类取词，截断去噪）、`deriveRunTitle`（任务标题取消息首行业务摘要，最长 48 字，空值回退「任务执行」）。
  - Store 生命周期：`openRun`（发送受理即开新区块，同会话再次发送顶替旧 Run）→ `attachRunId`（started 事件补挂 runId）→ `appendTool`（tool 事件按 toolCallId 收敛 start→complete/error 三态为同一条节点；与当前 run.runId 不一致的迟到事件丢弃）→ `completeRun` / `failRun`（成功/失败终态，重复终态幂等；失败记录 errorMessage，运行中节点保持原状由面板以「中断」语义呈现）。
  - 每个 sessionKey 只保留最近一次 Run，严格只收当前会话。
- 新增 `src/components/run-ledger/run-ledger-panel.tsx` + `index.ts`（右区面板 UI）。
  - 准入条件与 TerminalPanel 一致：仅完整会话页（非 compact / 非 hideUi / 非移动端 / 非 focus-mode）渲染；无 Run 记录时返回 null（0 宽，不占栅格）。
  - 状态机：Run 进行中自动展开；完成后空闲超时（常量 60s）收敛为 30px 细窄角标；手动回看后保持展开直至新 Run 或再次收起；新 Run（startedAt 变化）自动重新展开。
  - 展开态 320px：任务头（状态点 + 状态文案 + 业务标题 + 失败原因）、待确认区（仅 active 且有 pending 审批时出现，复用对话流同款 `ApprovalCard` + 同源 `onResolve` 回调，不新增状态）、进度节点区（默认业务进度 label + 主体，点击展开动作明细：时间/工具名/结果摘要；进行中自动滚动到底部；失败 Run 中未收口节点以「–」中断语义呈现）。
  - 全量 HugeIcons 图标 + CSS 变量主题，无原生组件、无 emoji。
- 改造 `src/screens/chat/hooks/use-streaming-message.ts`（结构性事件采集）。
  - started 分支：`attachRunId(activeSessionKeyRef.current, runId)` 补挂 runId。
  - tool 分支：在既有 `pushActivity` 之后追加 `appendTool(sessionKey, { phase/name/toolCallId/args/result/preview/runId })`。
  - finishStream 成功终态：`completeRun`；markFailed 失败/中断终态：`failRun(message)`。
- 改造 `src/screens/chat/chat-screen.tsx`（栅格与开收账接线）。
  - 桌面全宽布局由两列改为 `grid-cols-[auto_1fr_auto]`，第三列挂载 `RunLedgerPanel`。
  - `sendMessage`：组装 history 后、开始 stream 前 `openRun(sessionKey, { title: deriveRunTitle(body), runId: null })` —— 发送受理即开区块。
  - `handleAbortStreaming`：存在 activeSend 会话时先 `failRun(activeSend.sessionKey, '已中止')` 再取消流。
  - `ledgerSessionKey` 与开 Run 采用同一取值链路（portable 时固定 'main'），保证收账对齐；审批区以既有 `displayApprovals` + `resolvePendingApproval` 同源下传面板。

## 涉及文件列表

- `src/components/run-ledger/run-ledger-store.ts`（新增）
- `src/components/run-ledger/run-ledger-panel.tsx`（新增）
- `src/components/run-ledger/index.ts`（新增，barrel 导出）
- `src/screens/chat/hooks/use-streaming-message.ts`（事件采集接线）
- `src/screens/chat/chat-screen.tsx`（第三列栅格 + 开/收账接线）
- `src/test/run-ledger-store.test.ts`（新增，18 个用例）

## 影响到的功能模块

- 会话页（Chat Screen）桌面全宽布局 —— 新增第三列，不影响 compact / 移动端 / focus-mode 分支
- 对话式业务编排消息发送链路（sendMessage / streaming 事件）
- 执行账本（首期：会话内前台 Run）
- 审批链（右区面板复用对话流审批卡，同源同对象，不新增审批状态源）
- 单元测试

## 测试要点（AI 生成脚本时按此展开）

- `deriveRunTitle`：剥离 markdown 前缀/星号取首行；空串/空内容回退「任务执行」；超长截断 48 字。
- `classifyTool`：search/read/write/edit/browser/command/memory/approval/other 归类。
- `extractSubject`：文件类仅返回 basename（截断 60 字）、检索词类截断；args 非对象/数组返回 undefined。
- `openRun` 发送受理即开 active 区块并清空旧节点；同会话再次 openRun 顶替旧 Run；不同会话隔离。
- `attachRunId` 只对 active Run 生效，runId 无变化不更新时间戳。
- `appendTool`：start 建节点 → 同 toolCallId complete/error 收敛为同一条（success/error）；无进行中 Run 丢弃；携带不一致 runId 的迟到事件丢弃。
- `completeRun`：运行中节点统一收敛 success，重复调用幂等。
- `failRun`：记录 error + errorMessage（截断 160），运行中节点保持 running，重复调用幂等。
- 面板准入：无 Run 返回 null 不占栅格；compact/mobile/focus/hideUi 均不渲染（与 TerminalPanel 同条件）。

## 风险点 / 遗留事项

- 本次（B1）范围内明确不做：左区会话分组（D6/第二步）、全局顶部运行小窗、审批前置设档、后台任务回放、工具级单步重试。
- `pushActivity`（activity-store）在 tool 分支仍被调用，属旧链路共存；B2 将删除 activity-store 并移除相关调用点（含 use-streaming-message 中 3 处与 InspectorPanel 引用），届时以本改动说明为 B2 回归基线。
- 账本标题与节点均为前端语义翻译，服务端沉淀链路（agent-run-sediment）未改、无新增存储。
