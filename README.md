<div align="center">

<img width="240" height="240" alt="Ti Work 品牌标识 — 扶桑树" src="public/ti-work-logo.svg" />

# Ti Work

**面向企业日常办公的 AI 操作台：基于 Hermes Agent 的一站式桌面平台，内置执行引擎，安装即用。**

[![GitHub Stars](https://img.shields.io/github/stars/yaonature/Ti-Work?style=flat&color=6366F1)](https://github.com/yaonature/Ti-Work/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/yaonature/Ti-Work?style=flat&color=6366F1)](https://github.com/yaonature/Ti-Work/network/members)
[![Version](https://img.shields.io/badge/version-1.20.0-6366F1.svg)](CHANGELOG.md)
[![Hermes Agent](https://img.shields.io/badge/hermes--agent-v0.18.0-orange.svg)](https://github.com/NousResearch/hermes-agent)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/yaonature/Ti-Work/main/badges/tests.json)](src/test)
[![Last Commit](https://img.shields.io/github/last-commit/yaonature/Ti-Work)](https://github.com/yaonature/Ti-Work/commits/main)

> 不是聊天壳，而是一套完整的办公操作台：文件、浏览器自动化、记忆、数据库、流程编排、多智能体协作，全部从同一个界面驱动，开箱即用。

</div>

## Ti Work 是什么？

Ti Work 是基于 [Hermes Agent](https://github.com/NousResearch/hermes-agent) 的企业日常办公平台，融合开源 Hermes 生态构建。它把 AI Agent 变成一套可桌面交付的完整工作空间——多智能体编排、定时任务、执行审批、MCP 服务管理、企业知识沉淀等 30+ 能力，**内置执行引擎，安装即可对话**。兼容 Ollama、OpenAI、Anthropic 及任意 OpenAI 兼容后端。

**技术栈**：React、TypeScript、TanStack、Electron。

---

<details>
<summary><strong>目录</strong></summary>

- [Ti Work 是什么？](#ti-work-是什么)
- [核心特性](#-核心特性)
- [定时任务管理器](#-定时任务管理器)
- [Ti Work 特色能力](#-ti-work-特色能力)
- [截图](#-截图)
- [快速开始](#-快速开始)
- [本地模型（Ollama、LM Studio、vLLM）](#-本地模型ollama-lm-studio-vllm)
- [Docker 快速开始](#-docker-快速开始)
- [作为应用安装（推荐）](#-作为应用安装推荐)
- [通过 Tailscale 移动端访问](#-通过-tailscale-移动端访问)
- [功能详情](#-功能详情)
- [故障排查](#-故障排查)
- [卸载](#-卸载)
- [路线图](#-路线图)
- [参与贡献](#-参与贡献)
- [许可证](#-许可证)

</details>

---

## ✨ 核心特性

- 🤖 **Hermes Agent 集成** — 直连网关，实时 SSE 流式输出
- 👥 **多智能体 Crews** — 创建命名智能体小组，向全体或指定成员派发任务，实时查看活动流
- 🗂️ **Profile 隔离工作区** — 每个 Crew 成员拥有独立的文件系统视图（按 Profile 隔离工作区根目录）
- 🕸️ **交互式知识图谱** — 记忆维基链接关系的力导向可视化图谱，支持缩放、平移、节点拖拽与悬停高亮
- 🎨 **8 套主题系统** — Official、Classic、Slate、Mono，各有浅色与深色变体
- 🔒 **安全加固** — 全 API 路由鉴权中间件、CSP 头、路径穿越防护、执行审批提示
- 📱 **移动优先 PWA** — 通过 Tailscale 在任何设备上获得完整功能
- ⚡ **实时 SSE 流式输出** — 实时展示智能体输出与工具调用过程
- 🧠 **记忆与技能** — 浏览、搜索、编辑智能体记忆；探索 2,000+ 技能
- ✅ **执行审批** — 在 UI 中审批 / 拒绝 / 始终允许智能体的 Shell 命令；审批结果内联回显
- 📦 **技能安装** — 直接从浏览器安装 / 卸载 / 启停技能
- 🐦 **X/Twitter 插件示例** — 使用 Hermes Tweet 原生插件实现 X/Twitter 搜索、读取与受保护的行动工作流：`hermes plugins install Xquik-dev/hermes-tweet --enable`
- ⏰ **定时任务管理器** — 唯一带完整调度器的智能体 UI：创建、编辑、暂停、触发、监控任务；手动触发实时通过 SSE 在任务卡片内直播工具事件
- 🔐 **权限与工具箱** — 在设置界面配置审批、命令白名单、工具箱、安全扫描器、代码限制与推理强度
- 💾 **会话持久化** — 鉴权令牌、会话与进行中的运行在服务重启后依然保留（Redis 自动连接，优雅降级）
- 🔀 **可视化流程编排** — 构建并运行 DAG 结构任务流水线；任务按拓扑序执行，节点实时状态
- 📋 **Crew 与 Conductor 模板** — 7 套内置 Crew 模板 + 4 套 Conductor 模板（Research、Build、Review、Deploy），支持保存自定义模板；统一模板系统（`templateType` 字段）
- 💰 **成本追踪** — 每个 Crew 的输入 / 输出 Token 用量与预估 API 成本；Crew 详情页 Usage 标签页，含模型感知价格表与重置控制
- 🔌 **MCP 服务管理** — 在设置界面添加、编辑、移除 MCP 服务；直接写入 `~/.hermes/config.yaml` 并热加载，无需手工编辑文件
- 🧬 **智能体库** — 创建、编辑、删除自定义智能体（系统提示词、表情、角色标签、模型覆盖）；内置智能体自带可复制的系统提示词
- 🕵️ **审计追踪** — 跨会话按时间线记录每一次工具调用、用户消息与审批请求；可按会话、事件类型、时间范围过滤，展开查看完整参数与结果
- 📋 **克隆 Crew** — 一键复制任意 Crew，为每个成员新建会话并立即打开
- 🧪 **测试套件** — 核心 store 与工具函数的 vitest 单测（17 个文件 199 个用例全部通过）；全主要页面的 Playwright e2e 冒烟；GitHub Actions CI 徽章
- ⚡ **极速模式** — 聊天输入框一键切换，启用 Hermes v0.9.0 的优先队列（OpenAI / Anthropic 模型）；按会话持久化
- 📋 **日志查看器** — `/logs` 页面读取 `~/.hermes/logs/` 最近 500 行日志；全部 / 错误过滤、实时搜索、按级别着色、自动滚动
- 💾 **备份与导入** — 设置页一键备份与恢复 Hermes 数据（Hermes v0.9.0）
- 📡 **iMessage、微信与企业微信** — 在平台集成设置中新增 BlueBubbles（iMessage）、微信、企业微信，与 Telegram、Discord、Slack、Signal 并列（Hermes v0.9.0）
- 🎯 **Conductor V2** — 网关原生任务编排，含动画 SVG 办公室（网格 / 圆桌 / 作战室三种布局）、像素风智能体头像、真实 Hermes 网关集成、实时会话轮询、Worker 监控、设置抽屉（模型选择、最大并行数、监督模式）、带成本统计的任务历史、快捷操作（Research / Build / Review / Deploy）、中止 / 暂停 / 重试控制
- 📊 **运维总览** — 统一查看所有 Crew 与 Conductor 任务中的运行智能体；网格 / 输出切换；状态过滤；Crew 详情页亦提供运维标签页
- 📋 **任务 / 看板** — 五列看板（待办 → 进行中 → 评审 → 完成），原生 HTML5 拖拽；任务支持优先级、标签、来源链接；Conductor 任务自动创建关联任务
- 📊 **限流显示** — 供应商用量仪表盘展示 Hermes v0.9.0 捕获的 API 限流响应头（剩余请求 / Token、重置倒计时）
- 🖥️ **系统健康面板** — 底部常驻栏实时显示 CPU、内存、磁盘占用与运行时长；绿 / 黄 / 红三色阈值；设置 → 显示中可开关
- 📈 **Token 用量图表** — 用量弹窗中 14 天面积图，按日拆解全部会话的输入 / 输出 Token
- 🔬 **事件分析** — `/analytics` 页面：聚合事件统计、日成交量柱状图、TOP-15 工具频率图（数据源自 SQLite 事件库）
- 🪪 **身份文件编辑器** — 设置 → 身份，直接在浏览器读写 `SOUL.md`、`persona.md`、`CLAUDE.md`，无需终端
- 🧩 **模式与纠错查看器** — `/patterns` 页面浏览智能体习得模式，管理 `MEMORY.md` 中的用户纠错
- 🕐 **会话历史归档** — `/session-history` 双栏会话浏览器；可按日期 / 模型 / Token / 成本排序；按会话懒加载完整消息线程
- ⚙️ **Systemd 开机自启** — 设置 → 自启动：生成并安装 systemd 用户服务单元；UI 内安装 / 启动 / 停止 / 启停 / 卸载，实时状态展示

---

## ⏰ 定时任务管理器

其他 Hermes / Claude 类 Web 界面都把智能体当作"请求-响应"工具：发一条消息，收一条回复。

Ti Work 是唯一能让你把智能体**调度为后台工作进程**的产品——按定时器自动运行提示词，你无需在旁边守着。

不需要 `crontab -e`。不需要 Shell 脚本。不需要盯梢。

在任务标签页你可以：

- **创建任务** — 用自然语言提示词 + 调度计划（每 15 分钟 / 每小时 / 每日 / 每周等预设，或任意自定义 cron 表达式）
- **选择投递渠道** — 把任务输出路由到 Telegram、Discord、Slack 或 Signal，运行完成自动通知
- **设置技能与重复次数** — 为任务绑定特定技能；限制自动重跑次数
- **暂停 / 恢复** — 节假日冻结任务，周一早上解冻，无需删除重建
- **立即触发 + 实时直播** — 随时运行任意任务，实时工具事件、Token 输出、完成状态直接流入任务卡片——无轮询、无刷新
- **在线编辑** — 修改提示词、调度计划或渠道，无需重建任务
- **内联监控** — 展开任意任务卡片查看最近 N 次运行输出（含时间戳），或在手动运行期间观看实时 SSE 事件日志
- **自动刷新** — 任务列表每 30 秒轮询，无需手动刷新

### 它能做什么

| 使用场景 | 方式 |
|---|---|
| 每日简报 | 每天早上 7 点定时运行"总结我的邮件和日历"，推送到 Telegram |
| 仓库健康检查 | 每晚运行代码分析提示词，仅在发现问题时发 Slack 消息 |
| 价格 / 数据监控 | 每 15 分钟轮询 API，达到阈值时告警 |
| 自动化报告 | 每周自动生成 Markdown 报告写入工作区文件 |
| 维护任务 | 定时清理旧记忆条目、轮转日志、同步数据——无人值守 |

网关负责执行任务，Ti Work 是让你无需终端就能管理这一切的控制台。

---

## 🎯 Ti Work 特色能力

- ✅ **定时任务管理器** — 上述核心功能，其他 UI 均不具备
- ✅ **执行审批 UI** — 在浏览器中审批 / 拒绝 / 始终允许危险操作，支持展开上下文与三种审批范围
- ✅ **技能安装** — 直接从浏览器安装、卸载、启停 skillsmp.com 注册表的技能
- ✅ **权限与工具箱** — 从设置页配置审批模式、命令白名单、工具箱、网站黑名单、代码执行限制与推理强度
- ✅ **聊天平台令牌** — 在集成设置页直接填写 Telegram、Discord、Slack、Signal 机器人令牌（无需编辑 `.env`）
- ✅ **会话持久化** — 聊天历史在服务重启后保留；Redis 后端自动连接 `localhost:6379`，异常时优雅回退文件存储
- ✅ **多智能体编排** — Crews：命名智能体小组、并行任务派发、实时 SSE 活动流、成员状态跟踪
- ✅ **Profile 隔离工作区** — 每个智能体在独立目录（`~/.hermes/profiles/<name>/`）中工作，避免文件系统冲突
- ✅ **交互式知识图谱** — Memory 页面的力导向画布：缩放、平移、拖拽节点、悬停高亮连接，节点按度着色
- ✅ **可视化流程编排** — 编排串行 / 并行智能体任务流水线的 DAG 编辑器；贝塞尔连线、自动布局、逐节点 SSE 实时执行状态
- ✅ **Crew 模板** — 7 套内置模板、4 大分类（研究团队、深度调研、全栈小组、代码评审 Crew、内容工作室、运维团队、冲刺团队）；支持保存自定义模板；一键预填创建 Crew 弹窗
- ✅ **成本追踪** — 每个 Crew 详情页的 Usage 标签页；每次运行后从 Hermes 会话 API 拉取各智能体输入 / 输出 Token 数；内置模型价格表估算成本；Crew 级与成员级汇总；重置控制；需要 Hermes 增强模式
- ✅ **MCP 服务管理** — 设置 → MCP 服务：添加 / 编辑 / 删除 stdio 与 HTTP MCP 服务；"保存到配置"直接写入 `~/.hermes/config.yaml` 并自动热加载；无文件访问权限的环境保留 YAML 复制回退
- ✅ **智能体库** — 全新 `/agents` 页面：创建带系统提示词、表情、颜色、角色标签、模型覆盖与标签的自定义智能体；内置人设自带默认系统提示词；自定义智能体出现在 Crew 构建器与模板库下拉中；通过 `/api/agents` REST API 完整增删改查；持久化于 `.runtime/agent-definitions.json`
- ✅ **审计追踪** — 全新 `/audit` 页面：跨会话按时间线记录所有工具调用（含阶段 / 参数 / 结果）、用户消息与审批请求；由 `GET /api/audit/` 支撑；按会话、事件类型（工具调用 / 用户消息 / 审批）、时间范围过滤；工具事件卡片内联展开查看完整参数与结果；50 条分页
- ✅ **克隆 Crew** — `POST /api/crews/:crewId/clone`：复制名称 / 目标 / 成员名单，并行为新成员创建全新会话；克隆按钮位于 Crew 网格卡片（悬停）与详情页头部；成功后直接跳转新 Crew
- ✅ **Hermes v0.9.0 兼容** — 极速模式开关（`/fast`）、`/compress` 与 `/debug` 斜杠命令、API_SERVER_KEY 字段、一键备份 / 导入、BlueBubbles + 微信 + 企业微信平台集成、供应商用量仪表盘的限流头展示
- ✅ **Hermes v0.8.0 兼容** — 日志查看器页面（`~/.hermes/logs/`）、定时任务投递失败徽章、任务创建中的预运行脚本字段
- ✅ **Conductor V2** — 网关原生编排：动画 SVG 办公室、像素风头像、实时 Worker 监控、设置、任务历史、成本追踪、快捷操作、中止 / 暂停 / 重试
- ✅ **运维总览** — 统一查看 Crew 与 Conductor 任务中的智能体；网格 / 输出切换；状态过滤；也作为 Crew 详情页的运维标签页
- ✅ **任务 / 看板** — 五列拖拽看板，支持优先级、标签、来源交叉链接；Conductor 任务自动创建关联任务

---

### 💰 成本追踪

每个 Crew 的详情页都有 **Usage** 标签页。每次智能体运行完成后，Ti Work 会从 Hermes 会话 API 拉取累计 Token 数并按智能体记录。

标签页展示：
- **KPI 条** — 总 Token、输入 / 输出拆分、预估总成本
- **逐智能体明细** — 每个成员的输入 Token、输出 Token、预估成本；模型徽章；便携模式下显示破折号
- **重置控制** — 随时清空某个 Crew 的全部用量数据

成本估算使用内置价格表，覆盖 Anthropic（Opus、Sonnet、Haiku）、OpenAI（GPT-4.1、GPT-4o、o1/o3）与 Google（Gemini 2.5 Pro/Flash），支持模糊模型匹配与 `__unknown__` 回退。价格仅供参考。

Token 数据需要 Hermes 增强模式（已连接的 Hermes 后端）。便携模式的会话显示破折号与提示。

---

### 📋 Crew 模板

每次从零组建 Crew 很繁琐。模板让你用成熟组合快速起步：

**内置模板（共 7 套，4 大分类）：**

| 分类 | 模板 | 构成 |
|---|---|---|
| 研究 | 研究团队 | Luna（分析师）、Ada（评审员）、Kai（协调员） |
| 研究 | 深度调研 | Luna + Roger（分析师）、Kai（协调员） |
| 工程 | 全栈小组 | Kai（协调员）、Roger（前端）、Sally（后端）、Max（DevOps）、Ada（QA） |
| 工程 | 代码评审 Crew | Ada（执行员）、Luna（评审员）、Nova（安全） |
| 创意 | 内容工作室 | Bill（协调员）、Luna（作者）、Roger（评审员） |
| 运维 | 运维团队 | Max（协调员）、Sally + Kai（执行员） |
| 运维 | 冲刺团队 | Kai（协调员）、Roger + Sally（执行员）、Ada（评审员） |

点击 Crews 头部的 **模板** 打开可筛选图库。选中模板后关闭图库，并以模板的名称、目标与成员名单预填新建 Crew 弹窗——确认前可随意编辑。

用户自定义模板保存到 `.runtime/templates.json`，重启后保留。可随时在图库中删除（内置模板受保护）。

---

## 📸 截图

> **新功能截图即将补充** — Crews、知识图谱、分析与可视化流程均已上线；截图正在从全新部署环境采集。

### 原有功能

|               定时任务               |                文件                |
| :----------------------------------: | :------------------------------------: |
| <img width="764" height="972" alt="image" src="https://github.com/user-attachments/assets/f13f35fd-0538-4515-9902-1cbe9fb99d71" />| ![文件](./docs/screenshots/files.png) |

|                终端                 |                 记忆                  |
| :------------------------------------------: | :--------------------------------------: |
| ![终端](./docs/screenshots/terminal.png) | ![记忆](./docs/screenshots/memory.png) |

|                 技能                  |                  设置                   |
| :--------------------------------------: | :------------------------------------------: |
| ![技能](./docs/screenshots/skills.png) | <img width="1048" height="1216" alt="image" src="https://github.com/user-attachments/assets/f62d3378-ad68-4516-81ff-eceb952d2e7d" /> |

### Ti Work 新增

| 功能 | 说明 |
| :------ | :---------- |
| **多智能体 Crews** | 创建命名智能体小组，向全体或指定成员派发任务，实时查看各智能体活动流 |
| **可视化流程编排** | 智能体流水线 SVG 节点图——添加任务、节点连线、拓扑排序自动布局、环检测 |
| **交互式知识图谱** | 记忆维基链接关系的力导向 SVG 图谱——缩放、平移、拖拽节点、悬停高亮邻居 |
| **用量分析** | 14 天 Token / 成本图、工具频次拆分、会话量热力图 |
| **会话历史归档** | 浏览、过滤、重放每个历史会话，含 Token 与成本元数据 |
| **定时任务管理器** | 用 cron 表达式调度周期性智能体任务，实时状态与运行历史 |
| **Systemd 开机自启** | 设置页内一键安装 / 卸载服务，状态面板实时展示 |

*📷 以上各项截图本周内补充。*

---

## 🚀 快速开始

### 方式一：安装桌面版（推荐，安装即用）

1. 从 [GitHub Releases](https://github.com/yaonature/Ti-Work/releases) 下载对应平台的安装包（Windows / macOS / Linux）
2. 安装并启动 Ti Work
3. 首次启动自动引导配置 Hermes 引擎环境；已有 API Key 立即开始对话，未配置则按引导填写后即可对话

### 方式二：源码运行（开发 / 自建）

Ti Work 兼容任意 OpenAI 兼容后端。若你的后端还暴露了 Hermes 网关 API，会话、记忆、技能、审批、任务等增强功能会自动解锁。

**前置条件：**

- **Node.js 22+** — [nodejs.org](https://nodejs.org/)
- **OpenAI 兼容后端** — 本地、自托管或远程
- **可选：** 本地运行 Hermes 网关需 Python 3.11+

**第 1 步：启动后端**

指向任意支持以下接口的后端：

- `POST /v1/chat/completions`
- `GET /v1/models`（推荐）

Hermes 网关示例：

```bash
git clone https://github.com/NousResearch/hermes-agent.git
cd hermes-agent
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
hermes setup
hermes --gateway
```

如果使用其他 OpenAI 兼容服务器，记下其 base URL 即可。

**第 2 步：安装并运行 Ti Work**

```bash
# 新开终端
git clone https://github.com/yaonature/Ti-Work.git
cd Ti-Work
pnpm install
cp .env.example .env
printf '\nHERMES_API_URL=http://127.0.0.1:8642\n' >> .env
pnpm dev                   # 启动于 http://localhost:3000
```

> **验证：** 打开 `http://localhost:3000` 完成引导流程。先连接后端，再验证对话。若网关暴露 Hermes API，高级功能自动出现。

**环境变量：**

```env
# OpenAI 兼容后端 URL
HERMES_API_URL=http://127.0.0.1:8642

# Hermes 网关托管配置的可选供应商密钥
ANTHROPIC_API_KEY=your-key-here

# 可选：为 Web UI 设置密码保护
# HERMES_PASSWORD=your_password

# 可选：覆盖 Redis URL（默认 redis://localhost:6379）
# REDIS_URL=redis://localhost:6379
```

> **Redis 是可选的。** Ti Work 启动时会自动尝试连接本地 Redis 用于会话持久化；若 Redis 未运行，则静默回退到文件存储——无需任何配置。

---

## 🧠 本地模型（Ollama、LM Studio、vLLM）

### 便携模式（最简单）

直接把 Ti Work 指向本地服务器——无需 Hermes 网关：

```bash
# 启动 Ollama
OLLAMA_ORIGINS=* ollama serve

# 启动 Ti Work 指向 Ollama
HERMES_API_URL=http://127.0.0.1:11434 pnpm dev
```

立即可以对话。会话、记忆、技能、任务显示"不可用"——这是便携模式的预期行为。

### 增强模式（完整功能）

通过 Hermes 网关获得会话、记忆、技能、任务与工具：

**1. 在 `~/.hermes/config.yaml` 中配置本地模型：**

```yaml
provider: ollama
model: qwen2.5:7b # 或任意已拉取的模型
custom_providers:
  - name: ollama
    base_url: http://127.0.0.1:11434/v1
    api_key: ollama
    api_mode: chat_completions
```

**2. 在 `~/.hermes/.env` 中启用 API 服务：**

```env
API_SERVER_ENABLED=true
```

**3. 启动网关与工作区：**

```bash
hermes gateway run          # 启动于 :8642
HERMES_API_URL=http://127.0.0.1:8642 pnpm dev
```

所有工作区功能自动解锁——会话持久化、记忆跨聊天保存、技能可用、仪表盘展示真实用量数据。

> **兼容任意 OpenAI 兼容服务器** — Ollama、LM Studio、vLLM、llama.cpp、LocalAI 等，只需修改上方配置中的 `base_url` 与 `model`。

---

## 🐳 Docker 快速开始

[![Open in GitHub Codespaces](https://img.shields.io/badge/GitHub%20Codespaces-Open-181717?logo=github)](https://github.com/codespaces/new?hide_repo_select=true&ref=main&repo=yaonature/Ti-Work)

Docker 方案同时运行 **Hermes Agent 网关** 与 **Ti Work**。

### 前置条件

- **Docker**
- **Docker Compose**
- **Anthropic API Key** — [在此获取](https://console.anthropic.com/settings/keys)（网关必需）

### 第 1 步：配置环境

```bash
git clone https://github.com/yaonature/Ti-Work.git
cd Ti-Work
cp .env.example .env
```

编辑 `.env` 填入你的 API Key：

```env
ANTHROPIC_API_KEY=your-key-here
```

> **重要：** `hermes-agent` 容器必须配置 `ANTHROPIC_API_KEY`。缺失会导致网关鉴权失败。

### 第 2 步：启动服务

```bash
docker compose up
```

将启动两个服务：

- **hermes-agent** — AI 智能体网关（端口 8642）
- **hermes-studio** — Web UI（端口 3000）

### 第 3 步：访问工作区

打开 `http://localhost:3000` 完成引导。

> **验证：** 查看 Docker 日志中的 `[gateway] Connected to Hermes`——确认工作区已成功连接智能体。

---

## 📱 作为应用安装（推荐）

Ti Work 同时提供 **原生桌面应用（Electron）** 与 **PWA** 两种形态。

### 🖥️ 原生桌面应用（推荐）

Ti Work 桌面版是基于 Electron 的原生应用，内置执行引擎，安装即可对话：

- 原生窗口管理与托盘图标（常驻托盘，关闭窗口驻留后台）
- 智能体事件与任务完成的系统通知
- 开机自启
- 静态清单（`latest.json`）自动更新检查
- 后端进程生命周期管理：启动本地服务、健康探测、端口冲突回退
- 深度系统集成（macOS 菜单栏、Windows 任务栏）

从 [GitHub Releases](https://github.com/yaonature/Ti-Work/releases) 下载对应平台安装包（exe / dmg / AppImage）即可。

### 🌐 PWA 安装

Ti Work 是**渐进式 Web 应用（PWA）**——安装后可获得无浏览器边框、键盘快捷键与离线支持的原生应用体验。

**🖥️ 桌面（macOS / Windows / Linux）**

1. 在 **Chrome** 或 **Edge** 中打开 Ti Work `http://localhost:3000`
2. 点击地址栏的**安装图标**（⊕）
3. 点击**安装**——Ti Work 作为独立桌面应用打开
4. 固定到 Dock / 任务栏快速访问

> **macOS 用户：** 安装后也可添加到 Launchpad。

**📱 iPhone / iPad（iOS Safari）**

1. 在 iPhone 的 **Safari** 中打开 Ti Work
2. 点击**分享**按钮（□↑）
3. 下拉点击**"添加到主屏幕"**
4. 点击**添加**——Ti Work 图标出现在主屏幕
5. 从主屏幕启动，获得完整原生应用体验

**🤖 Android**

1. 在 Android 设备的 **Chrome** 中打开 Ti Work
2. 点击**三点菜单**（⋮）→ **"添加到主屏幕"**
3. 点击**添加**——Ti Work 成为原生体验的应用

---

## 📡 通过 Tailscale 移动端访问

随时随地访问 Ti Work——无需端口转发，无需复杂的 VPN。

### 设置

1. **在你的电脑与移动设备上安装 Tailscale**：
   - 电脑： [tailscale.com/download](https://tailscale.com/download)
   - iPhone / Android：在应用商店搜索 "Tailscale"

2. **在两端设备登录同一 Tailscale 账号**

3. **找到你电脑的 Tailscale IP：**

   ```bash
   tailscale ip -4
   # 示例输出: 100.x.x.x
   ```

4. **在手机上打开 Ti Work：**

   ```
   http://100.x.x.x:3000
   ```

5. **按上文步骤添加到主屏幕**，获得完整应用体验

> 💡 Tailscale 可跨越任意网络——家庭 Wi-Fi、移动数据、跨国。流量端到端加密。

---

## 🖥️ 原生桌面应用

> **状态：已发布（v1.20.0）** — Electron 壳包裹同一套 Web 后端（PWA 内核 + 壳），经 electron-builder 打包。

桌面应用提供：

- 原生窗口管理与托盘图标（常驻托盘，关闭窗口驻留后台）
- 智能体事件与任务完成的系统通知
- 开机自启
- 静态清单（`latest.json`）自动更新检查
- 后端进程生命周期管理：启动本地服务、健康探测、端口冲突回退
- 深度系统集成（macOS 菜单栏、Windows 任务栏）

`pnpm electron:build` 构建（产出 exe / dmg / AppImage）；`pnpm electron:dev` 开发运行。打包安装包已在真实 Windows / CI 环境验证，沙箱内以真实 Electron 启动冒烟（e2e）覆盖壳层行为。

**替代方案：** 可将 Ti Work 安装为 PWA（见上文）获得接近原生的桌面体验。

---

## ☁️ 云端与托管方案

> **状态：规划中**

计划推出完全托管的 Ti Work 云端版本：

- **一键部署** — 无需自托管
- **多设备同步** — 随时随地访问你的智能体
- **团队协作** — 全团队共享任务控制
- **自动更新** — 始终使用最新版本

云端基础设施上线后将支持：

- 跨设备会话同步
- 团队共享记忆与工作区
- 托管后端与可用性管理
- Webhook 集成与外部触发

---

## ✨ 功能详情

### 💬 聊天

- 实时 SSE 流式输出，渲染工具调用
- 多会话管理，完整历史
- Markdown + 语法高亮
- 按时间排序，合并去重
- 会话活动、记忆、技能的检视面板

### 🧠 记忆

- 浏览、编辑智能体记忆文件
- 跨记忆条目搜索
- Markdown 预览与实时编辑

### 🧩 技能

- 浏览注册表 2,000+ 技能
- 查看技能详情、分类与文档
- 直接从浏览器安装、卸载、启停技能
- 网关不支持原生安装时，回退到 clawhub CLI 并提供内联安装指引
- 所有技能操作均有加载动画与成功提示

### ✅ 执行审批

- 智能体请求危险命令时实时弹出审批卡片
- 决策前展开完整命令与上下文
- 单击即可批准一次 / 批准本次会话 / 始终允许
- 拒绝立即阻止操作
- 每次决策后聊天中内联显示处理结果
- 其他页面有待处理审批时，侧边栏全局徽章提示
- 双策略处理：原生网关接口 → 聊天命令回退

### ⏰ 定时任务管理器

唯一的浏览器端 Hermes 智能体任务调度 UI。其他 Hermes 或 Claude 类 Web 界面均不具备。

- 查看所有定时任务，实时状态指示（运行中、已暂停、错误）
- 创建任务：自然语言提示词 + 预设调度或自定义 cron 表达式
- 投递渠道：输出路由到 Telegram、Discord、Slack 或 Signal
- 为任务绑定技能、限制重复次数
- 在线修改任务任意字段，无需重建
- 不丢失配置地暂停与恢复
- 随时按需立即触发
- 展开任务卡片内联读取最近运行输出
- 每 30 秒自动刷新

### 👥 多智能体 Crews

在一个 UI 中协调多个 AI 智能体并行工作，朝向共同目标。

- **创建 Crew** — 为每个 Crew 设置名称、目标与最多 8 个智能体成员
- **人设智能体** — 从专业人设中挑选（Roger / 前端、Sally / 后端、Ada / QA、Kai / 通用等），各带角色标签、表情与颜色
- **成员级模型** — 为任意智能体独立指定任意模型
- **派发任务** — 同时向所有智能体发送提示词，或定向发给指定成员
- **实时活动流** — 所有成员的 SSE 事件实时汇入统一时间线；工具调用、消息、错误按颜色区分
- **状态指示** — 每张成员卡片以动画脉冲显示空闲 / 运行中 / 完成 / 错误
- **"打开聊天"链接** — 每张成员卡片直达该智能体的聊天会话
- **持久化** — Crew 及其成员状态在服务重启后保留（文件存储）

### 🔀 可视化流程编排

Crew 详情页的 **Workflow 标签页**是完整的 DAG 编辑器，用于构建并运行结构化任务流水线。

- **SVG 画布** — 纯 SVG 渲染，无需外部图库；平移、缩放（0.2×–4×）、指针捕获节点拖拽
- **添加任务** — 每个任务有标签、发送给智能体的完整提示词与执行人（任意 Crew 成员或"全部智能体"）
- **绘制依赖** — 激活连接模式，先点源节点再点目标节点绘制带箭头的贝塞尔连线；依赖意味着目标任务仅在源任务完成后运行
- **环检测** — 创建循环立即报错并丢弃连线；服务端保存时同样拒绝环
- **自动布局** — Kahn BFS 拓扑排序将节点按平行列从左到右排布，每层垂直居中
- **持久化** — 工作流按 Crew 保存于 `.runtime/workflows.json`（文件存储，与 Crew store 同模式）
- **运行工作流** — 点击运行按拓扑序执行：根任务并行派发；每层等待全部任务完成（通过 SSE `run_end` 事件）后再派发下一层
- **实时节点状态** — 每个节点显示着色边框与徽章：空闲 → 运行中（绿色脉冲）→ 完成（靛蓝）→ 错误（红色）；活动连线同步高亮为绿色
- **删除连线** — 点击任意连线（宽不可见热区）移除依赖
- **任务编辑面板** — 点击节点打开右侧面板：完整提示词、执行人、依赖、实时状态；双击内联编辑

### 🗂️ Profile 隔离工作区

每个 Crew 成员可分配一个命名 Profile，将其文件系统访问限定在隔离目录内。

- 每个 Profile 解析到 `~/.hermes/profiles/<name>/`——首次使用自动创建
- 文件浏览器侧边栏显示 Profile 的工作区根目录，而非全局工作区
- 所有文件操作（读、写、上传、删除、重命名、mkdir）均为 Profile 感知
- 服务端防路径穿越——Profile 名校验，拒绝 `../`
- 活动 Profile 通过 `useActiveProfile` hook 驱动主聊天页的文件浏览器

### 🕸️ 交互式知识图谱

Memory 页面的图谱视图是完整的交互式力导向画布——不再是静态圆形。

- **力导向布局** — 节点自然分布；枢纽聚集、孤立节点散向边缘；加载时同步计算（280 次库仑斥力 + 胡克弹簧引力迭代）
- **按度缩放节点** — 高连接枢纽更大，孤立节点保持小尺寸
- **节点类型配色** — guide、project、reference、concept、note 各有独立调色板；存在类型化节点时才显示图例
- **悬停高亮** — 悬停任意节点照亮其直接连接，其余降至 22% 透明度；悬停节点带光晕环
- **缩放** — 鼠标滚轮（非被动，不滚动页面）+ +/- 按钮；0.25×–4× 范围
- **平移** — 拖拽背景移动视口
- **节点拖拽** — 拖拽单个节点重新定位；会话内固定位置
- **统计计数** — 右下角显示 `N 节点 · M 连线`

### 🔐 权限与工具箱

- 审批模式选择器（自动 / 始终 / 从不）
- 审批超时控制
- 命令白名单编辑器——绕过 Tirith 的 Shell 命令标签输入
- 工具箱增删
- 网站黑名单开关 + 域名编辑器
- 代码执行限制
- 推理强度选择器
- 所有设置通过配置 API 实时持久化

### 🔗 集成

- skillsmp.com API Key，用于技能市场访问
- 聊天平台令牌——直接在 UI 中填写 Telegram、Discord、Slack、Signal 机器人令牌，无需编辑 `.env`

### 📁 文件

- 完整工作区文件浏览器
- 目录导航、文件预览与编辑
- Monaco 编辑器集成

### 💻 终端

- 完整 PTY 终端，跨平台支持
- 持久 Shell 会话
- 直接访问工作区

### 🎨 主题

- 8 套主题：Official、Classic、Slate、Mono——各有浅色与深色变体
- 主题跨会话持久化
- 完整移动端深色模式支持

### 💾 会话持久化

- 聊天会话与消息历史在服务重启后保留
- 鉴权令牌重启后保留——无需强制重新登录
- 进行中运行的去重状态保留——重启不产生重复运行
- Redis 后端启动时自动连接 `localhost:6379`；不可用时优雅回退文件存储
- 用 `REDIS_URL` 覆盖远程或非默认 Redis

### 🔒 安全

- 全 API 路由鉴权中间件
- meta 标签 CSP 头
- 文件、记忆、技能卸载路由防路径穿越
- 接口限流
- Web UI 可选密码保护
- 执行审批——危险命令需要用户明确签署

---

## 🔧 故障排查

### "工作区能加载，但聊天不工作"

启动时工作区会自动探测网关能力。检查终端是否出现类似：

```
[gateway] http://127.0.0.1:8642 available: health, models; missing: sessions, skills, memory, config, jobs
[gateway] Missing Hermes APIs detected. Update Hermes: cd hermes-agent && git pull && pip install -e . && hermes --gateway
```

**修复：** 确保使用带扩展网关支持的最新版 Hermes Agent：

```bash
git clone https://github.com/NousResearch/hermes-agent.git
cd hermes-agent && pip install -e . && hermes --gateway
```

### "连接被拒绝"或工作区加载挂起

Hermes 网关未运行。启动它：

```bash
cd hermes-agent
source .venv/bin/activate
hermes gateway run
```

### Ollama：聊天返回空或模型显示"离线"

确保 `~/.hermes/config.yaml` 包含 `custom_providers` 段，且 `~/.hermes/.env` 中 `API_SERVER_ENABLED=true`。参见上文[本地模型](#-本地模型ollama-lm-studio-vllm)。

同时确保 Ollama 以 CORS 启用状态运行：

```bash
OLLAMA_ORIGINS=* ollama serve
```

base URL 使用 `http://127.0.0.1:11434/v1`（不要用 `localhost`）。

验证：`curl http://localhost:8642/health` 应返回 `{"status": "ok"}`。

### "使用上游 NousResearch/hermes-agent"

上游 hermes-agent 通过 `hermes --gateway` 支持基础聊天，但旧版本可能不包含扩展接口（会话、记忆、技能、配置）。此时 Ti Work 以**便携模式**运行基础聊天。如需完整功能，确保使用最新版本：`cd hermes-agent && git pull && pip install -e .`

### Docker："Unauthorized"或连接 hermes-agent 被拒

使用 Docker Compose 出现鉴权错误时：

1. **检查 API Key 已设置：**

   ```bash
   cat .env | grep ANTHROPIC_API_KEY
   # 应显示: ANTHROPIC_API_KEY=sk-ant-...
   ```

2. **查看智能体容器日志：**

   ```bash
   docker compose logs hermes-agent
   ```

   查找启动错误或缺失 API Key 警告。

3. **验证智能体健康接口：**

   ```bash
   curl http://localhost:8642/health
   # 应返回: {"status": "ok"}
   ```

4. **用全新容器重启：**

   ```bash
   docker compose down
   docker compose up --build
   ```

5. **查看工作区日志中的网关状态：**
   ```bash
   docker compose logs hermes-studio
   ```
   查找 `[gateway] http://hermes-agent:8642 mode=...`——若显示 `mode=disconnected`，智能体未正确运行。

### Docker："hermes webapi command not found"

旧文档引用的 `hermes webapi` 命令不存在。正确命令是：

```bash
hermes --gateway   # 启动 FastAPI 网关服务器
```

Docker 方案自动使用 `hermes --gateway`——使用 `docker compose up` 无需任何操作。

---

## 🗑️ 卸载

在项目文件夹内运行内置脚本：

```bash
bash scripts/uninstall.sh
```

该脚本将：
1. 停止并禁用 systemd 服务（如已安装）
2. 终止所有运行中的 `server-entry.js` 进程
3. 确认后删除项目文件夹（含 `.runtime/` 数据）

**随项目文件夹删除的数据位置：**

| 文件 | 内容 |
|------|----------|
| `.runtime/events.db` | 分析 SQLite 数据库 |
| `.runtime/costs.json` | Token 成本历史 |
| `.runtime/crews.json` | 已保存的智能体 Crew |
| `.runtime/workflows.json` | Crew 工作流 |
| `.runtime/agent-definitions.json` | 自定义智能体定义 |
| `.runtime/local-sessions.json` | 会话元数据 |
| `.runtime/templates.json` | 消息模板 |

**脚本执行后的手动步骤：**

- **浏览器 localStorage** — 打开 DevTools → Application → Storage → Local Storage，清除 `http://localhost:<port>` 条目
- **`~/.hermes/`** — 该目录属于 Hermes Agent，不属于 Ti Work。除非同时卸载 Hermes Agent，否则请勿删除
- **Redis** — 若使用了密码保护，会话令牌会自然过期（或运行 `redis-cli FLUSHDB` 立即清除）

---

<img width="400" height="400" alt="Ti Work 图标 — 扶桑树" src="public/ti-work-logo.svg" />

## 🗺️ 路线图

| 功能                              | 状态            |
| ------------------------------------ | ----------------- |
| 聊天 + SSE 流式输出                 | ✅ 已发布        |
| 文件 + 终端                         | ✅ 已发布        |
| 记忆浏览器                           | ✅ 已发布        |
| 技能浏览器                           | ✅ 已发布        |
| 移动 PWA + Tailscale               | ✅ 已发布        |
| 8 套主题系统                        | ✅ 已发布        |
| 执行审批 UI                         | ✅ 已发布 v1.1.0 |
| 技能安装 / 启停 UI                  | ✅ 已发布 v1.2.0 |
| 定时任务管理器 UI                   | ✅ 已发布 v1.3.0 |
| 权限与工具箱设置                    | ✅ 已发布 v1.4.0 |
| 会话持久化（Redis）                 | ✅ 已发布 v1.5.0 |
| 多智能体编排（Crews）               | ✅ 已发布 v1.6.0 |
| Profile 隔离工作区                  | ✅ 已发布 v1.6.0 |
| 交互式知识图谱                      | ✅ 已发布 v1.6.0 |
| Crew / 智能体指标仪表盘             | ✅ 已发布 v1.7.0 |
| 可视化流程编排（DAG 编辑器）        | ✅ 已发布 v1.8.0 |
| Crew 模板                           | ✅ 已发布 v1.9.0 |
| 逐 Crew 成本追踪                    | ✅ 已发布 v1.10.0 |
| MCP 客户端协议                      | ✅ 已发布 v1.11.0 |
| 智能体库（自定义智能体）            | ✅ 已发布 v1.12.0 |
| 审计追踪                            | ✅ 已发布 v1.13.0 |
| 测试套件 + CI 徽章                  | ✅ 已发布 v1.15.0 |
| 克隆 Crew                           | ✅ 已发布 v1.14.0 |
| 设置向导                            | ✅ 已发布 v1.16.0 |
| Hermes v0.8.0 + v0.9.0 兼容        | ✅ 已发布 v1.17.0 |
| 设计系统 v1.0                       | ✅ 已发布 v1.16.0 |
| 命令面板（Ctrl+K）                  | ✅ 已发布 v1.18.0 |
| 系统健康面板                        | ✅ 已发布 v1.18.0 |
| Token 用量时序图                    | ✅ 已发布 v1.18.0 |
| State.db 分析                       | ✅ 已发布 v1.18.0 |
| 身份文件编辑器                      | ✅ 已发布 v1.18.0 |
| 模式与纠错查看器                    | ✅ 已发布 v1.18.0 |
| 会话历史归档                        | ✅ 已发布 v1.18.0 |
| Systemd 开机自启                    | ✅ 已发布 v1.18.0 |
| Conductor V2（网关编排）            | ✅ 已发布 v1.20.0 |
| 运维总览                            | ✅ 已发布 v1.19.0 |
| 任务 / 看板                         | ✅ 已发布 v1.19.0 |
| 原生桌面应用（Electron）            | ✅ 已发布 v1.20.0 |
| 云端 / 托管版本                     | 🔜 规划中         |

---

## ⭐ Star 历史

## [![Star History Chart](https://api.star-history.com/svg?repos=yaonature/Ti-Work&type=date&logscale&legend=top-left)](https://www.star-history.com/#yaonature/Ti-Work&type=date&logscale&legend=top-left)

## 🤝 参与贡献

欢迎提交 PR！参见 [CONTRIBUTING.md](CONTRIBUTING.md) 了解规范。

- 修复 Bug → 直接提交 PR
- 新功能 → 先提 issue 讨论
- 安全问题 → 参见 [SECURITY.md](SECURITY.md) 的负责任披露流程

---

## 📄 许可证

MIT — 详情参见 [LICENSE](LICENSE)。

---

## 🙏 致谢

Ti Work 基于以下开源生态构建，保留其 MIT 版权声明：

- [Hermes Studio](https://github.com/JPeetz/Hermes-Studio) by [@JPeetz](https://github.com/JPeetz)
- [hermes-workspace](https://github.com/outsourc-e/hermes-workspace) by [@outsourc-e](https://github.com/outsourc-e)
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) by NousResearch

---

<div align="center">
  <sub>基于开源 Hermes 生态（MIT）构建</sub>
</div>
