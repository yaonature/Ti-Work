# Ti Work 企业级 AI Agent 二开方案（修订版 v7）

> 给团队成员的阅读提示：
> - 这份文档回答的是：**Ti Work 要在 Hermes-Studio 基础上往哪里二开、重点增量是什么、实施上优先做什么**
> - 如果你想先知道产品最终要做成什么，请先看 [Ti Work 企业日常办公平台规划.md](./Ti%20Work%20%E4%BC%81%E4%B8%9A%E6%97%A5%E5%B8%B8%E5%8A%9E%E5%85%AC%E5%B9%B3%E5%8F%B0%E8%A7%84%E5%88%92.md)
> - 如果你想先知道哪些能改、哪些不能改，请先看 [Ti Work 项目架构与二开边界说明.md](./Ti%20Work%20%E9%A1%B9%E7%9B%AE%E6%9E%B6%E6%9E%84%E4%B8%8E%E4%BA%8C%E5%BC%80%E8%BE%B9%E7%95%8C%E8%AF%B4%E6%98%8E.md)

## 先看这页

### 这份文档是做什么的

这不是一份“底座源码介绍”，也不是一份“产品愿景文档”。

它的定位更直接：

- 告诉团队 Ti Work 这次二开到底要做哪些真正有商业价值的增量
- 告诉团队哪些是开源底座已经有的，哪些是我们必须自己补的
- 告诉团队后续研发应该把时间花在哪些模块上，而不是继续发散

### 团队成员读完后，应该得到什么结论

读完这份文档，团队应该能立刻回答下面几个问题：

1. Ti Work 和开源 Hermes-Studio 的关系是什么
2. 二开最重要的增量到底是哪几块
3. 这些增量里哪些是产品价值，哪些只是工程支撑
4. 研发投入的优先级应该怎么排

### 一句话结论

Ti Work 当前真正值得投入的二开主线，不是继续堆分散功能，而是围绕下面几件事收口：

1. 桌面端首装与执行引擎稳定
2. 企业办公主路径与菜单收口
3. 权限、审计、流程、血缘这些企业级能力
4. 品牌化、中文化与交付质量

### 推荐阅读顺序

1. 先看“项目核心定位”
2. 再看“现状盘点”
3. 最后看“核心二次开发功能清单”

如果你不是架构负责人，可以先跳过前面的长版本修订说明，直接从“项目核心定位”开始读。

> 修订说明（v7）：**品牌化与全中文界面决策（国内交付）**——用户安装后首屏仍显示英文 "Welcome to Hermes Studio"。定位残留：onboarding 欢迎页（`hermes-onboarding.tsx`）、连接启动屏（`connection-startup-screen.tsx`）、帮助文档（`docs-screen.tsx`）、系统标题/manifest 等。决策：**界面文案全部中文（硬编码中文化，不引入 i18n 框架**——国内交付无多语言需求，200+ 组件全量抽取改造成本高、破坏风险大）；**用户可见品牌全部 Ti Work**，引擎协议/内部标识维持 hermes（4.5 边界不变）。8.3 新增 **G10 品牌化与中文化**（含中文术语表与关键路径清单），定位 **G1 品牌/主题后实施**。
> 修订说明（v6）：**G7 企业版中枢核心完成 + G9 团队模式库纳入方案**——G7 在独立仓库 `Ti-Work-Web/` 实施完成核心（已排除防误提交开源仓库）：Ed25519 验签引擎、订阅 + 浮动席位（N 并发 + heartbeat）、宽限期降级、功能裁剪（featureSet 下发）、租户/账号/RBAC、血缘汇聚 + 审计落库（`tenant/device/seq` 幂等）、管理控制台、平台管理员 bootstrap；门禁 lint 0 / typecheck 0 / vitest 26 passed / web build 通过。同步修订 7.1 版本功能矩阵（新增**团队模式库**行）、8.3 实施步骤（新增 G9）、8.6 进度记录（G7/G8/G9 拆分）。G9 团队模式库（企业专家）定位为 **G8 数据跑通后实施**。
> 修订说明（v6）：**G7 企业版中枢核心完成 + G9 团队模式库纳入方案**——G7 在独立仓库 `Ti-Work-Web/` 实施完成核心（已排除防误提交开源仓库）：Ed25519 验签引擎、订阅 + 浮动席位（N 并发 + heartbeat）、宽限期降级、功能裁剪（featureSet 下发）、租户/账号/RBAC、血缘汇聚 + 审计落库（`tenant/device/seq` 幂等）、管理控制台、平台管理员 bootstrap；门禁 lint 0 / typecheck 0 / vitest 26 passed / web build 通过。同步修订 7.1 版本功能矩阵（新增**团队模式库**行）、8.3 实施步骤（新增 G9）、8.6 进度记录（G7/G8/G9 拆分）。G9 团队模式库（企业专家）定位为 **G8 数据跑通后实施**。
> 修订说明（v5）：**授权模型终版**（对照行业最佳实践最终评审后落定）——免费版由"本地计数配额"改为**功能裁剪**（按功能集本地授权，7.1 版本功能矩阵定义，符合桌面软件惯例，避免免费用户配额焦虑）；企业版席位改为**浮动许可**（N 并发 + heartbeat，行业标准）；私有化版改**一次性买断 + 年维护费（15-20%）**（政企 CapEx 采购标准）；本地验签统一 **Ed25519**（FIPS 186-5）。同步修订第一章三形态表、5.2 授权矩阵、七章定价、8.3 G7、8.6 进度记录。
> 修订说明（v4）：**商业化授权模型定型**——三形态交付：① 在线单机版（需 License 云端控制订阅/有效期，断网宽限期降级；免费版配额**本地计数+登录激励**，评审确认云端强制门槛高、无商业收益）；② 企业版（独立仓库中枢）；③ 完全离线版（授权文件验签 ，零在线依赖）。授权验证抽象为**本地验签引擎**（公钥验签），三形态共用，仅授权获取通道不同。同步修订第一章、5.2 授权矩阵、第七章定价、8.1 版本形态、8.3 G7。
> 修订说明（v3）：新增**双版本战略**——单机版（G0-G6，交付无需云端控制端）与企业版（G7-G8，独立仓库云端中枢：租户/席位/许可证/账号鉴权/血缘汇聚/审计/管理控制台；桌面端登录与有效期受中枢控制，离线降级+联网补报）；同步修订第一章定位、第四章 4.5 品牌改造边界、第五章企业版架构、第六章功能清单、第七章定价映射、8.1 技术基线与 8.3 实施步骤。
> 修订说明（v2）：在 v1（代码核验修订）基础上新增：① CC Switch 品牌配色方案（已从 farion1231/cc-switch 仓库核验色值）；② 主题系统支持性结论（支持，附改动点）；③ 实施路径从"分阶段 MVP"改为"一步到位商业化实施计划"——架构、数据模型、主题、桌面壳全部第一天按最终形态定型，避免中途换方案返工。
> 核验依据：Hermes-Studio v1.20.0（`package.json`/`README.md`/`src/server/`/`src/lib/theme.ts`/`src/styles.css`/`docs/MULTI_USER_ROADMAP.md`/`LICENSE`）；CC Switch（`github.com/farion1231/cc-switch` 的 `tailwind.config.cjs` + `src/index.css`）。

---

## 一、项目核心定位

你要做的是面向企业的 AI Agent 商业软件，命名为 "Ti Work"，按**双版本战略**交付：

| 版本 | 形态 | 技术构成 | 目标 |
|---|---|---|---|
| **单机版（在线授权）** | 个人/小团队本地部署 | 桌面端 + 本地 Node 后端一体（G0-G6）；**需连 License 云端**校验订阅/有效期（断网宽限期降级），免费版按功能集**本地授权（功能裁剪）**，**无需企业级中枢** | 免费引流、标准版订阅 |
| **企业版**（未来主要盈利方向） | 多员工部署，**必须配置云端中枢端** | 桌面端（登录受中枢控制 + 事件上报）+ **云端中枢**（独立仓库：租户/席位/许可证校验/账号鉴权/血缘汇聚/审计/管理控制台） | 专业版、金融/政务合规 |
| **离线交付版** | 完全不联网内网部署（政务/生产网） | 桌面端 + 本地授权（**授权文件验签**）；血缘/审计全部本地；零在线依赖 | 私有化版主力客户 |

核心定位：基于开源 AI Agent 底座，打造"企业人机协作流程管理系统"。它不仅是个人的AI助理，更是跨部门协同的调度中心。

核心价值：解决企业的"黑匣子"恐惧（安全合规）和"重复造轮子"浪费（资源协同），让管理者能看清 50 个员工分别让 AI 做了什么、工作流衔接是否顺畅——**这一价值只有企业版中枢才能兑现**：单机版血缘/审计数据落在各员工本地，无法形成管理者视角的全局视图。

---

## ⚖️ 二、法律合规与开源选型

底座选型：JPeetz/Hermes-Studio（MIT 许可证，已核验 [LICENSE](../LICENSE)）。

| 事项 | 结论 |
|---|---|
| 许可证 | MIT，允许自由修改、闭源、商业化销售，唯一义务是保留原始版权声明（含 hermes-workspace 的版权段） |
| 商标 | "Ti Work" 不与 Hermes 官方商标冲突 |
| 视觉借鉴 | CC Switch 仅借鉴其配色感觉（配色本身不受版权保护），不复制其布局和代码 |

---

## 🧭 三、现状盘点（代码核验结论，二开前必读）

| 维度 | 现状 | 对二开的影响 |
|---|---|---|
| 应用形态 | **Web 应用**（Vite + React 19 + TanStack Router + **PWA**），非 Electron；Electron 仅列于官方 Roadmap（Planned） | 商业化桌面形态需自建壳：推荐 **Electron 壳包装现有构建产物**（Node 生态，团队强项；不选 Tauri，避免引入 Rust 工具链） |
| 后端形态 | Node/TypeScript 单仓库，自带服务端 [server-entry.js](../server-entry.js) + `src/server/` | 业务后端直接在此层扩展，**无需另起 Java/Python 后端**（避免重复对接 Hermes gateway 8642） |
| 智能体引擎 | 真正执行 agent 的是 **Hermes Agent**（Python / NousResearch），Hermes-Studio 是控制面板 | 企业化改造以"控制面板 + 调度层"为主，不改引擎 |
| Redis | **已内置**（ioredis），用于会话/Token 持久化（[redis-client.ts](../src/server/redis-client.ts)），前端不直连、只调自身后端 API | 与方案架构一致；但 **Redis Streams / 消费组 / 任务血缘是全新工作** |
| 可视化配置 | **大部分已实现**：模型 Providers 向导、MCP 管理、权限与工具集、平台集成（Telegram/Discord/Slack/Signal/**WeCom**）、systemd 自启动等设置页均存在 | 只需补**飞书/钉钉**集成页与品牌化设置 |
| RBAC | Phase 1 已实现：用户档案（[user-profiles.ts](../src/server/user-profiles.ts)）、Token→用户映射、任务按角色过滤、Redis 持久化 | Phase 2 缺口：用户管理 UI、注册/登录、角色隔离扩展到其他 API、管理员分配页（见 [MULTI_USER_ROADMAP.md](../docs/MULTI_USER_ROADMAP.md)） |
| 审计存储 | **已有** Audit Trail 页面 + SQLite 事件库（[event-store.ts](../src/server/event-store.ts)，`.runtime/events.db`）+ `/api/audit` + Analytics | 50 人规模 SQLite 够用，**决策即终局**：不设"先 SQLite 后迁 PG"的过渡方案 |
| 协同与看板 | **已有** Conductor V2（任务编排/办公室视图/成本追踪）、Operations 统一视图、Crews 多智能体、Kanban、Analytics | 跨员工"任务血缘甘特图"是唯一需要新开发的看板能力 |
| 主题系统 | 已有 8 主题 + CSS 变量组机制（`--theme-*` 约 40 个变量，`--color-*` 自动派生），主题注册于 [theme.ts](../src/lib/theme.ts) | **支持新增 CC Switch 品牌主题**（详见第五章），改动点明确 |

**一句话结论：底座是"成熟控制面板 + 成熟协同引擎"，二开真正增量集中在四件事——CC Switch 品牌主题、多用户 RBAC 落地、Redis Streams 任务血缘、管理驾驶舱视图。**

---

## 🎨 四、CC Switch 品牌配色方案（色值已核验）

> 来源：CC Switch（[ccswitch.io](https://ccswitch.io/) / farion1231/cc-switch，Tauri 2 + React + Tailwind 桌面应用）的 `src/index.css`（shadcn 风格 HSL 变量）与 `tailwind.config.cjs`。以下色值由 HSL 换算为 HEX，并已与上游源码逐一比对核验（2026-08-12）。
>
> ⚖️ 版权说明：CC Switch 为 **MIT 许可**（Copyright 2025 Jason Young），配色/设计语言参考无版权风险（且色值本身不受版权保护），可放心应用。

### 4.1 设计语言总结（"舒服"的来源）

| 特征 | 具体做法 |
|---|---|
| 底色 | 中性偏灰的深色 `#1D1D20`（非纯黑、非蓝调，长时间注视不刺眼） |
| 主色 | 单一明亮品牌蓝 `#0A84FF` 系，不杂、不抢，用于按钮/高亮/选中 |
| 层级 | 背景/卡片/边框三段灰度（12%→16%→24%），靠明度差分层而非描边 |
| 质感 | 玻璃拟态（glassmorphism）：半透明白 + `backdrop-blur` + 微弱 145° 渐变 + 柔和投影 |
| 字体 | 系统字体栈（SF / Segoe UI / Roboto），圆角 0.5rem~0.875rem |

### 4.2 核心色板

| 角色 | 深色模式 | 浅色模式 | 用途 |
|---|---|---|---|
| 背景 background | `#1D1D20` | `#FFFFFF` | 全局底色 |
| 前景/主文本 foreground | `#FAFAFA` | `#09090B` | 主文本 |
| 卡片 card / popover | `#27272B` | `#FFFFFF` | 卡片、弹层 |
| 次级背景 secondary/muted/accent | `#2C2C30` | `#F4F4F5` | 悬停、区块 |
| 次级文本 muted-foreground | `#A1A1AA` | `#71717A` | 辅助说明 |
| 边框 border / input | `#3A3A40` | `#E4E4E7` | 分割线、输入框 |
| **主色 primary / ring** | `#148AFF` | `#1F8FFF` | 按钮、焦点环、选中态 |
| 危险 destructive | `#7F1D1D` | `#EF4444` | 删除、报错 |

### 4.3 品牌蓝梯度与语义色

| 类型 | 色值 | 用途 |
|---|---|---|
| 品牌蓝 400 / 500 / 600 | `#409CFF` / `#0A84FF` / `#0060DF` | 图标渐变、强调、深色态主操作 |
| 成功 success | `#10B981`（浅底 `#D1FAE5`） | 成功提示（浅色底 + 500 级前景，柔和） |
| 危险 danger | `#EF4444`（浅底 `#FEE2E2`） | 错误提示 |
| 警告 warning | `#F59E0B`（浅底 `#FEF3C7`） | 警告提示 |
| 玻璃卡片（深色） | 底 `rgba(255,255,255,0.05)` + 145° 渐变 + `blur(20px)` + 边框 `rgba(255,255,255,0.05)` + 投影 `0 8px 32px rgba(0,0,0,0.37)` | 主界面卡片 |
| 选中态（玻璃） | 底 `rgba(59,130,246,0.12)` + 边框 `rgba(59,130,246,0.3)` | 选中卡片 |
| 圆角 | sm 0.375rem / md 0.5rem / lg 0.75rem / xl 0.875rem | 组件圆角 |

### 4.4 主题系统支持性结论：**支持，按设计即为"新增主题"**

Hermes-Studio 主题机制是 **CSS 变量组 + `data-theme` 注册**（[theme.ts](../src/lib/theme.ts) 的 `THEMES` 数组 + [styles.css](../src/styles.css) 的 `[data-theme='xxx']` 变量块，`--color-primary-*` / `--color-accent-*` 等已自动从 `--theme-*` 派生），新增主题无需改架构。需做 4 件事：

| # | 改动点 | 工作量 |
|---|---|---|
| 1 | [theme.ts](../src/lib/theme.ts)：`ThemeId` 增加 `ti-work`，`THEMES` 数组加一条（label "Ti Work"，icon），并设为 `DEFAULT_THEME` | 低 |
| 2 | [styles.css](../src/styles.css)：新增 `[data-theme='ti-work']` 变量块，将 4.2 色板映射到现有 `--theme-bg/sidebar/panel/card/border/text/muted/accent/...`（约 40 个变量，含浅色态）；同步玻璃拟态变量 | 低 |
| 3 | [styles.css](../src/styles.css)：**必须处理约 10+ 处硬编码绑定 `[data-theme='hermes-os']` 的选择器**（如 142-144 行 kpi-card hover、701 行 agent-status-strip、1041-1062 行侧栏与 bg-accent 变体），它们只在 hermes-os 下生效，需泛化为 `[data-theme='hermes-os'],[data-theme='ti-work']` 或抽公共类 | 中 |
| 4 | 品牌资产：应用名 "Ti Work"、favicon/logo、PWA manifest、系统标题、登录页文案 | 低 |

> 结论：**原生支持，不需要推翻主题架构**；唯一需要额外注意的就是第 3 点（主题专属选择器泛化），这也是"能不能完全生效"的关键。

### 4.5 品牌改造边界（hermes 保留 vs 改为 Ti Work）

| 类别 | 处理 | 依据 |
|---|---|---|
| **LICENSE 版权段**（含 hermes-workspace 版权段） | **必须保留，不改** | MIT 唯一义务，删除即违法 |
| **来源声明**：`package.json` 的 `author` / `repository` / `homepage` / `bugs` 指向 JPeetz/Hermes-Studio | **必须保留，不改** | 源码出处声明，删除等同冒用他人作品 |
| **执行引擎与技术协议**：Hermes Agent / Hermes Gateway 8642、`~/.hermes` 配置路径、`HERMES_API`、`/api/hermes-proxy` | **必须保留，不改** | Ti Work 是控制面板而非引擎，协议标识与引擎对接，改名破坏兼容 |
| **用户可见品牌**：应用名 "Ti Work"、安装产物名、系统标题、PWA manifest、favicon/logo、登录页文案、帮助文档页（`docs-screen.tsx` 用户可见文案）、`package.json` `description` | **改为 Ti Work** | 商业品牌面，专业版以上客户不可见 hermes 品牌 |
| **用户可见界面文案**（国内交付） | **全中文**（硬编码中文化，不引入 i18n 框架） | 国内交付使用者为中文用户；安装即全中文是交付基本门槛（详见 4.6 与 G10） |
| **内部标识**：`localStorage` key（`hermes-studio:*`）、Redis key 前缀、docker-compose 服务名、代码注释 | **不迁移（保持原样）** | 迁移导致用户设置/数据丢失、服务编排失配；对用户不可见，无品牌暴露 |

> 边界一句话：**法律与引擎的归属必须诚实保留（这是开源二开的合法前提），面向用户与交付物的品牌全部 Ti Work；内部标识不迁移（零收益高风险）。**

### 4.6 中文化与品牌化落地（国内交付）

> 背景：用户安装包后首屏仍显示英文 "Welcome to Hermes Studio"（[hermes-onboarding.tsx](../src/components/onboarding/hermes-onboarding.tsx) 502-506 行）。前端 200+ 组件、18 个 screen 均为英文硬编码，无 i18n 系统。

| 决策点 | 结论 | 理由 |
|---|---|---|
| 界面语言 | **全中文（硬编码中文文案，不引入 i18n 框架）** | 国内交付无多语言需求；引入框架需改造 200+ 组件、破坏风险大，违背最少复杂度原则 |
| 品牌呈现 | 用户可见文案全部 "Ti Work"；Hermes Gateway/引擎协议/内部标识维持原样 | 4.5 品牌边界不变（法律与引擎归属必须诚实保留） |
| Hermes 淡化（用户可见） | 统一使用技术名词提法 **"Hermes 执行引擎（网关）"**；登录屏标注 **"基于 Hermes 开源引擎构建"**（附上游仓库链接） | Hermes 从品牌降格为技术名词，降低国内用户突兀感，同时保留开源引擎归属（2026-08-10 已落地：onboarding/连接启动屏/登录屏 10 处） |
| 术语一致性 | 全仓使用统一中文术语表（下表），作为中文化对照依据 | 术语不一致是中文交付专业感的最大杀手 |
| 落地方式 | 关键路径先行（G10-1）→ 全量 18 screens（G10-2）→ 帮助文档（G10-3）→ 品牌残留收尾（G10-4） | 用户第一印象（欢迎/启动/登录）优先，每步均可独立验收 |

**中文术语表（节选，全表随 G10 实施落地）**：

| 英文 | 中文 | 英文 | 中文 |
|---|---|---|---|
| Session | 会话 | Crew | 多智能体小组 |
| Memory | 记忆 | Conductor | 任务编排 |
| Skill | 技能 | Lineage / 血缘 | 任务血缘 |
| Terminal | 终端 | Audit | 审计 |
| Approval | 审批 | Analytics | 分析 |
| Provider / Model | 模型服务商 | Gateway | 网关 |
| MCP | MCP | Onboarding | 新手引导 |
| Kanban | 看板 | Dashboard | 驾驶舱 |
| Settings | 设置 | Profile | 用户档案 |

---

## 🛠️ 五、技术架构（修订：两层为主，四层可选）

```
┌─────────────────────────────────────────────────────┐
│ 客户端层（员工）—— Web/PWA 内核 + Electron 壳（一步到位）│
│  Electron 主进程加载现有构建产物；托盘/开机自启/原生通知 │
│  只调自身后端 API，不直连 Redis                        │
├─────────────────────────────────────────────────────┤
│ 业务后端层（唯一调度/存储通道）— 在 Hermes-Studio 现有    │
│  Node server 上扩展（src/server/）                     │
│  · 身份校验 / RBAC（扩展 auth-middleware）             │
│  · 任务路由 / 血缘记录（新增 Redis Streams）            │
│  · 审计写入（现有 event-store）                        │
│  · 现有：Redis 会话持久化、Hermes gateway 代理          │
├─────────────────────────────────────────────────────┤
│ 存储层                                               │
│  Redis：会话 + Streams（血缘消息，消费组）              │
│  SQLite（现有）：事件/审计（决策即终局，不迁 PG）        │
└─────────────────────────────────────────────────────┘
```

> 上图即**单机版**形态：桌面端与本地后端一体，交付无需云端控制端。

### 5.1 企业版架构（云端中枢，独立仓库）

企业版为 Hub & Spoke 形态：任务执行留在各员工桌面端（本地 gateway 8642，模型调用靠近用户、可离线），中枢只做"**控制 + 汇聚**"：

```
┌─────────────────────── 员工桌面端（Spoke）───────────────────────┐
│ 桌面端（Web/PWA + Electron 壳）→ 本地 Node 后端（单机版同构）        │
│  · 登录：向中枢校验 token / 席位 / 使用有效期（启动时 + 定期）        │
│  · 执行：聊天/任务/Agent 仍在本地（gateway 8642），断网降级可用       │
│  · 上报：血缘事件 + 审计事件 → 中枢（带 tenant/device/seq，联网补报） │
└──────────────┬──────────────────────────────────────────┬─────────┘
               │ HTTPS（事件上报/鉴权校验）                  │ HTTPS（管理）
               ▼                                          ▼
┌─────────────────────── 云端中枢（Hub，独立仓库）────────────────────┐
│  · 租户 / 席位 / 许可证 / 账号鉴权 / 使用有效期（商业控制点）           │
│  · 血缘汇聚（Redis Streams，多实例写入，复用 G3 模型 + tenant 分片）   │
│  · 审计存储（SQLite，每企业一实例；私有化部署形态）                    │
│  · 管理控制台（管理员浏览器）：全局驾驶舱/血缘甘特图/合规可查/角色下发   │
└──────────────────────────────────────────────────────────┘
```

关键边界（设计硬约束）：

| # | 决策 | 原因 |
|---|---|---|
| 1 | 任务执行不上中枢，中枢只收事件 | 网关在员工本地，中枢无法穿透 NAT 直连；避免跨端调度复杂度 |
| 2 | 账号/席位/有效期由中枢硬控制 | 商业控制点，放本地可被篡改绕过 |
| 3 | 离线降级 + 联网补报 | 断网时桌面端本地可用；上报事件带本地单调 `seq`，中枢按 `tenant+device+seq` 幂等去重 |
| 4 | 多租户隔离 | 血缘/审计按 `tenant` 分片，防止跨企业数据串 |
| 5 | 中枢为独立仓库 | 单机版（Hermes-Studio 二开）与企业版中枢不互相污染；复用方式为共享 G3 血缘模型与 identity 纯逻辑 |

### 5.2 三种交付形态与授权矩阵

| 交付形态 | 授权方式 | 配额 | 续费 | 数据归属 |
|---|---|---|---|---|
| 在线单机版（免费/标准） | 云端订阅，**本地 Ed25519 验签** | **功能裁剪**：免费版按功能集本地授权（对话/记忆/技能/终端/审批/模型/MCP），标准版解锁集成/编排/多智能体 | 在线续订 | 全部本地 |
| 企业版（专业版/私有化） | 中枢校验**浮动席位**（N 并发 + heartbeat）/有效期 | 无（并发上限由席位控制） | 席位续费 | 桌面端执行、中枢汇聚 |
| 完全离线版（私有化内网） | **授权文件验签**（绑定机器指纹） | 无（授权文件控制"有效期 + 功能集"） | 新授权文件（人工交付） | 全部本地/内网 |

> 关键设计：授权验证抽象为**本地验签引擎**（Ed25519 验签，私钥仅在厂商侧）。三种形态共用同一验签逻辑，仅"授权获取通道"不同：在线拉取 / 授权文件导入。离线版无订阅义务、无按次配额，授权文件控制有效期与功能集。

| 层级 | 技术方案 | 职责 |
|---|---|---|
| ① 客户端 | Web/PWA 内核 + **Electron 壳**（electron-builder 出 exe/dmg/AppImage） | 展示界面、调用本地模型（经后端代理）、操作本地文件；不直连 Redis，只调后端 API |
| ② 业务后端 | **复用现有 Node/TS server**（`src/server/`） | 身份校验、RBAC、任务路由、读写 Redis/SQLite，唯一访问 Redis 的通道 |
| ③ 通信层 | **新增** Redis Streams（ioredis 已支持，无需新库） | 消息持久化、消费组管理、记录"谁发给谁、读了没"；50 人规模足够轻量且不丢消息 |
| ④ 审计存储 | 沿用 SQLite（现有，决策即终局） | 存储任务血缘、操作日志，供管理者生成甘特图报表与审计记录 |

---

## ✨ 六、核心二次开发功能清单（对标企业交付）

| 模块 | 现状 | 需开发内容 | 商业价值 | 难度 |
|---|---|---|---|---|
| **CC Switch 品牌主题** | 已有 8 主题系统 | 新增 `ti-work` 主题（4.4 节的 4 项改动），默认激活，打 "Ti Work" 品牌 | 与开源版拉开视觉差距，专业感 | 低~中 |
| 可视化配置菜单 | 模型/MCP/权限/平台集成设置页已存在 | 补飞书/钉钉集成页 + 品牌化 Settings 入口 | 降低使用门槛 | 低~中 |
| RBAC 权限管理 | Phase 1 已实现（用户档案/角色/任务过滤） | Phase 2：用户管理 UI、注册登录、角色隔离扩展到 sessions/chat 等全部 API、管理员分配页 | 解决企业数据安全与权限管控核心顾虑 | 中~高 |
| 智能体通信层 | Redis 仅做会话 KV | **新增** Redis Streams + 血缘 API：跨部门任务流转、血缘关系、耗时卡点记录 | "驾驶舱视图"是区别于个人版的杀手锏 | 中~高 |
| 可观测性看板 | 已有 Operations/Conductor/Analytics/Kanban | **新增** 跨员工任务血缘视图（甘特图/流程图，recharts 已内置） | 审计与决策依据，企业愿意为"管理抓手"付高价 | 中 |
| 审计与历史 | 已有 Audit Trail + SQLite event store | 血缘数据模型补充（沿用 SQLite） | 满足金融/政务合规 | 中 |
| **企业版云端中枢** | 无（方案外独立增量，独立仓库） | 租户/席位/许可证/账号鉴权/使用有效期 + 血缘汇聚（多实例写入）+ 审计汇聚 + 管理控制台（全局驾驶舱/血缘甘特图/合规可查/角色下发） | 商业化主力，企业版盈利核心 | 高 |
| **品牌化 + 全中文界面** | 部分完成（ti-work 主题、logo、登录页、系统标题） | onboarding 欢迎页 "Welcome to Hermes Studio" 等英文残留替换为 Ti Work 中文文案；全量 18 screens 中文化（4.6 术语表）；docs 帮助页中文化；品牌残留全仓清理 | 国内交付必需（用户安装即中文、零英文可见文案） | 低~中 |

### 6.1 内置商务智能体方案（待实施，用户确认后开工）

> 背景：`AGENT_PERSONAS`（[agent-personas.ts](../src/lib/agent-personas.ts)）内置 8 个人设全部为开发向（前端/后端/QA/运维/研究/全栈/安全/营销）。商务办公用户（财务/HR/行政/文秘）无对应人设，任务会被哈希随机分配到开发人设，观感错位。以下三方案按需组合实施。

**方案 A —— 新增商务智能体人设（示例 5 个）**

在 `AGENT_PERSONAS` 数组追加（含英文 `key`，与方案 C 配套）：

```ts
{ key: 'erin',   name: '艾琳', role: '财务分析师', emoji: '💼', color: 'text-teal-400',
  specialties: ['finance','budget','cost','invoice','tax','expense','forecast','revenue','accounting','report'] },
{ key: 'wendy',  name: '温迪', role: '人力资源专家', emoji: '🤝', color: 'text-pink-400',
  specialties: ['hr','recruit','interview','onboard','talent','salary','benefit','org','culture','training'] },
{ key: 'oscar',  name: '欧阳', role: '商务写作', emoji: '✍️', color: 'text-indigo-400',
  specialties: ['proposal','contract','email','report','memo','meeting','minutes','pitch','document','writing'] },
{ key: 'sophie', name: '苏菲', role: '行政助理', emoji: '🗓️', color: 'text-violet-400',
  specialties: ['schedule','calendar','travel','booking','logistics','event','agenda','coordinate','arrange'] },
{ key: 'della',  name: '黛拉', role: '数据分析师', emoji: '📊', color: 'text-sky-400',
  specialties: ['data','analytics','statistics','excel','dashboard','kpi','visualization','insight','sql','trend'] },
```

增删人设必须四处同步（否则出现空提示词或错误回退）：

| # | 文件 | 现状与改动 |
|---|---|---|
| 1 | [agent-personas.ts](../src/lib/agent-personas.ts) | `AGENT_PERSONAS` 数组增删人设；建议 `AgentPersona` 增加 `key` 英文标识（方案 C） |
| 2 | [agent-definitions-store.ts](../src/server/agent-definitions-store.ts) | `BUILTIN_SYSTEM_PROMPTS` 键为英文 `key`；当前 `getBuiltInAgents()` 用 `p.name.toLowerCase()`（中文名）永远匹配不上英文键 → **内置智能体提示词恒为空（现存 bug，方案 C 一并修复）** |
| 3 | [template-store.ts](../src/server/template-store.ts) | 内置团队模板按英文 `key` 引用（'luna'/'ada'/'kai'/'roger'/'sally'/'max'/'nova'/'bill' 等；'quinn' 已不在人设池，命中时回退 Kai） |
| 4 | [crews/index.ts](../src/routes/api/crews/index.ts) | 第 113-123 行 `a.name.toLowerCase() === personaName` 匹配英文模板名永远失败 → 全部回退写死的 `AGENT_PERSONAS[6]`（凯）；**fallback 写死下标，删到少于 7 个人设会越界崩溃（现存 bug，方案 B 前置必改）** |
| 5 | [docs-screen.tsx](../src/screens/docs/docs-screen.tsx) | 第 738 行起"内置智能体人设"表格仍为英文名（Roger/Sally）且 emoji 与现人设不符，需同步为 `key`/中文名/新 emoji |
| 6 | [emoji-icon.tsx](../src/components/emoji-icon.tsx) | 新 emoji（💼🤝✍️🗓️📊）若缺 SVG 映射需补映射 |

**方案 B —— 删除开发向智能体**

- 删除清单（按需）：罗杰（前端）、莎莉（后端）、艾达（QA）、麦克斯（运维）、凯（全栈）、星枢（安全）。
- **前置必改**：先修 `crews/index.ts` 写死下标 fallback（上表 #4），再删人设；删除后内置团队模板中引用该人设的成员自动回退到保留人设，不影响运行。
- 注意：模板 `template-store.ts` 引用的英文 `key` 只回退、不崩溃；文档表格（#5）与 `assignPersona` 的"8 人唯一分配"注释同步更新。

**方案 C —— 架构加固（推荐作为标准做法）**

1. `AgentPersona` 增加 `key: string`（英文唯一标识），`getBuiltInAgents()` 的 id / 系统提示词改用 `key`；
2. `crews/index.ts` 成员匹配改为 `a.key === personaName`；
3. 为新增商务人设补充英文 `BUILTIN_SYSTEM_PROMPTS` 提示词；
4. 全程 tsc（`pnpm tsc --noEmit`）+ vitest 门禁通过。

> 建议顺序：**方案 C → 方案 A → 方案 B**。先修匹配 bug，再加商务人设，最后按需删开发人设。定位：商务人设随 7.1 功能矩阵的"多智能体 Crews"功能集交付（标准版及以上）。

### 6.2 商业化门禁设计原则（"友好不过度"，评估定稿）

> 背景：代码现有门控**全部为技术能力门控**（`useFeatureAvailable` → 网关 8642 探测 `/api/config`、`/api/jobs` 等端点），**不含任何商业授权逻辑**。商业授权（featureSet 下发）仅存在于文档规划（5.2 / 7.1），G7 中枢 featureSet 下发机制已在独立仓库实现，但**单机版 UI 侧锁定呈现无设计**——本节为该空窗期定稿。

**两类门控严格分离：**

| 门控类型 | 判断来源 | 提示文案 | 定位 |
|---|---|---|---|
| 技术门控（已有） | 网关能力探测 `capabilities[feature]` | "网关未连接 / 当前后端不支持" + 连接引导 | 后端/网关可用性，非商业 |
| 商业门控（待实施） | 授权 featureSet（本地验签 / 中枢下发） | "升级到 XX 版解锁" + 价值预告 | 商业裁剪 |

> 判断公式：`功能可用 = 商业授权可用 && 技术能力可用`，两类失败**分别提示**，避免用户把技术故障误认为付费墙（以及反过来）。

**五条原则：**

| # | 原则 | 落地方式 |
|---|---|---|
| 1 | **核心生产力零门禁** | 对话/记忆/技能/终端/审批/模型/MCP 免费版全开，永不锁定——先用产品价值留人 |
| 2 | **门禁只设增值入口，且入口可见** | 编排/多智能体/集成/审计等菜单免费版**全部可见 + PRO 徽标**，点击才出现锁定卡——"看得见"才是转化动机，隐藏=0 转化 |
| 3 | **锁定卡 = 价值预告，不是惩罚** | 统一 `FeatureLockedCard`：功能名 + 价值说明 + 只读预览/缩略图 + 升级 CTA；禁止用干巴巴的"当前后端不支持"糊弄用户 |
| 4 | **配额优于开关** | 免费版用软配额（如"最多 2 个自定义智能体、1 个团队"），超限才提示升级，比硬开关温和 |
| 5 | **降级可用，不整页屏蔽** | 网关/中枢离线时核心本地功能照常（已修 settings-dialog）；仅真正依赖远端的功能局部降级（参考 inspector-panel 的 tab 禁用 + 徽标模式） |

**反面清单（禁止）：** ① 入口隐藏；② 整页灰掉无说明；③ 登录墙（打开即要求登录）；④ 核心聊天流程弹窗打扰；⑤ 技术故障显示为付费提示。

### 6.3 UI/UX 统一规范（按钮与弹窗）

> 盘点结论（2026-08-12）：① **按钮**——`Button` 组件（[button.tsx](../src/components/ui/button.tsx)）主按钮为深色 `primary-950`，但全仓 30+ 处裸 `<button>` 直接使用亮色 `bg-accent-500`（routes 错误占位、chat-panel-toggle、chat-composer 发送、MobileSetupModal 等），同一"主 CTA"两套色并存；② **弹窗**——多数走统一 [dialog.tsx](../src/components/ui/dialog.tsx)（圆角 20px + `--theme-panel` + backdrop `rgba(0,0,0,0.5)`），但 crews/agents 的 6 处为裸 `fixed inset-0` div（agent-editor-dialog、workflow-builder、templates-gallery、dispatch-dialog、create-crew-dialog、apply-mode-dialog），圆角/底色/阴影各自为政。

**统一决策：**

| 项 | 规范 |
|---|---|
| 主色按钮 | **以品牌亮色 `accent-500`（#148AFF 系）为唯一主操作色**，`Button` 组件 default/secondary 变体改 `bg-accent-500 hover:bg-accent-600`（品牌设计 4.2 主色即亮蓝，primary-950 为 hermes-os 遗留）；危险=danger，次级=outline，文字=ghost |
| 弹窗容器 | 全仓收敛到 [dialog.tsx](../src/components/ui/dialog.tsx)：圆角 `20px`、底色 `--theme-panel`、边框 `--theme-border`、阴影 `--theme-shadow-3`、backdrop `rgba(0,0,0,0.5)`；裸 div modal 全部改为 `DialogRoot/DialogContent` 或至少复用同一容器类 |
| 圆角 | 按钮 `rounded-lg`、卡片 `rounded-xl`、弹窗 `rounded-[20px]`、头像 `rounded-full`，禁止散用 `rounded-md/2xl/3xl` 混搭 |
| 语义色 | 状态色仅用于语义（成功绿/警告琥珀/危险红/信息蓝），禁止用作按钮底色 |

**实施顺序：** ① Button 变体对齐（组件层，全局生效）→ ② 裸 modal 容器收敛 → ③ 残差扫描（`bg-accent` 与 `bg-primary` 混用文件）。

**实施进度（2026-08-12 已完成）：**

| 步骤 | 内容 | 状态 |
|---|---|---|
| ① 按钮变体 | [button.tsx](../src/components/ui/button.tsx) default/secondary/outline 全部改 `accent-500` 品牌亮色系（两主题经 styles.css `!important` 覆盖自动切换） | ✅ |
| ② 弹窗容器 | 统一 13 处裸 modal：apply-mode-dialog、manage-modes-modal（含删除确认）、save-mode-dialog、rename-mode-dialog、agent-editor-dialog、create-crew-dialog、dispatch-dialog、templates-gallery、workflow-builder、create-job-dialog、edit-job-dialog、keyboard-shortcuts-modal、onboarding-wizard、conductor 任务弹窗——全部 `rounded-[20px]` + `--theme-panel` + `--theme-border` + `--theme-shadow-3` + backdrop `rgba(0,0,0,0.5)`（去 blur 统一） | ✅ |
| ③ 残差按钮 | context-alert-modal（新建会话/知道了）、模式管理三件套的 关闭/保存/重命名/取消、settings-dialog 头部/侧栏/底部/选项卡片、backend-unavailable-state、onboarding 步骤点——`bg-primary-600/900` → `accent-500`，`bg-surface/primary-50` → `--theme-card` | ✅ |
| 验证 | `tsc --noEmit` 通过（EXIT=0） | ✅ |

> 已知例外（有意保留）：`MobileSetupModal`（移动端首启引导，暗色独立设计）、终端 `debug-panel`（暗色终端美学）、命令面板/搜索弹层（`rounded-xl` 弹层型交互）——三者是独立视觉模式，不参与弹窗统一。
>
> 残余待办（后续迭代，非本次范围）：skills/users/files 等 hermes-os 遗留整页 `bg-surface` 背景、`text-primary-*` 文本色散落 100+ 处，属全仓调色板迁移，需在主题系统全面接管后统一收尾。

### 6.4 商业化最佳落地方案（定稿评估）

> 背景：G7/G8 已交付授权引擎（Ed25519 离线验签、订阅+浮动席位、featureSet 裁剪、中枢登录门禁），但**单机版 UI 侧商业门禁的落地形态**此前只有原则（6.2）没有定稿路线。本节在 6.2 五原则之上，把"卖给谁、裁什么、怎么解锁、怎么防滥用"一次性收敛成可执行方案。

**方案对比（三条路线）：**

| 方案 | 机制 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A 本地授权文件（免费/标准版） | 标准版=离线 `.license` 文件，Ed25519 验签 + 机器绑定（G7 引擎现成） | 不强制联网、不要求登录、离线内网可交付；防伪强 | 单机无席位/审计 | ✅ **推荐落地路径** |
| B 中枢订阅（专业/私有化版） | 登录中枢下发 featureSet + 席位 + 心跳，含宽限期（G8 现成） | 企业级管理（审计/血缘/统一授权） | 需联网（私有化=内网中枢） | ✅ 用于企业档 |
| C 本地布尔开关 | 配置文件 `pro: true` | 实现 1 天 | 无防伪，只防君子，无法商业售卖 | ❌ 弃用 |

**定稿：双轨授权 = 免费版零授权（A 的"无文件"态） + 标准版本地授权文件（A）+ 专业版中枢订阅（B）。**

**功能裁剪边界（featureSet 枚举，免费版即可见）：**

| 功能 | 免费 | 标准 | 专业 | 门禁实现 |
|---|---|---|---|---|
| 对话/记忆/技能/终端/审批/模型/MCP | ✅ 全开 | ✅ | ✅ | 永不门禁（6.2 原则 1） |
| 集成（飞书/企微/钉钉） | 入口可见+PRO | ✅ | ✅ | 本地授权文件 |
| 多智能体（Crews） | 配额 1 个 | 5 个 | 无限 | 配额引擎（软上限） |
| 工作流编排（Conductor） | 入口可见+PRO | ✅ | ✅ | 本地授权文件 |
| 团队模式库（G9） | 入口可见+PRO | 只读 | ✅ | featureSet |
| 审计/血缘中枢（G7/G8） | 入口可见+PRO | — | ✅ | 中枢登录 |

**落地顺序（G11 商业化 UI 收口，四步）：**

1. **裁剪点定死**：`lib/feature-set.ts` 定义 featureSet 枚举 + 统一判断函数 `canUse(feature)`，公式沿用 `功能可用 = 商业授权可用 && 技术能力可用`，两类失败分别提示（技术失败→"网关未连接"，商业失败→FeatureLockedCard）。
2. **FeatureLockedCard 组件**：功能名 + 价值说明 + 只读预览 + 升级 CTA（"升级标准版 ¥199/月" / "联系销售"）——锁定卡=价值预告，禁止干巴巴"当前后端不支持"（6.2 原则 3）。
3. **本地授权文件通道**：设置页"授权"区拖入/选择 `.license` 文件 → Ed25519 验签（复用 G7 引擎）→ 生效即解锁标准版功能；免费版该区显示为"免费版 · 升级"卡片。
4. **PRO 徽标 + 配额**：入口可见 + PRO 徽标（原则 2）；配额超限时提示"升级可解锁更多"而非直接禁用（原则 4）。

**风险与对策：**

| 风险 | 对策 |
|---|---|
| 门禁过度伤转化 | 只裁增值功能，核心生产力零门禁（原则 1）；免费版可完整跑通核心工作流 |
| 离线/内网无法验签 | 授权文件本地验签，与联网无关；私有化=内网中枢，天然离线 |
| 破解 | Ed25519 + 机器绑定；单机低价档重点防企业批量滥用（席位/心跳在专业版兜底），不赌个人破解 |
| 登录墙反感 | 免费版永不要求登录/授权文件；登录只出现在专业版功能入口的 CTA 之后 |

**一句话结论：先让免费版"好用"，再用"可见的增值入口 + 价值预告锁定卡 + 本地验签文件"完成转化——技术能力与商业授权双轨分离，不联网、不打扰、不伪装，即"合理友好不过度"的最佳落地方案。**

---

## 💰 七、商业化定价策略（产品费与 API 费分离）

采用 "基础订阅费 + 可选 AI 用量包" 模式：

| 版本 | 定价（建议） | 版本形态 | 核心权益 | 目标客户 |
|---|---|---|---|---|
| 免费版 | ¥0 | 单机版 | 1席位；个人生产力核心功能（对话/记忆/技能/终端/审批/模型/MCP），集成/编排/多智能体裁剪 | 个人体验、引流 |
| 标准版 | ¥199/月/席（年付送2月） | 单机版（可选轻量接入） | 完整 AI 能力 + 飞书/企微集成 | 50人以下轻量团队（月入1万起） |
| 专业版 | ¥399/月/席 | **企业版（云端中枢）** | 标准版 + 智能体通信层 + 审计日志 + 云端中枢（全局驾驶舱/血缘/合规可查） | 50-200人需管理透明度的部门 |
| 私有化版 | **一次性买断（建议 ¥30-60 万）+ 年维护费（15-20%）** | **企业版（中枢独立部署企业内网）/ 离线交付版** | 全量功能，数据部署在企业内网；**离线授权（授权文件验签），支持完全不联网内网交付**；维护费含升级与支持 | 金融、政务、军工、生产内网等强合规行业 |

明确说明：¥199/月仅为 "Ti Work" 软件调度费，不包含大模型 API 调用费。客户可自行绑定 API Key，或由你们提供"代充服务"赚取服务费。**专业版及以上（企业版）以配置云端中枢端为交付前提。**

### 7.1 版本功能矩阵（功能裁剪定义）

**单机版 vs 企业版定位差异：**

| 维度 | 单机版（免费 / 标准） | 企业版（专业 / 私有化） |
|---|---|---|
| 使用者 | 个人 / 小团队 | 50-200 人团队 |
| 账号体系 | 本地账号（可选云订阅账号） | 中枢控制：多用户 / 角色 / 浮动席位 |
| 数据归属 | 全部本地 | 桌面端执行、中枢汇聚（血缘 / 审计） |
| 管控方式 | 仅订阅授权（在线订阅 + 宽限期降级） | 登录 / 有效期 / 权限中枢硬控制 |
| 使用者视角 | 个人效率工具 | 管理者全局视图（驾驶舱 / 甘特图 / 合规可查） |
| 部署形态 | 本机安装 | 企业中枢（云或内网）+ 员工桌面端 |

**版本功能矩阵（✅=该版本包含）：**

| 功能 | 免费版 | 标准版 | 专业版 | 私有化版 |
|---|---|---|---|---|
| 对话 / 多会话 | ✅ | ✅ | ✅ | ✅ |
| 记忆 / 技能 / 主题 | ✅ | ✅ | ✅ | ✅ |
| 终端 / 审批 | ✅ | ✅ | ✅ | ✅ |
| 自定义模型 Provider / MCP | ✅ | ✅ | ✅ | ✅ |
| 平台集成（Telegram/Discord/Slack/WeCom） | ❌ | ✅ | ✅ | ✅ |
| 飞书 / 钉钉集成（G6） | ❌ | ✅ | ✅ | ✅ |
| 多智能体 Crews | ❌ | ✅ | ✅ | ✅ |
| Conductor 编排 / Kanban / Analytics / 成本追踪 | ❌ | ✅ | ✅ | ✅ |
| 多用户 RBAC / 角色隔离 | ❌ | ❌ | ✅ | ✅ |
| 浮动席位（中枢校验，N 并发 + heartbeat） | ❌ | ❌ | ✅ | ✅ |
| 血缘汇聚（跨员工甘特图） | ❌ | ❌ | ✅ | ✅ |
| 审计中心 | ❌ | ❌ | ✅ | ✅ |
| 管理驾驶舱 / 管理控制台 | ❌ | ❌ | ✅ | ✅ |
| 团队模式库（team-learning：企业专家） | ❌ | ❌ | ✅ | ✅ |
| 离线授权（授权文件验签，内网交付） | ❌ | ❌ | ❌ | ✅ |
| 许可方式 | 本地授权（功能裁剪） | 在线订阅 + 宽限期 | 云端订阅（浮动席位） | 一次性买断 + 年维护费（15-20%） |

> 裁剪逻辑：**免费版 = 个人生产力核心**（对话/记忆/技能/终端/审批/模型/MCP），靠砍掉协同、集成、管控三组功能形成升级动机；**标准版 = 全部个人能力解锁**（集成 + 编排 + 多智能体），单机形态；**专业版 = 企业管控层**（多用户/浮动席位/血缘汇聚/审计/控制台/**团队模式库**），必须配中枢；**私有化版 = 专业版 + 离线交付**（授权文件验签、内网部署、合规支持）。

---

## 🚀 八、一步到位商业化实施计划（不设 MVP / 二期）

> 原则：所有架构与技术决策第一天按最终形态一次性定死，实施只分"步骤"不分"阶段"（不设任何会返工的过渡态）。由于需求**明确禁止 TODO、懒编码、硬编码、mock、占位符**，并要求业务逻辑完整、无逻辑错误与 bug，单靠"自觉"不可靠——因此每个步骤都以 **Harness 工程门禁**强制验收：门禁不过，不允许进入下一步，更不允许合入。

### 8.1 技术基线（一次性定死，绝不回改）

| 决策点 | 最终方案（第一天就位） | 明确不做的事 |
|---|---|---|
| 客户端形态 | PWA 内核 + **Electron 壳**，开发期 Web 模式迭代，产物 exe/dmg/AppImage | 不做"先 PWA 后补壳" |
| 业务后端 | 复用 Hermes-Studio Node/TS server 单仓扩展 | 不另起 Java/Python 后端 |
| 身份与权限 | 多用户 RBAC 直接落进 auth-middleware（用户管理 + 角色 + 会话），数据库按多租户设计 | 不做"单密码版再改多用户" |
| 血缘通信 | Redis Streams 第一天接入；事件模型按血缘设计（task / run / owner / prev_task / ts / dept） | 不做"先记录、后建模再迁移" |
| 审计存储 | 沿用 SQLite（50 人规模够用） | 不做"先 SQLite 后迁 PG" |
| 主题 | CC Switch 品牌主题 `ti-work` 默认激活 | 不做"先换肤、二期再正式主题" |
| 配置页 | 复用现有设置页 + 补飞书/钉钉 | 不重造已有设置 |
| 看板 | 血缘甘特图按 G3 血缘模型直接开发 | 不做"先简易、二期再重做" |
| 版本形态 | **在线单机版**（G0-G6，需 License 云端控制授权/配额，无需企业级中枢）+ **企业版**（G7-G8，必须配置云端中枢端，独立仓库）+ **离线交付版**（授权文件验签 ，零在线依赖） | 不做"单机版冒充企业版"、不做"中枢代码并进单机仓库"、不做"离线版无授权裸奔" |
| 中枢存储 | 企业版中枢默认 SQLite（私有化：每企业一实例）；数据模型**第一天按多租户设计**（`tenant` 分片），存储接口抽象兼容 PG，SaaS 多企业共享时仅换驱动 | 不做"先单租户再迁移" |

### 8.2 Harness 工程框架（四道门禁，保证开发准确性）

> 目的：把"禁止 TODO / 懒编码 / 硬编码 / mock / 占位符、业务逻辑完整无 bug"从口号变成**可自动执行的合入门禁**。任何一条不满足，CI 直接拒绝合入。

| 门禁 | 内容 | 拦截对象 |
|---|---|---|
| ① 契约门禁 | 每个功能点先写契约表（Given / When / Then），直接转成测试用例；**测试先行，实现后置** | 需求无测试覆盖、边写边想 |
| ② 静态门禁 | 新增 ESLint 规则组 `ti-work-rules`：`no-warn-comments` 禁 TODO/FIXME/HACK/XXX；正则禁 `placeholder` / `mock` / `stub` / `dummy` / 示例数据等占位符进入业务代码（测试夹具按白名单豁免）；颜色/文案/URL/密钥一律走主题变量、i18n、env、配置，禁魔法数字与魔法字符串；TS strict + 禁 `any` | TODO、懒编码、硬编码、占位符、mock |
| ③ 行为门禁 | 单测用 vitest；集成测试跑**真实依赖**（真实 Redis、SQLite 文件、真实 `~/.hermes` 配置、真实 gateway 8642），业务逻辑测试一律不 mock；仅外部付费 API（大模型 HTTP）可用契约化的本地 HTTP stub；Playwright e2e 覆盖关键旅程 | mock 化业务逻辑、假实现 |
| ④ 运行门禁 | 每次提交全量执行：`pnpm test` → `pnpm test:e2e` → build + 启动 + 健康检查 + 核心 API 冒烟（扩展现有 [dashboard-smoke.mjs](../scripts/dashboard-smoke.mjs)），CI 串行执行 | 逻辑错误、回归、产物不可启动 |

> G0 前置验证：门禁建好后先做"负向自证"——故意提交一条 TODO 与一个 mock，确认被门禁拒绝，证明门禁有效后再进入正式开发。

### 8.2.1 Hermes 首装 Harness（团队协作前置阻断门禁）

> 结论：**Hermes 首次安装/启动链路是当前项目的 P0 入口。未通过该门禁前，禁止并行推进任何会增加用户理解负担的新入口能力**，尤其是移动端连接、外网访问引导、跨端同步包装、企业版零配置宣传。

**协作铁律：**

| 规则 | 要求 | 目的 |
|---|---|---|
| P0-1 | 所有涉及 `bootstrap / start-agent / engine-bootstrap / hermes-proxy / 错误文案 / 首启引导` 的改动，必须先通过本节 Harness 才允许合入 | 防止入口回归 |
| P0-2 | 首装链路未全绿前，**不新增用户可见的移动端连接引导、Tailscale/LAN 引导、手机访问 CTA** | 防止在入口未稳时继续放大心智负担 |
| P0-3 | 任何依赖 Hermes 引擎的新功能，需求文档必须明确写出"对首装链路无新增前置条件" | 防止隐藏依赖渗入 |
| P0-4 | 每个相关 PR 必须附同一份首装回归结果，不得用"我机器之前装过"替代首装验证 | 统一团队验证口径 |

**首装 Harness 通过标准（缺一不可）：**

| Gate | 场景 | 通过标准 |
|---|---|---|
| H1 | 全新机器 / 清空 Electron `userData\\Hermes` 后首次启动 | 30 秒内出现明确安装状态（横幅或引导），不得静默失败 |
| H2 | 无网络 / GitHub 不可达 | 安装包内置 Hermes 源码快照后，**不得依赖仓库克隆 / Git / ZIP 下载**；固定版本源码落盘失败必须明确失败，不允许云端降级掩盖错误 |
| H3 | 固定盘符根目录受限 | bootstrap 默认不得写入 `D:\\hermes` 等磁盘根级固定目录；生产包由 Electron 主进程透传 `HERMES_HOME=userData\\Hermes`，所有受管写入跟随 Electron 用户数据目录 |
| H4 | 安装进行中 | 聊天页错误文案必须感知 bootstrap 状态，禁止回退成"请手动执行 hermes --gateway"的默认提示 |
| H5 | 安装失败后点击重试 | 必须能重新进入流程，且不会因脏目录、半截仓库、旧状态文件而永远失败 |
| H6 | 安装成功后重启应用 | 不得再次触发完整安装，应直接进入健康检查与常驻运行 |

**PR 必贴回归清单：**

1. 清理 Electron `userData\\Hermes\\.tiwork-bootstrap.json`
2. 清理 Electron `userData\\Hermes\\hermes-agent`
3. 启动 `release\\win-unpacked\\Ti Work.exe`
4. 记录三项结果：
   - 是否出现安装横幅/引导
   - `GET /api/engine-bootstrap` 的 `phase/stageIndex/currentStage`
   - 聊天发送失败时的最终用户可见文案
5. 若失败，附 `release\\tiwork-out.log` 与 `release\\tiwork-err.log` 尾部 120 行

**实施定稿：**

- `install.ps1` 继续作为官方安装入口；
- Electron 主进程统一透传 `HERMES_HOME=userData\\Hermes` 作为生产默认受管目录根；`userData` 启动时必须经过可写性探测，默认用户目录不可写时切换到应用目录旁的兜底目录；`HERMES_HOME` 外部环境变量仅作为高级覆盖；
- `.research/hermes-agent` 的固定源码快照应随包分发，首装必须使用内置源码；不得回退到 repository/git 云端拉取；
- 当前交付边界为：**安装器分发 bootstrap 资源，应用首启自动完成 Hermes 安装与网关启动**；除非后续明确改造 NSIS 脚本，否则不得在文档中表述为"安装向导阶段已完成全部 Hermes 安装"；
- bootstrap 状态读取优先实时态，聊天错误文案必须与 bootstrap 状态一致；
- 在本节 Harness 全绿前，移动端连接能力视为**冻结需求**。

### 8.3 实施步骤（G0 → G6 门禁流水线）

> 每步固定完成定义（DoD）：业务逻辑完整（零 TODO/懒编码/硬编码/mock/占位符）→ 契约测试全绿 → 静态门禁通过 → 运行门禁通过 → 代码评审通过（含边界/并发/幂等专项）。

| 步骤 | 内容 | 契约/测试基座 | DoD 验收点 |
|---|---|---|---|
| **G0 工程基线** | `ti-work-rules` 静态门禁、集成测试容器（真实 Redis/SQLite）、CI 门禁流水线、verify-build 冒烟脚本 | 基线测试全绿；负向自证被拒 | 四道门禁可执行且能拦截违规 |
| **G1 品牌与主题** | `ti-work` 主题（4.4 四项改动）+ 品牌资产 + 默认激活 | 主题变量契约测试：每个 `--theme-*` 在 `[data-theme='ti-work']` 下有值；hermes-os 专属选择器（styles.css 142-144/701/1041-1062 行）泛化逐条回归 | 全页面 ti-work 渲染一致、默认生效、无遗漏选择器 |
| **G2 身份与 RBAC** | 用户管理 UI、注册/登录、角色隔离扩展到全部 API、管理员分配页（MULTI_USER_ROADMAP Phase 2） | 权限矩阵契约测试：端点 × 角色 × 期望状态码全枚举；真实 Redis 会话集成；bcrypt 密码；e2e 注册→登录→授权 | 权限矩阵全绿、无越权、无明文密码 |
| **G3 血缘通信层** | Redis Streams 事件总线 + 血缘 API + 钩接 chat-event-bus / Conductor / Crews | 事件模型契约（task/run/owner/prev_task/ts/dept）；真实 Streams 写入→消费组消费→ack→重放集成；不丢消息/幂等测试 | 血缘链完整、消费组可恢复、幂等写入 |
| **G4 管理驾驶舱** | 血缘甘特图/流程图 + 审计报表（消费 G3 API） | 聚合逻辑单测（50 用户数据正确性断言）；e2e 看板交互 | 图表数据与血缘 API 一致、无占位图表 |
| **G5 桌面壳与分发** | Electron 壳（托盘/开机自启/原生通知/自动更新）+ electron-builder 打包 | electron 启动冒烟（加载构建产物、托盘出现）；安装包（exe/dmg/AppImage）安装→启动→健康检查 | 三平台安装包可安装启动且功能一致 |
| **G6 集成补齐** | 飞书/钉钉集成设置页 | 配置写入 `~/.hermes/config.yaml` → 网关 reload → 生效的集成测试 | ✅ **已完成**：配置持久化正确、无需手动改文件（见 8.6 进度记录） |
| **G7 企业版中枢**（独立仓库） | ① **License/Account 服务**（在线订阅签发/宽限期降级 + 免费版功能裁剪授权 + **浮动席位**（N 并发 + heartbeat）+ **离线授权文件验签通道**，本地 **Ed25519** 验签，单机版/企业版/离线版共用）+ ② 租户/席位/账号鉴权/使用有效期 + ③ 血缘汇聚（多实例写入，`tenant` 分片）+ 审计汇聚 + 管理控制台 | 契约：席位扣减/许可证过期/授权文件验签/有效期届满/功能集下发全枚举；真实 Redis Streams 多实例汇聚→消费组→重放；e2e 管理员登录→建租户→发席位→下发放权限 | 席位扣减正确、许可证校验不可绕过、授权文件防伪造、多租户数据零串、离线补报幂等 |
| **G8 桌面端接入中枢** | 桌面端登录接中枢（token/有效期/席位校验）+ 血缘/审计事件上报（`tenant/device/seq`）+ 离线降级补报 | 契约：断网本地可用、联网补报幂等去重、权限策略下发；e2e 员工登录→本地操作→中枢可查 | 断网不瘫、补报不重不漏、登录与有效期受中枢控制 |
| **G9 团队模式库**（企业专家，**G8 数据跑通后实施**） | ① 采集（`tool.invoked`/`tool.error` 事件扩展，复用血缘事件流）+ ② 提炼（定时聚合 + LLM 候选规则 `tool-fix/workflow-tip/avoid-rule`，含 `source` 事件引用可回溯）+ ③ 审核（控制台采纳/拒绝/范围 tenant·dept）+ ④ 注入（团队规范库随功能集下发，注入 agent 提示词 / 钩子层工具拦截）+ ⑤ 留痕（规则变更入审计，租户隔离） | 契约：候选规则生成/审核采纳/注入生效/隐私边界（**只学任务·工具·流程元数据，不学对话正文**，不做个人画像）全枚举；离线版本地闭环 | 规则可回溯、注入生效、审核留痕、跨租户零串 |
| **G10 品牌化与中文化**（国内交付，**G1 品牌/主题后实施**） | ① 关键路径中文化（onboarding 欢迎页 `hermes-onboarding.tsx` / 连接启动屏 `connection-startup-screen.tsx` / 登录屏 / 设置页 / 侧栏导航 / 系统标题 / manifest）② 全量 18 screens 可见文案中文化（4.6 术语表）③ 帮助文档页 `docs-screen.tsx` 中文化 ④ 品牌残留清理（可见 "Hermes Studio" 全部替换 Ti Work 中文文案；引擎协议/内部标识不动） | 契约：术语表逐项断言、关键路径 e2e 检查中文标题/按钮文案、全仓扫描无可见 hermes 品牌残留（白名单：LICENSE 版权段 / 引擎协议标识 / 代码注释） | 安装即全中文、零英文可见文案、品牌统一 Ti Work、帮助文档中文可读 |

### 8.4 质量与发布

| 环节 | 内容 |
|---|---|
| 合入门禁 | G0 四道门禁为全项目通用门槛，任何提交不过即拒 |
| 红线复核 | 发布前全仓扫描 TODO/占位符/硬编码/mock 零容忍；代码评审含"逻辑正确性"专项（边界条件、并发、幂等、失败恢复） |
| 测试基线 | 现有 vitest 199 测试 + Playwright 冒烟保留并纳入门禁；G1-G6 契约测试随步骤落地 |
| 发版 | G1-G6 全部 DoD 通过后统一发版（一步到位，无过渡版、无后补功能） |

### 8.5 为什么"一步到位 + Harness"比"分阶段 MVP"更省

| 对比项 | 分阶段 MVP（旧思路） | 一步到位 + Harness（本方案） |
|---|---|---|
| 身份体系 | 先单密码，再改多用户 → **权限数据迁移 + auth 重写** | 第一天多租户设计，无迁移 |
| 血缘数据 | 先日志，二期建模 → **存量数据重放/清洗** | 第一天按血缘模型入 Streams |
| 存储 | 先 SQLite 后迁 PG → **迁移脚本 + 双写兼容层** | 决策即终局，零迁移 |
| 桌面端 | 先 PWA，二期 Electron → **壳重构 + 分发重配** | 第一天壳与 Web 并行 |
| 主题 | 先临时换肤 → **返工调色** | 第一天正式主题 |
| 质量 | 靠自觉，bug 后置 → **返工定位成本高** | 门禁前置，违规/缺陷在提交时即被拦截 |
| 合计 | 每项均有一次返工 | 无返工项，且质量内建 |

### 8.6 实施进度记录

| 阶段 | 状态 | 完成要点 | 门禁记录 |
|---|---|---|---|
| G0 工程基线 | ✅ 已完成 | ti-work-rules 静态门禁、集成测试容器、verify-build 冒烟、负向自证 | lint 0 错误 / vitest 306 passed / e2e 19 passed / verify-build 通过 |
| G6 集成补齐 | ✅ 已完成 | 飞书/钉钉设置页（`src/routes/settings/index.tsx`）+ `/api/integrations` 读写 + `/api/integrations/test` 投递；配置写入 `~/.hermes/config.yaml` `integrations` 段（原子写），网关 reload 三态如实上报；secret 语义：显式 null 清空 / 留空保留现有值 | 19 单测（integrations 19 / gateway-reload 7 / webhook-delivery 10）+ e2e 8 用例（API 配置落盘、飞书请求头签名、钉钉 query 签名、UI 三态与掩码展示）；四道门禁全绿 |
| 已知环境噪音 | 不影响门禁 | trae-sandbox 沙箱拦截搜狗 IME 日志写入（`%LocalAppData%\LocalLow\SogouPY` 等）产生收尾报错，不影响测试结果与退出码语义；已透传 `--disable-features=msTextServiceOnDesktop` 缓解 Chromium 侧日志，Electron 侧属环境限制，彻底消除需沙箱配置放行相关路径 | e2e/electron.spec.ts 2 passed |
| G7 企业版中枢 | ✅ **已完成核心**（独立仓库 `Ti-Work-Web/`，已在 Hermes-Studio `.gitignore` 排除防误提交） | **三形态交付**授权模型定型；交付：Ed25519 验签引擎（离线授权文件，防伪造/篡改/过期/机器绑定全部拒绝）、订阅 + 浮动席位（N 并发 + heartbeat + TTL 回收）、宽限期降级、功能裁剪（featureSet 下发）、租户/账号/RBAC/JWT、血缘汇聚 + 审计落库（Redis Streams，`tenant/device/seq` 幂等，无 Redis 优雅降级）、管理控制台（React+Vite：登录/许可证/账号/审计/离线文件签发）、平台管理员 bootstrap | lint 0 / typecheck 0 / vitest 26 passed / web build 通过 / 真实启动全链路冒烟通过；Redis 真实汇聚已在 G8 真实中枢冒烟验证（consumed=1 stored=1）；私有化离线授权文件签发通道待后续补 |
| G8 桌面端接入 | ✅ **已完成** | 桌面端接入中枢：`hub-client`（登录/心跳/上报/离线补报）+ outbox SQLite 本地队列（设备内单调 seq + 断网滞留 + 恢复按序补报）+ 血缘发布钩子转发（`onLineagePublished` → hub-forward）+ `/api/hub`（status/connect/disconnect/heartbeat/flush）+ 设置页 Enterprise Hub 区 + 登录门禁（许可证超过硬期限拒绝本地登录）；中枢补充 `hardDeadline` 下发 | lint 0 错误（改动文件）/ 新增 vitest 13 passed（真实 HTTP 假中枢：登录 401/不可达、seq 单调、503 离线滞留、401 掉线、403 过期、心跳 404、门禁硬期限、断开清理）/ auth 既有 26 passed / web build 通过 / 真实中枢+真实 Redis 端到端冒烟通过（admin→租户→许可证→账号→桌面登录→事件上报幂等→心跳→审计可查） |
| G9 团队模式库 | ⏳ 规划中（G8 后实施） | 企业专家：采集→提炼→审核→注入→留痕；专业版专属（team-learning），数据归企业、只学元数据不学对话 | 未开工；沿用四道门禁 |
| G10 品牌化与中文化 | ✅ **已完成（中文化+UI/UX 统一）** | 全中文界面（硬编码中文化，不引 i18n）+ 品牌残留清理（onboarding 欢迎页、连接启动屏、docs 帮助页、系统标题/manifest）+ 中文术语表（4.6）；**UI/UX 统一（6.3）**：Button 变体 accent 品牌亮色化、13+ 处裸 modal 收敛到统一容器规范（圆角 20px/`--theme-panel`/`--theme-border`/`--theme-shadow-3`/backdrop `rgba(0,0,0,0.5)`）、`bg-primary-600/900` 按钮 → `accent-500` 全量替换 | tsc --noEmit 通过（EXIT=0）；UI 明细见 6.3 实施进度表 |
| G11 明暗双模（CC Switch 浅色版） | ✅ **已完成** | `ti-work` 新增浅色变量块（`[data-theme='ti-work'][data-mode='light']`，白底 `#0A84FF` 品牌蓝，色值沿用 4.2/4.3）；模式独立于主题族：`<html data-mode>` + `.dark` class + `hermes-theme-mode` 持久化；`theme.ts` 新增 `getMode/setMode`，启动脚本/splash/`theme-color` 按模式取色；设置页（对话框 + `/settings` 路由）新增 明暗模式 三档切换（浅色/深色/跟随系统，pill 样式）；主题缩略图按模式实时刷新；主题选择不再强制深色（保留当前模式）；代码块 Shiki 主题 `useResolvedTheme` 改为实时跟随 `data-mode`（vitesse-light/dark）；file-preview 深色硬编码改主题变量 | tsc --noEmit 通过（EXIT=0）；残留扫描：48 处 `bg-*-800/900/950` 中仅 1 处无 `dark:` 对照（file-preview textarea）已修复；其余均为 var() 或带 `dark:` 对照 |
| G12 国产模型默认内置 | ✅ **已完成** | 模型与服务商（`providers-screen` + 设置对话框 + onboarding 引导）默认内置 **DeepSeek** 与 **通义千问 Qwen（阿里云百炼）**，前置替换原主推位（Nous Portal / OpenRouter 保留但不置顶）：`provider-catalog.ts` 新增 deepseek/dashscope 条目（含 baseUrl 与 config 示例）；`hermes-config.ts` PROVIDERS 前置（`DEEPSEEK_API_KEY`/`DASHSCOPE_API_KEY`）；模型 tab 下拉/预设新增 DeepSeek（deepseek-chat）与通义千问（qwen-max）；logo 落地 `public/providers/{deepseek,qwen}.png`（lobehub 官方图标，含 light 变体）；模型图标识别 qwen 从 ollama 分组拆出 | tsc --noEmit 通过（EXIT=0）；provider id 按 litellm 标准（deepseek/dashscope），后端 hermes-agent 通过 litellm 原生路由 |
| G13 Hermes 首装收口 | ⏳ **进行中（P0 阻断项）** | 目标：首次打开即出现安装状态；内置 Hermes 源码快照跳过 `repository`；生产受管目录统一 Electron `userData\\Hermes`；聊天错误文案感知 bootstrap 状态；失败可重试且不被脏目录卡死；通过前禁止并行推进移动端连接等新增认知入口 | 通过标准见 8.2.1 Hermes 首装 Harness；该项未全绿前，其它依赖 Hermes 首装的用户可见新功能不得宣告完成 |

---

## 💎 九、一句话总结

当前项目要做的，不是包装一个开源 AI 客户端，而是基于 **Hermes-Studio 现有控制面板 + 多智能体协同引擎**，以 **CC Switch 品牌视觉**为壳、以"多用户权限 + 任务血缘 + 管理驾驶舱"为核，**一步到位**搭建成一套"端 + 云 + 通信层"三位一体的企业级 AI Agent 调度操作系统。交付分双形态：**单机版**（G0-G6，桌面端一体、交付无需云端控制端）与**企业版**（G7-G8，独立仓库云端中枢控制账号/席位/有效期，汇聚血缘与审计，兑现管理者全局视图——未来主要盈利方向）。
