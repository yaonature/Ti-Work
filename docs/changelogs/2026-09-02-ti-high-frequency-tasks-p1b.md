# 改动说明

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-09-02 |
| 作者 | AI 助手 |
| 分支 | 当前工作区 |
| 起始 commit | working-tree |
| 结束 commit | working-tree |
| 关联需求/单号 | 勾选清单 3.6「行为资产沉淀 P1-B：高频任务识别 + 工作台露出」（方案文档 4.5.4 冻结结论） |

## 功能改动点

落地「行为资产沉淀 P1-B」：在 P1-A 会话任务序列之上做**跨会话结构相似度聚类**，识别用户反复执行的高频工作任务，并把结果以「高频任务画像」露出到工作台、支持**点击一键重放（新会话自动发起）**。

这是「用户高频让 Agent 操作 → 沉淀出可复用任务资产」闭环的产品化首站：画像里的「意图 + 步骤模板 + 参数样例 + 频次/周期」本身就是未来把高频任务升格为**独立专用 Agent** 的可执行模板（参数槽位化属 P1-C 范畴）。

**识别服务层（跨会话结构相似度聚类）**

- 新增 `src/server/high-frequency-tasks.ts`：
  - 识别范围（设计约束）：只识别 `kind='agent'` 且意图类别非 chat 的序列（手动窗口序列无对话意图语义，无法支撑「点击重放」召回，不进任务画像——其频次画像已由 habit-profile 计数视图承接）；
  - 任务锚点 = 同（意图类别 + 意图动作）；步骤模板 = 序列内成功步骤（`ok` / `approved`）的有序泛化动作链（`tool:action`），连续重复折叠，容忍审批流程拆分记账；
  - 结构相似度 = 两条模板签名的 LCS 覆盖率（≥ 0.75），允许个别步骤浮动（多一步检索 / 少一步确认）仍归同一任务族；
  - 频次：按「会话 + UTC 自然日」去重 ≥ 3 次为高频；跨自然日 ≥ 2 天标记 `isPeriodic`；
  - 参数样例：聚类成员中高频出现的个人要素（路径/命令原文），每个执行至多计一次，仅本地保留、上云剥离（未来参数化重放的种子）；
  - 产出画像：`taskId`（意图锚点 + 模板哈希稳定标识）+ 意图 + 步骤模板 + 参数样例 + 频次/周期 + firstTs/lastTs；
  - 核心 `detectHighFrequencyTasks` 为纯函数（无 IO、阈值可注入），`getHighFrequencyTasks` 为存储读取门面（产品默认最近 30 天窗口 / 上限 20 条）。
- 新增 `src/routes/api/high-frequency-tasks.ts`：`GET /api/high-frequency-tasks`（服务端执行，`isAuthenticated` 保护），支持 `profile / limit / windowDays` 查询参数，只读返回画像列表。

**工作台露出 + 一键重放（新会话自动发起）**

- 新增 `src/screens/chat/high-frequency-replay.ts`：一键重放的暂存/消费模块（与 pending-send 边界明确：pending-send 面向「已存在会话的续发/恢复」，本模块面向「新会话首条消息自动发起」，与会话 key 解耦、单次消费、TTL 2 分钟、localStorage 双写支持跳转后刷新恢复）。
- `src/screens/dashboard/dashboard-screen.tsx`：新增「高频任务」GlassCard 区块（无任务时展示沉淀引导，有任务时展示画像行：意图标题 + 类别色标 + 频次/周期徽标 + 步骤模板 + 常用要素样例）。点击画像行 → 暂存载荷并跳转 `/chat/new`；空态/加载态/错误态按克制原则分级展示。
- `src/screens/chat/chat-screen.tsx`：新会话（`isNewChat`）挂载时消费暂存载荷并复用 composer 同款 `send` → `isNewChat` 分支自动发起首条消息（创建服务端线程、收口真实 sessionKey、展示为普通可编辑 user 消息）。用户可在新会话直接编辑措辞后再发送，避免「盲重放」脱离当下意图。
  - 为什么复用 `send` 的 isNewChat 分支而非 pending-send：pending-send 消费 effect 在 isNewChat 时被短路；新会话唯一能创建线程并收口真实 sessionKey 的链路就是 composer 提交同款 send。单次消费 + mount 先于用户提交，与手动输入天然互斥，不会双发。

## 涉及文件列表

- `src/server/high-frequency-tasks.ts`（新增：结构相似度聚类核心 + 存储门面）
- `src/routes/api/high-frequency-tasks.ts`（新增：只读查询 API）
- `src/screens/chat/high-frequency-replay.ts`（新增：一键重放暂存/消费）
- `src/screens/dashboard/dashboard-screen.tsx`（新增「高频任务」露出区块 + 点击重放接线）
- `src/screens/chat/chat-screen.tsx`（新增新会话自动发起 effect；审计修复：send 返回成功布尔 + 失败回填 composer 兜底）
- `src/screens/chat/components/chat-composer.tsx`（审计修复：ChatComposerHandle 新增只读 getValue）
- `src/test/high-frequency-tasks.test.ts`（新增，12 用例）
- `src/test/high-frequency-replay.test.ts`（新增，6 用例）

## 影响到的功能模块

- 工作台（新增「高频任务」资产露出区）
- 行为资产沉淀（会话任务序列 → 高频任务画像，仅本地只读）
- 会话（/chat/new 新会话自动发起首条消息；仅当存在重放载荷时触发，无载荷零行为变化）
- Authorization Guard / 授权策略 / 计数画像（零改动：P1-B 只读序列，不触碰 Guard 与 habit-profile）

## 测试要点（AI 生成脚本时按此展开）

- high-frequency-tasks（12 用例）：识别范围过滤（manual-window / chat / 空意图 / 无动作 / 不足步骤 / 窗口过滤）；结构相似聚类（完整画像 periodic、覆盖率合并与 drop-write 步骤浮动、低于 minFrequency、session 同天去重、非 periodic 同一天）；排序/limit；参数样例聚合；`getHighFrequencyTasks` 存储真档 agent-vs-manual 过滤与默认 30 天窗口。
- high-frequency-replay（6 用例，jsdom）：无 stash 返回 null；stash → consume 单次消费语义（二次为空）；字段原样透传（意图/样例/附件）；过期载荷（>2min TTL）不被消费；恰好 2 分钟前仍可消费；localStorage 双写支持模块重建（模拟刷新后）恢复消费且单次。
- 回归：habit-sequences（11）、policy-telemetry（12）全部通过——P1-B 复用序列层零改动，无回归。
- 类型检查：GetDiagnostics 对新增/改动 TS 文件零诊断。

## 风险点 / 遗留事项

- 手动窗口序列不进高频画像：高频识别只吃 agent 序列（需要对话意图锚点支撑「点击重放」召回）；手动序列的频次画像仍由 habit-profile 承接，两份资产按用途分工、不合并。
- 画像仅本地识别与展示，不上云：上云 / OPC 提纯 / 行业售卖属 P1-C（依赖 OPC 主体工程）。
- 「沉淀为独立 Agent」依赖参数槽位化：本期重放以「最近一次任务措辞原文」为消息（参数样例仅作可视化预期展示），不自动填充新参数；把画像升格为可执行参数模板的独立 Agent 属 P1-C，本批次不越界实现。
- 识别召回以最近 30 天窗口为产品默认；识别失败 / 序列为空时工作台区块隐藏或展示引导，不影响其余 dashboard 数据。

## 审计修复（2026-09-02 全量严格审计）

对 P1-B 版本改动执行全量严格审计（双验证人共识），修复 4 项问题：

1. **（Major）自动发起失败时重放文案静默丢失**：原 effect 先 `consume`（单次即清空）再 `void send()`，而 `send` 对失败只 return 不 throw——一旦后端未就绪或新会话创建失败，用户原始意图措辞被清空且无任何兜底。
   - 修复：`send` 返回契约改为 `Promise<boolean>`（成功 true / 各类失败路径 return false，对既有调用方零行为变化）；`chat-screen.tsx` 重放 effect 在 `sent === false` 时把任务措辞回填 composer（草稿持久化，可手动补发）。
   - 回填前通过 composer 新增的 `getValue()` 读当前内容，仅当输入框为空才回填，避免覆盖用户等待期间手动输入的新文案（`ChatComposerHandle` 新增只读 `getValue`，仅 chat-screen 消费，无外部影响）。
2. **（Minor）读取上限与注释漂移**：`getHighFrequencyTasks` 注释声称对齐 store 容量上限 1200，实际传 `10_000`——未来若上限调高会静默截断。修复：`MAX_SEQUENCES` 从 habit-sequences 导出，读取上限直接引用该常量，注释同步改为「读取全量」。
3. **（Minor）缺措辞任务自动发送占位句**：`intentLabel` 为空时「编码 · Fix」等占位拼装句会被当作真实新会话首条消息自动发出。修复：dashboard 画像行按 `intentLabel` 是否存在判定可重放性（缺措辞则禁用入口 + 「暂不可重放」提示），handler 层再兜底一次，双保险。
4. **（Minor）dashboard 镜像类型死字段**：`HfTask.firstTs/lastTs` 从未被读取且类型提前漂移（服务端必填、镜像可选）。修复：从镜像类型移除，仅在注释中说明该字段属服务端排序/周期判定使用。
