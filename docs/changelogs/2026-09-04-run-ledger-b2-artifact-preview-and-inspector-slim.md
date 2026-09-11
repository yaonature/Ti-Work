# 改动说明

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-09-04 |
| 作者 | AI 助手 |
| 分支 | 当前工作区 |
| 起始 commit | working-tree |
| 结束 commit | working-tree |
| 关联需求/单号 | 设计蓝图《docs/Ti Work 桌面执行账本交互设计蓝图.md》D1-D6 + 「产物卡范围 = 账本内直通预览」、「孤儿清理 = 删除无引用孤儿」两项已确认决策；以 B1 改动说明 `docs/changelogs/2026-09-04-run-ledger-session-right-side.md` 为回归基线 |

## 功能改动点

第二批（B2）执行账本收口：产物卡直通预览、检查器收窄为纯资源浏览、拆除旧 activity 链路并清理孤儿。仍不改沉淀链路、不新增后端存储（agent-run-sediment 保持只读观测纪律）。

- **产物直通（账本内「打开预览」）**
  - `src/components/run-ledger/run-ledger-store.ts`：`LedgerNode` 新增可选 `filePath`（文件类动作 args 含真实完整路径时保留）；新增导出 `extractFilePath(args, kind)` —— 仅 read/write/edit 类且路径型字段值含目录分隔符或带扩展名时返回（排除 query/keyword 等文本字段）；`classifyTool` 增加 `/^artifact/i` → `write` 归类（artifact.created 按「生成文件」语义呈现）；`appendTool` 三态收敛时 `filePath: candidate.filePath ?? node.filePath` 跨相位保留。
  - `src/routes/api/send-stream.ts`：`artifact.created` 事件除 result 外透传结构化产物路径 `args: { path }`，形成端到端直通链路。
  - `src/components/run-ledger/run-ledger-panel.tsx`：`NodeRow` 行内 hover 显现「预览」入口（EyeIcon，语义分隔避免按钮嵌套）；明细展开展示完整路径；`RunLedgerPanel` 本地维护 `previewPath`，复用 `FilePreviewDialog` 契约（全局 dialog portal 渲染，账本内打开/关闭/保存后继续查看）。
- **拆除旧 activity 链路（检查器收窄为纯资源浏览）**
  - 删除 `src/components/inspector/activity-store.ts`；清理 `use-streaming-message.ts` 中 3 处 `pushActivity` 调用块与 import（tool 分支中仅为 pushActivity 服务的 isMemory/isFileWrite/isFileRead/eventType 判断一并移除），保留与 activity-store 无关的 `markActivity`（生命周期心跳）。
  - `src/components/inspector/inspector-panel.tsx`：移除 activity/files/logs 三个页签及其组件（ActivityTab/FilesTab/LogsTab 与 `useActivityStore`/`ActivityEvent` 依赖），仅保留记忆/技能资源浏览；默认页签为 memory，资源不可用时在剩余可用资源间自动回退，两者均未开通时展示空态文案。
- **孤儿清理（蓝图 9.2 遗留）**
  - 删除全仓零引用组件：`src/components/dashboard-overflow-panel.tsx`、`src/screens/files/files-screen.tsx`（`/files` 路由「执行中心」在役，不受影响）。

## 涉及文件列表

- `src/components/run-ledger/run-ledger-store.ts`（filePath / extractFilePath / artifact 归类 / 收敛保留）
- `src/routes/api/send-stream.ts`（artifact.created 路径透传）
- `src/components/run-ledger/run-ledger-panel.tsx`（预览入口 + FilePreviewDialog 接线）
- `src/components/inspector/activity-store.ts`（删除）
- `src/screens/chat/hooks/use-streaming-message.ts`（清理 pushActivity 调用与 import）
- `src/components/inspector/inspector-panel.tsx`（收窄为记忆/技能资源浏览）
- `src/components/dashboard-overflow-panel.tsx`（删除，孤儿）
- `src/screens/files/files-screen.tsx`（删除，孤儿）
- `src/test/run-ledger-store.test.ts`（新增 5 个 B2 用例，18 → 23 全绿）

## 影响到的功能模块

- 执行账本（Run Ledger）：写入/生成类节点新增「打开预览」直通，明细展示完整路径
- 检查器面板（Inspector）：由活动/文件/日志/记忆/技能五页签收窄为记忆/技能资源浏览
- 对话式业务编排事件采集链路（send-stream SSE → use-streaming-message）
- 服务端产物事件（artifact.created）结构化透传
- 单元测试

## 测试要点（AI 生成脚本时按此展开）

- `classifyTool`：`artifact` / `artifact_created` 归为 `write`；未知工具仍为 `other`。
- `extractFilePath`：read/write/edit 含分隔符或扩展名的真实路径被提取；search/无路径字段/纯描述文本/非对象参数返回 `undefined`。
- `appendTool`：文件类节点 start→complete 三态收敛后 `filePath` 不丢失（complete 事件无 args 也不冲掉）；`artifact` 产物事件收账为 write 语义节点（label=文件已生成）并携带 `filePath` 与 basename subject。
- 删除基线：全仓无 `activity-store` / `pushActivity` / `useActivityStore` 残留引用；`/files` 路由（执行中心）正常运行。

## 风险点 / 遗留事项

- 预览可读范围取决于 `/api/files` 的既有读取能力（与文件浏览器同一契约，未做沙箱/绝对路径的特殊适配）。
- 本次范围外（保持排期）：左区会话分组（D6/第二步）、全局顶部运行小窗、审批前置设档、后台任务回放、工具级单步重试。
- 服务端沉淀链路（agent-run-sediment）未改、无新增存储。
