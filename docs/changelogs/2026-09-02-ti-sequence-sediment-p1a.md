# 改动说明

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-09-02 |
| 作者 | AI 助手 |
| 分支 | 当前工作区 |
| 起始 commit | working-tree |
| 结束 commit | working-tree |
| 关联需求/单号 | 勾选清单 3.6「行为资产沉淀 P1-A：操作序列沉淀」（方案文档 4.5.1 / 4.5.2 冻结结论） |

## 功能改动点

落地「行为资产沉淀 P1-A」主 + 辅两条链路，将「用户高频让 Agent 执行的操作」沉淀为可复用的**会话任务序列**（后续高频任务识别 P1-B 与独立 Agent 沉淀的数据底座）：

**意图分类共享模块（消除双份维护）**

- 新增 `src/utils/intent-classification.ts`：把历史遗留在 generate-session-title 内部的意图分类死代码收敛为共享模块，导出 `IntentCategory / INTENT_CATEGORIES / CATEGORY_KEYWORDS（中英双语）/ ACTION_PATTERNS / cleanIntentText / detectIntentCategory / detectIntentAction / classifyUserIntent`（返回 category + action + label 三元组，label 为收敛文本）。
- 重构 `src/utils/generate-session-title.ts`：删除本地重复的分类关键词与清理逻辑，改为引用共享模块，标题生成与行为沉淀共用一份分类语义（既有标题行为逐字保持，回归测试保障）。

**序列存储层**

- 新增 `src/server/habit-sequences.ts`：与 habit-profile（计数画像）并列的「序列视图」，按 profileName 隔离落盘 `~/.hermes/habit-sequences/`。
  - `SessionRunSequence` 为原子单位：`{version, sequenceId, kind: agent | manual-window, profileName, sessionKey(可空), runId(可空), intentLabel/intentCategory/intentAction, startedTs, endedTs, actions[]}`；`RunActionNode` 记录有序动作节点（tool / toolCallId / outcome / action / subject / summary），subject 为本地保留的个人要素、上云剥离。
  - `appendAgentSequence`：Agent run 收敛入口（空 actions 返回 null 不落盘，天然忽略纯聊天 run）；`ingestManualDecision`：手动守卫决策时间窗聚合（5min 间隔 / 20 条上限强制收口，审批来源与 needs_confirmation 中间态内过滤）；`flushManualWindow / resetHabitSequences / clearHabitSequencesCache / configureHabitSequences` 供收口与测试隔离。
  - 容量上限（1200 序列 / 60 动作/序列）+ 写盘尽力而为（失败绝不阻断决策链路）。

**Agent 链路接线（P1-A 主线）**

- 新增 `src/server/agent-run-sediment.ts`：按 runId 聚合一次 run 内有序工具动作的追踪模块（内存 Map + 容量 48 / TTL 20min 双保险防泄漏）。
- 改造 `src/routes/api/send-stream.ts`（enhanced 模式 onEvent）：
  - 请求级意图标签：`classifyUserIntent` 对用户消息实时提取一次，run 级复用；
  - 首个携带 run_id 的事件开启追踪（幂等）；
  - `tool.completed → ok / tool.failed → error / artifact.created → ok / approval.required → pending_approval` 四类节点收口；`run.completed` 时 `noteRunEnded` 落盘为一条 agent 序列；`error` / 超时路径 `discardRun` 丢弃半截轨迹。
  - 纯只读：不改事件流、不阻塞、不改变任何既有 SSE 消息语义。

**手动 Guard 链路接线（P1-A 辅助线）**

- `src/server/policy-telemetry.ts`：`publishPolicyDecision` 统一漏斗内（`updateHabitProfile` 之后、事件广播之前）接入 `ingestManualDecision`。Authorization Guard 全部 enforce* 已内部调用该漏斗，无需改动 Guard 签名与任何调用点；契约预留 sessionKey 可空（无会话上下文）。

## 涉及文件列表

- `src/utils/intent-classification.ts`（新增共享意图分类模块）
- `src/utils/generate-session-title.ts`（重构：复用共享模块，删除本地重复分类逻辑）
- `src/server/habit-sequences.ts`（新增序列存储层）
- `src/server/agent-run-sediment.ts`（新增 Agent run 链路追踪）
- `src/routes/api/send-stream.ts`（接线：意图标签 + 工具节点收口 + run.completed 落盘 + error/超时丢弃）
- `src/server/policy-telemetry.ts`（漏斗接入 ingestManualDecision）
- `src/test/intent-classification.test.ts`（新增，9 用例）
- `src/test/habit-sequences.test.ts`（新增，11 用例）
- `src/test/agent-run-sediment.test.ts`（新增，9 用例）
- `src/test/policy-telemetry.test.ts`（存储隔离 + 漏斗集成用例 1 条）
- `src/test/risk-approval.test.ts`（序列存储隔离）
- `src/test/authorization-guard.test.ts`（序列存储隔离）

## 影响到的功能模块

- 会话（Chat / Agent run）
- 行为资产沉淀（会话任务序列，本地首版）
- Authorization Guard / 统一 Telemetry（只读旁路，签名与调用点零改动）
- 权限与安全（画像/审计链路无回归）
- 单元测试

## 测试要点（AI 生成脚本时按此展开）

- 意图分类：中英关键词命中、chat 回退、action 顺序匹配、empty-label 回退、clean 规则、generateSessionTitle 行为回归。
- habit-sequences：空 actions 拒绝落盘；run 序列按 order 收敛、倒序查询与 limit/kind 过滤；手动窗口同窗归组 / 超 5min 间隔拆组 / 满 20 条强制收口；审批来源与 needs_confirmation 不进窗口；flush 用原始 profileName 键（含特殊字符档案落盘安全化）；磁盘持久化（清缓存后可读）；reset 清空。
- agent-run-sediment：run 收口为带意图标签的 agent 序列；纯聊天 run 不落盘；failed=error；approval=pending_approval；discard 后不落盘；runStarted 幂等；runId 隔离；`_thinking/tool` 占位名忽略；空 runId 忽略。
- 漏斗集成：`publishPolicyDecision`（terminal allowed）→ flush 后产生 1 条 manual-window 序列且 approval 来源被过滤。
- 回归：policy-telemetry（12 条含新增集成 1 条）、risk-approval（12）、authorization-guard（20）全部通过——漏斗接入后 Guard 行为无回归。

## 风险点 / 遗留事项

- 序列仅本地沉淀，无 UI 露出（P1-B 高频任务识别 + 工作台露出属下一批次）。
- approval 决策点记录为 `pending_approval` 快照，不与后续用户 approve/deny 响应做跨请求关联（agent 链路审批已在事件流的审批源上经 recordAuthorizationDecision 沉淀，不重复建模）。
- memory.updated / skill.loaded 事件暂不入序列（保持序列聚焦「操作」），schema 预留，后续可按需增加节点类型。
- 会话任务序列默认私有存储（含命令/路径原文，subject 上云剥离策略属 P1-C OPC 阶段）。
