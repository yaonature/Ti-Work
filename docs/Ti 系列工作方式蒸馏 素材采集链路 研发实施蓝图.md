# Ti 系列工作方式蒸馏 素材采集链路 研发实施蓝图

> 状态：研发实施蓝图（2026-09-09 定稿草案；**共创两层补定**——D1-D5 素材采集归属 **L2 共创沉淀通道**：默认关闭、账号级 Gate，云端定向开通共创账号后系统自动采集，普通账号不产生样本；**D6 个人沉淀提示与 Skill 固化归属 L1 本地养成闭环**：全员默认可用、与共创 Gate 解耦、不上云。待评审后按 D1→D6 逐阶段 TDD 实施）。
> 关联文档：《Ti 系列工作方式蒸馏 设计评审稿.md》（以下简称"蒸馏评审稿"）——本蓝图对应其第 4 章"数据与授权"中缺口项与第 5 章 Step 1/2 的桌面侧原料供给；第 5 章 Step 3-5（L2 基线、蒸馏加工、影子比对）与云端相关（云端侧载体分层见《蒸馏评审稿》命名口径与《云端蒸馏与下发验证链路 蓝图》§1：业务承载在 **Ti Work 配套云端管理端**，Ti Mind / OPC 分供能力与治理），不在本仓实施范围。
> 开发纪律：沿用《自动化测试脚本交付与执行规范》《Ti 系列统一开发基线勾选清单.md》——每阶段产出 docs/changelogs/ 改动说明 + src/test 测试脚本，跑通 `npm test` 后方可收口；注释一律中文；commit 由用户分批授权执行。
> 代码注释语言：中文（仓库常态规范）。

---

## 1. 目标与范围边界

**目标**：在桌面端（Ti Work / Hermes-Studio）打通"蒸馏素材采集链路"——把用户（首案：一家律所非诉讼律师）真实作业中的（需求输入 → 交付物 → 本人修改链）在**授权 + 脱敏**前提下登记为本地结构化样本，作为后续蒸馏（L1 规范资产 / L2 一致性基线）与行业化（OPC 审核售卖）的原料。

**范围内（本仓）**：D1 交付物回传契约 → D2 需求输入样本登记 → D3 修改链 diff → D4 共创素材档案预览工作台 → D5 授权与红线管理收口；**D6 个人沉淀提示与 Skill 固化（L1 本地养成闭环，全员可用，与 D1-D5 解耦）**。

**范围外（明确不做）**：L1/L2 蒸馏加工算法、影子比对、OPC 上架、账号权益制下发、云端 Skill 市场——均属云端配套（Ti Work 配套云端管理端承载、Ti Mind 供能力、OPC 做平台治理），本阶段仅冻结素材数据契约（§3）供其消费。

**落地原则（蒸馏评审稿定稿口径，2026-09-09 共创两层补定）**：
- 执行在桌面：桌面端是用户办公的执行承载面，任务执行不交给云端；
- 数据不出授权目录：正文原文不沉淀、不上云，只登记"本地路径引用 + 脱敏快照/规范要素"；
- **本链路归属 L2 共创沉淀通道（账号级 Gate）**：默认全关；仅云端（Ti Work 配套云端管理端）定向开通的**共创账号**生效——开通后系统自动采集沉淀（无需用户手动上报），普通账号无自助开启入口；L1 个人本地养成（会话序列 / 意图 / 高频任务 / habit / 记忆）由既有 P1-A/B 链路承担、全员默认可用，不依赖本链路；
- **L1 沉淀提示闭环（D6，全员默认可用）**：普通用户同样会产生个人习惯沉淀需求——人人都有习惯，系统必然要做沉淀。D6 把 P1-B 高频画像升级为"主动咨询 → 预览确认 → 固化本地个人 Skill"的能力闭环：**不依赖 distill 采集、不受共创 Gate 约束、不上云、不引导共创**，与 L2 共创通道并行且互不干扰；"是否主动咨询、何时问、怎么问"（判定门槛 + 频控 + 文案）是 D6 的交互核心；
- 行业化是 OPC 审核的额外通道，不排他，不改变上述采集 Gate；
- 资产最终形态 = 本地可运行 Skill（`~/.hermes/skills/{category}/{name}/SKILL.md`），本蓝图 D4 只做"样本 → Skill 草稿候选"衔接，不实现蒸馏本身。

---

## 2. 现状代码锚点（事实基线）

| 能力 | 现状 | 锚点 |
|---|---|---|
| Agent run 行为序列沉淀（P1-A） | 已上线：send-stream 聚合 run 内真实动作，run 收口落盘为会话任务序列 | `src/server/agent-run-sediment.ts`；`src/server/habit-sequences.ts`（存储 `~/.hermes/habit-sequences/{profile}.json`，`configureHabitSequences({storeDir})` 测试注入） |
| 意图标签 | 已上线：会话任务意图分类，只产标签不落原文 | `src/utils/intent-classification.ts` |
| artifact.created 事件 | **仅到"对象事件层"**：透传 path 给执行账本预览并记入 run 动作节点，**无内容级素材登记** | `src/routes/api/send-stream.ts` L852-887（`noteArtifactCreated`）；`src/server/agent-run-sediment.ts` |
| 高频任务（P1-B） | 已上线（纯本地只读视图） | `src/server/high-frequency-tasks.ts` |
| 本地 Skill 容器 | 已有：`~/.hermes/skills/{category}/{name}/SKILL.md` 扫描与前端技能页 | `src/routes/api/skills.ts`；`src/screens/skills/` |
| 会话历史/记忆浏览 UI | 已有页面可作入口参考 | `src/screens/session-history/`、`src/screens/memory/` |
| 统一策略事件 / 授权守卫 | 已上线（权限治理链路） | `src/server/policy-telemetry.ts` 等 |

**结论**：所需原料（run 事件、意图、artifact 事件、本地路径）桌面端已具备；缺口仅在"内容级登记 + 授权 + 样本组织 + 脱敏"，且必须在**不改动 P1/账本/B2 链路**的前提下以"新增只读消费者"方式补齐。

---

## 3. 素材数据契约 v1（冻结给云端消费）

> 全部落盘于 `~/.hermes/distill/{profileName}/`（测试经 `configureDistillStore({storeDir})` 注入临时目录，沿用 habit-sequences 模式）。正文原文不落盘为可读文本：只保留「本地路径引用 + 脱敏快照（脱敏 util 产出，红线见 §5）」。
> 采集 Gate（共创两层补定）：契约产物属 **L2 共创沉淀通道**——`enabled` 默认 false 且仅由**云端共创账号授权**翻转（见 §6 授权通道），本地不提供用户自助开启；普通账号即使触发同一事件也不落任何样本。

### 3.1 DistillConfig（采集授权配置，每 profile 独立）
```ts
interface DistillConfig {
  enabled: boolean            // 默认 false（红线防线）；唯一翻转来源 = 云端共创账号授权（远端标记后置 true，本地无自助常开）
  profileName: string
  includeDirGlobs: string[]   // 授权目录，如 ['/home/u/legal/**']
  includeArtifactKinds: string[] // ['docx','pdf','md','txt','xlsx']（首期通用）
  redactOnCapture: boolean    // 采集即脱敏（默认 true）
  updatedAt: number
}
```

### 3.2 RequirementSample（需求输入样本 · 会话级，对应蒸馏 Step 1）
```ts
interface RequirementSample {
  version: 1
  sampleId: string
  profileName: string
  sessionKey: string
  runIds: string[]
  startedTs: number
  endedTs: number
  intent: { category: string; action: string; label: string | null } | null
  requirement: {              // 只取任务语义摘要，不沉淀对话原文
    text: string              // 用户首条任务指令脱敏后摘要（≤240 字）
    sourceRefs: string[]      // 引用的本地文件路径（授权目录内）
  }
  artifactIds: string[]
  revisionIds: string[]
  status: 'draft' | 'candidate'   // candidate = 具备≥1 交付物，可作蒸馏样本
}
```

### 3.3 DeliveryArtifactSample（交付物登记 · 对应交付物回传契约）
```ts
interface DeliveryArtifactSample {
  version: 1
  artifactId: string
  profileName: string
  sessionKey: string | null
  runId: string | null
  toolName: string            // 产出工具（artifact / write_file 等）
  fileName: string
  fileKind: string
  sourcePath: string          // 本地原文路径（不出本地）
  capturedAt: number
  sizeBytes: number
  checksum: string            // 内容指纹，用于修改链配对
  contentSnapshotPath: string | null  // 脱敏快照文件（§5），null=未授权正文快照
  redacted: boolean
}
```

### 3.4 RevisionPairSample（修改链 · 本人怎么改 = 最强纠偏信号）
```ts
interface RevisionPairSample {
  version: 1
  revisionId: string
  sampleId: string | null     // 关联需求样本
  baseArtifactId: string      // 初稿（Agent 产出）
  revisedArtifactId: string   // 本人改后稿（同源后续 artifact）
  diffSummaryPath: string     // diff 摘要（行级增减统计 + 关键改动短语），不存正文
  changedAt: number
  changeIntent: { category: string; action: string } | null  // 修正指令意图
}
```

---

## 4. 阶段拆解（D1→D6，含测试与验收）

> 影响边界总则（**约束 D1-D5 的 distill 采集模块；D6 个人沉淀提示不读 distill 配置、不在本总则约束内，见该阶段**）：**只新增模块与"只读消费者"，零改动**既有事件流 / habit-sequences / agent-run-sediment 行为 / run-ledger B2 / P1-B。所有写盘失败静默（不阻断决策链路，沿用 P1-A 纪律）。默认配置 enabled=false，任何模块在未授权时不产生数据；enabled 唯一翻转来源 = 远端共创授权（D1-D5 内部不提供任何用户常开入口，首案以测试注入/临时配置模拟授权，见 §6）。

### D1 交付物回传契约 + 授权配置 + 脱敏 v0（第一前置）
- 新增模块：
  - `src/server/distillation/distill-config.ts`：DistillConfig 读写（默认 enabled=false、redactOnCapture=true；enabled **不提供本地写 true 的公开方法**，仅由共创授权同步入口驱动，见 §6）；`configureDistillStore({storeDir})` 测试注入。
  - `src/server/distillation/redaction.ts`：脱敏 v0——按规则表剥离当事人姓名/证件号/电话/金额/律所与当事人专名占位；输入文本/文件 → 输出脱敏文本/快照文件。规则表后续按首案业务切面扩充。
  - `src/server/distillation/delivery-artifact-registry.ts`：`noteDeliveryArtifact(...)` 登记交付物（判定：路径在授权目录 + 扩展名在 includeArtifactKinds；生成 checksum；可选写脱敏快照）；`queryDeliveryArtifacts(...)`、`deleteDistillData(...)`（红线清理）。
- 接线（最小改动）：在 `src/routes/api/send-stream.ts` `artifact.created` 分支内、`noteArtifactCreated` 调用之后追加一行只读调用 `noteDeliveryArtifact(...)`（失败静默）。**不修改任何事件透传结构**。
- 测试：`src/test/distill-config.test.ts`、`src/test/redaction.test.ts`、`src/test/delivery-artifact-registry.test.ts`（覆盖：未授权不登记 / 授权目录登记 / 快照脱敏 / 静默失败 / 清理）。
- 验收勾选：
  - [ ] D1 交付物登记与脱敏可用（共创授权生效时自动采集），**非共创账号（默认态）零数据**
  - [ ] run-ledger B2 与既有链路零回归（`npm test` 全绿）
  - [ ] docs/changelogs/2026-09-09-* 改动说明 + 三份测试脚本

### D2 需求输入样本登记（样本对齐 · 蒸馏 Step 1）
- 新增 `src/server/distillation/requirement-sample-harvest.ts`：会话收口（run.completed / 会话结束点，由 D1 登记过的 artifact 反查会话）生成 RequirementSample；同一会话多 run 归并；≥1 交付物 → status='candidate'。
- 接线：与 D1 同源（sediment run 收口后的钩子处追加只读调用，不改造既有 appendAgentSequence 逻辑）。
- 测试：`src/test/requirement-sample-harvest.test.ts`（无交付物=draft / 多 run 归并 / 摘要≤240 / 不落原文断言）。
- 验收勾选：
  - [ ] D2 候选样本可生成并关联 artifactIds
  - [ ] 断言不沉淀对话原文
  - [ ] changelog + 测试脚本

### D3 修改链 diff（本人改稿纠偏信号）
- 新增 `src/server/distillation/revision-diff.ts`：同会话/同主题先后两次交付物（checksum 不同、路径同源）生成 RevisionPairSample；diff 摘要含行级增减统计 + 关键改动短语（复用/对齐 redaction 后再比对，避免专名干扰）。
- 触发：D1 registry 内同一 sample 的迭代登记时自动尝试配对（配对启发式：同会话 + 同文件名族 + 时间邻近）。
- 测试：`src/test/revision-diff.test.ts`（同源迭代配对 / 跨会话不误配 / diff 摘要不含正文敏感段）。
- 验收勾选：
  - [ ] D3 修改链可生成并回填 RequirementSample.revisionIds
  - [ ] 误配对为 0（用例断言）
  - [ ] changelog + 测试脚本

### D4 共创素材档案预览工作台（共创账号侧 · 养成感 + Skill 草稿衔接）
- 新增页面（入口位置待定，遵循"非必要不出现"，候选：设置/执行中心次级页，评审后再定）："我的交付档案"——按 profile 展示样本列表（需求摘要 / 交付物数 / 修改链数 / candidate 状态）、授权状态（来源 = 云端共创授权）与一键清理。
- 空态语义：未开通共创的账号（默认态）页面展示"未开通共创"说明，无样本数据、无引导常开入口（采集 Gate 见 §1/§3）。
- 衔接既有 Skills 体系：对 candidate 样本提供"生成 Skill 草稿"占位动作，产物写入 `~/.hermes/skills/distilled/{sampleId}/SKILL.md` 草稿目录（仅结构骨架 + 素材引用清单，**不实现蒸馏**，蒸馏加工属云端/后续）。
- 测试：逻辑层单测（查询/筛选/统计）+ UI 手工验收清单。
- 验收勾选：
  - [ ] D4 页面可查看/筛选样本与授权状态，入口克制
  - [ ] Skill 草稿占位目录可生成且不影响既有 skills 扫描（skills.ts 只扫 `{category}/{name}/SKILL.md`，distilled 目录结构兼容）
  - [ ] changelog + 测试脚本

### D5 授权与红线管理收口
- **共创授权状态视图**（取代"用户自设采集开关"）：只读展示采集状态（来源 = 云端共创授权）与范围（授权目录 / 文件类型 / 脱敏状态）+ 须知文案；普通账号展示"未开通共创"空态；一键清理（调 deleteDistillData，删除权红线）+ "停止共创采集"（清理本地样本，生效待远端吊销）。
- 会话内确认：requireExplicitApproval 支持 'session'（会话内二次确认后才登记正文快照，共创账号同样适用）。
- 回归收口：全量 `npm test`；把完成项回填《Ti 系列统一开发基线勾选清单.md》；按用户授权分批中文 commit。
- 验收勾选：
  - [ ] D5 授权状态视图可用（本地无"常开采集"入口）、默认关闭、清理即时生效、非共创账号零样本
  - [ ] 全量测试绿 + 勾选清单回填 + commit 分批完成

### D6 个人沉淀提示与 Skill 固化（L1 本地养成闭环 · 全员默认可用）

**定位**：把"越用越准"从被动画像升级为**主动能力闭环**——当 P1-B 高频任务画像达到可沉淀置信线时，向用户发起一次低打扰**主动咨询**，经预览确认后把该任务固化为**本地个人 Skill**（personal 分类，仅本机、可改可删），下次同类任务一句触发即可复用其习惯流程。**面向全部账号**：普通用户的习惯同样要沉淀（共创仅是 L2 额外上云通道），故本阶段不设共创 Gate、与 D1-D5 采集完全解耦。

**复用与零改动**：数据源 = 既有 habit-sequences 序列 + high-frequency-tasks 画像（均已上线）；新增两个模块 + 一个只读 route + 一个创建动作，不改任何既有事件流 / sediment 逻辑。

- 新增模块：
  - `src/server/distillation/skill-suggestion.ts`：**评估纯函数**（输入：高频画像 + 提示状态 → 输出待主动提示 / 待候选集合）+ **提示状态机**持久化 `~/.hermes/skill-suggestions/{profile}.json`（任务维度 status：`idle → suggested → dismissed(n) → candidate → converted/declined`，记录建议次数避免复弹）。
  - `src/server/distillation/personal-skill-writer.ts`：把 `HighFrequencyTaskProfile` 转写为 `~/.hermes/skills/personal/{slug}/SKILL.md`（任务名 + 触发示例语 + 步骤链模板 + 参数样例占位，**个人要素剥离**）；slug 由意图锚点/模板哈希派生；校验与既有 skills.ts 扫描兼容（personal 是否并入 `KNOWN_CATEGORIES` 见未决问题）。
- 只读 route：`GET /api/skill-suggestions`（当前待提示 + 候选清单，供 UI）；创建动作：`POST /api/skills/personal`（预览确认后写入 SKILL.md，校验重名/非法 slug）。
- 接线（零事件流改动）：前端在 run 收口/会话空闲处拉取待提示集合；dashboard 高频任务区展示"候选清单"；触发主动提示走**画布内顶部居中浮动小窗**（不占空间、Portal、约 20s 无操作自动收起，任务不丢、转候选）。
- 交互（三态闭环）：
  1. 轻提示小窗（仅执行型任务）：
     > "近 14 天你已按同一套流程完成 5 次「合同审查」。要不要固化成你的个人 Skill？之后一句『按我的习惯审这份合同』即可复用，产出会保留你的版式与自查习惯，随时可改可删。"
     > 按钮：`[稍后再说]` `[看看预览]`（无对抗性"拒绝"文案；稍后即转候选清单）
  2. 预览抽屉：任务名（可改）/ 触发示例语（可改）/ 覆盖次数与最近执行时间 / 步骤链预览（剥离个人要素）/ 生成位置说明。
  3. 确认创建 → personal Skill 生效 → 技能页可见可管理可删除。
- **默认触发参数 v1**（产品口径，随真实样本校准）：去重后出现次数 ≥5；且（跨自然日 ≥2 天 或 步骤模板覆盖率 1.0 稳定）二者其一；同任务冷却 1 天、每周全局提示 ≤2 条；用户忽略 ≥2 次后该任务转候选、不再主动弹；观察窗口沿用画像默认 30 天。
- 测试：`src/test/skill-suggestion.test.ts`（阈值触发 / 冷却与周上限 / 忽略 2 次转候选 / 状态机幂等与落盘）；`src/test/personal-skill-writer.test.ts`（SKILL.md 结构 / 个人要素剥离断言 / 与 distill 采集目录互不共享 / 重名与非法名防护）。
- 验收勾选：
  - [ ] 非共创账号（默认态）可完整走通"提示 → 预览 → 固化 → 技能页可删"的 L1 闭环（解耦验证）
  - [ ] 提示频控符合 v1 参数（同任务日 ≤1、周 ≤2），忽略后不再打扰
  - [ ] 生成 Skill 被既有技能页正确扫描展示，skills.ts 零回归；distill（L2）采集目录零数据（D1-D5 红线不被 D6 破坏）
  - [ ] changelog + 测试脚本

---

## 5. 隐私红线与脱敏（贯穿 D1-D6）

- 对话原文：不沉淀（沿用行为资产方案 3.2）；RequirementSample 仅存任务语义摘要（≤240 字）。
- 交付正文：不落可读全文——默认 redactOnCapture=true，只保留脱敏快照与本地路径引用；涉密文档（当事人/客户）不得以正文形式上云，本地快照也先脱敏。
- 删除权：一键清理即时删除 `~/.hermes/distill/` 全量数据。
- 采集默认关闭 + 账号级 Gate：enabled 默认 false 且**本地无用户自助常开入口**（共创账号由云端授权自动翻转，普通账号始终零样本），是隐私与治理双防线；本地仍保留删除权（一键清理）与 D5 授权状态查看。
- **D6 个人 Skill 模板**：只写"泛化步骤链 + 触发示例语 + 参数样例占位"，个人要素剥离，不落对话原文与交付正文；用户可随时在技能页删除（删除权一致）。

---

## 6. 与云端（Ti Work 配套云端管理端 / Ti Mind 能力 / OPC 治理）的衔接点

- 冻结 §3 素材数据契约 v1（RequirementSample / DeliveryArtifactSample / RevisionPairSample JSON），供云端 L1/L2 蒸馏、影子比对与 OPC 上架消费；执行始终在桌面，云端只收"规范要素 + 统计"级数据。
- **共创授权通道（驱动采集的唯一来源）**：DistillConfig.enabled 仅由云端"账号 → 共创角色"标记翻转；首案阶段（云端侧未建）以本地授权配置文件 + 测试注入模拟该通道，随 6.6.11-U 网络登录改造批接入真实账号判定；本蓝图只预留授权同步入口与"吊销即停采、清理本地样本"语义，不实现云端侧。
- 本蓝图不开发云端侧；如云端侧需桌面透出样本登记状态，可经既有事件回流链路（P1 遥测）只读暴露计数，不进正文。

---

## 7. 未决问题（随 D1-D5 评审确认）

- [ ] D4 工作台入口位置与导航收口方式（候选：设置次级页 / 执行中心次级页）；
- [ ] 首案交付物类型与文件 kind 白名单（先通用 docx/pdf/md/txt/xlsx，待律所切面确认后收敛）；
- [ ] 脱敏规则词表来源（内置通用规则 v0 + 首案业务规则扩充）；
- [ ] D3 修改链配对启发式阈值（时间窗/文件名族相似度）需用真实样本校准；
- [ ] 是否需要会话内二次确认（requireExplicitApproval='session'）进首案范围；
- [ ] 共创授权过渡实现：首案"本地授权配置文件模拟远端授权"的形态与安全边界（防普通用户自行改配置开启采集），以及随 6.6.11-U 接入真实账号判定前的验收口径。
- [ ] D6 提示默认参数（≥5 次 / 跨 ≥2 天 / 周 ≤2 条）是否需按真实样本校准；提示文案的"近 14 天 / 5 次 / 任务名"由画像哪些字段驱动（occurrenceCount / lastTs / intentLabel）；
- [ ] D6 主动提示的展示时机与入口收口：会话收口空闲小窗与工作台高频任务区候选清单的协同、疲劳上限与"本周不再打扰"机制（对齐"是否主动咨询尤为重要"的产品诉求）；
- [ ] D6 personal Skill 的生成 schema 与既有 skills.ts 扫描兼容：personal 分类是否并入 `KNOWN_CATEGORIES` 枚举、slug 命名与既有 category/name 扫描约束的冲突面。
