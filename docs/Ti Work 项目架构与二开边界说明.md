# Ti Work 项目架构与二开边界说明

> 给团队成员的阅读提示：
> - 这份文档回答的是：**这个项目现在到底是什么结构、哪些来自开源、哪些是我们新增、哪些边界不能碰**
> - 如果你关心产品最终形态，请看 [Ti Work 企业日常办公平台规划.md](./Ti%20Work%20%E4%BC%81%E4%B8%9A%E6%97%A5%E5%B8%B8%E5%8A%9E%E5%85%AC%E5%B9%B3%E5%8F%B0%E8%A7%84%E5%88%92.md)
> - 如果你关心后续二开什么能力，请看 [Ti Work 企业级 AI Agent 二开方案.md](./Ti%20Work%20%E4%BC%81%E4%B8%9A%E7%BA%A7%20AI%20Agent%20%E4%BA%8C%E5%BC%80%E6%96%B9%E6%A1%88.md)

> 状态：基线文档（基于 v1.20.0 代码核验，2026-08-13）
> 目的：讲清楚"这个项目是什么、怎么运作、哪些来自开源、哪些是我们二开加的"，为后续企业版/商业逻辑决策提供事实基线。

## 先看这页

### 这份文档是做什么的

这份文档不是讲“未来要做什么”，而是讲“当前客观事实是什么”。

它的作用是给团队一个统一基线：

- 当前项目是不是 Electron 原生项目
- Hermes 在整个系统里处于什么位置
- 哪些代码是开源底座的
- 哪些代码是我们新增的
- 哪些标识、协议和版权内容不能乱改

### 团队成员读完后，应该知道什么

读完这份文档，任何成员都应该能回答：

1. Ti Work 并不是从零开始的新产品，而是基于 Hermes-Studio 二开
2. Ti Work 自己不是执行引擎，Hermes 网关才是执行引擎
3. 我们新增的核心价值主要在桌面壳、企业能力和产品交付层
4. 法律归属、协议命名、内部标识、用户品牌之间要怎么区分

### 一句话结论

这份文档最重要的价值，不是介绍“项目很复杂”，而是避免团队在后续二开里出现三类错误：

1. 误以为 Ti Work 可以随意改 Hermes 协议和技术命名
2. 误以为开源底座没有价值，重复造轮子
3. 误以为所有用户可见内容、内部技术标识、法律归属都应该统一替换

### 推荐阅读顺序

1. 先看“项目身份与来源”
2. 再看“我们二开加了什么”
3. 最后看“二开边界”

如果你是新加入项目的同学，这份文档建议先于具体开发任务阅读。

---

## 一、项目身份与来源

| 项 | 内容 |
|---|---|
| 开源底座 | [Hermes-Studio](https://github.com/JPeetz/Hermes-Studio)（JPeetz，MIT 许可，作者署名需保留） |
| 底座再上游 | [hermes-workspace](https://github.com/outsourc-e/hermes-workspace)（outsourc-e，MIT，版权段需保留） |
| 执行引擎 | [Hermes Agent](https://github.com/NousResearch/hermes-agent)（NousResearch，Python）——**Ti Work 不包含引擎，只做控制面板** |
| 本仓库 | 商业二开 fork：`yaonature/Ti-Work`（remote 已确认），产品名 **Ti Work**，版本号沿用上游 v1.20.0 基线 |
| 授权模型 | 见 [development-guide.md](./development-guide.md) 第五章（三形态：单机版 / 企业版中枢 / 离线交付版） |

**一句话**：Ti Work = 开源 Hermes-Studio（Web 控制面板） + 我们自建的桌面壳与商业化增量。执行引擎始终是外部 Hermes 网关。

---

## 二、开源版是什么形态（二开前的基线）

上游 Hermes-Studio 是 **纯 Web 应用**，无任何桌面壳：

- **技术栈**：Vite + React 19 + TanStack Router/Start + PWA + Tailwind
- **后端**：Node/TypeScript 单仓库内嵌服务端（`server-entry.js` + `src/server/`），SSR 渲染 + 60+ 个 `/api/*` 路由
- **数据**：Redis（会话/Token 持久化，可选回退文件存储）+ SQLite（`.runtime/events.db` 审计/事件）+ JSON 文件（`.runtime/` crews / workflows / agents 等）
- **执行引擎对接**：通过 HTTP 访问 Hermes 网关（默认 `127.0.0.1:8642`），能力探测决定增强功能开关
- **交付方式**：`pnpm dev`（开发）/ `vite build` + `node server-entry.js`（部署）/ PWA 安装 / Docker（docker-compose 双服务）
- **Electron 状态**：上游仅在 Roadmap 标记 "Planned"，无任何实现（git 历史零提交）

> 证据：本仓库 git 历史继承自上游，`git log -- electron/` 为空；`docs/development-guide.md` 三、现状盘点对此有明确核验结论。

---

## 三、我们二开加了什么

### 3.1 桌面壳（Electron，核心新增）

全部为本仓库新增代码（当前为 git 未跟踪状态）：

| 模块 | 文件 | 职责 |
|---|---|---|
| 主进程 | [electron/main.ts](../electron/main.ts) | 单实例锁、托盘常驻、窗口管理、后端进程 spawn/健康检查、开机自启、原生通知、自动更新检查、IPC |
| 后端托管 | [electron/backend.ts](../electron/backend.ts) | 端口冲突扫描、spawn 命令构造、健康轮询 |
| 配置 | [electron/config.ts](../electron/config.ts) | 端口/托盘菜单/窗口选项/更新间隔常量 |
| 预加载 | [electron/preload.ts](../electron/preload.ts) | 渲染进程 IPC 桥 |
| 托盘图标 | [electron/tray-icon.ts](../electron/tray-icon.ts) | 32px 托盘图标（data URL，由图标脚本生成） |
| 更新 | [electron/update-check.ts](../electron/update-check.ts) / [updater.ts](../electron/updater.ts) | `latest.json` 清单拉取与版本状态机 |
| 打包配置 | [electron-builder.yml](../electron-builder.yml) | NSIS/dmg/AppImage，`beforeBuild` 钩子跳过 pnpm 依赖收集 |

配套构建工程（均为本仓库新增）：`scripts/build-electron.mjs`（esbuild 编译主进程）、`scripts/electron-package.mjs`（electron-builder 封装 + 国内镜像）、`scripts/ensure-electron.mjs`、`scripts/stage-server-deps.mjs`（后端依赖 staging 到 `.electron-stage`）、`scripts/electron-before-build.cjs`、`scripts/generate-electron-icons.mjs`（扶桑树像素画师）、`scripts/verify-build.mjs`。

打包产物：`release/Ti Work Setup <ver>.exe`（Windows NSIS，当前 149.4 MB）。

### 3.2 商业化与工程基座（同为本仓库新增）

| 项 | 说明 |
|---|---|
| 方案文档 | `docs/development-guide.md`（v7：三形态交付 / 授权矩阵 / 定价 / G0-G12 实施与进度） |
| 工程门禁 | `eslint/ti-work-rules.mjs`（禁 TODO/占位符/mock 等）+ `scripts/verify-build.mjs` |
| 包管理 | `pnpm-workspace.yaml`、`.npmrc`（store/cache 收拢到项目内，符合 D 盘存储约定） |
| 中文化 | 全量界面中文硬编码（G10）+ 中文术语表 |
| 主题 | `ti-work` 品牌主题 + 明暗双模（G11） |
| 国产模型 | DeepSeek / 通义千问默认内置（G12，`provider-catalog.ts` / `hermes-config.ts`） |
| 企业中枢接入 | `src/server/hub-client.ts`、`/api/hub`、设置页 Enterprise Hub 区（G8：登录/心跳/离线补报/loginGate） |
| 集成 | 飞书 / 钉钉（G6，`src/server/integrations.ts` + 设置页） |
| 品牌 | 扶桑树 logo（`public/ti-work-logo.svg`、favicon、安装包图标、托盘、PWA 图标） |

### 3.3 上游基础上修改的（git 状态 M 的 src 文件）

大量 `src/**` 文件相对上游有改动：UI 统一（按钮/弹窗规范 6.3）、错误提示语义（网关离线 vs 版本过旧）、模型选择器 fallback、auth 角色过滤等。这些是本仓库二开叠加在上游代码上的改动，非新增文件。

---

## 四、运行时架构与请求链路

```
┌─ Electron 壳（electron/main.ts，桌面交付形态）───────────────┐
│  spawn 本地 Node 后端 → 健康检查 → 加载窗口（http://127.0.0.1:PORT） │
│  托盘常驻 / 开机自启 / 自动更新 / 原生通知                         │
├─ 本地 Node 后端（server-entry.js + dist/server，TanStack SSR）───┤
│  静态资源 + SSR 页面 + /api/* 路由（认证 / 限流 / 审计）            │
├─ 执行引擎：Hermes 网关（外部 Python 进程，127.0.0.1:8642）────────┤
│  会话 / 记忆 / 技能 / 定时任务 / 审批 / MCP 全部在网关执行           │
└─ 存储：Redis（可选）+ SQLite（.runtime/events.db）+ JSON（.runtime/）┘
```

**聊天链路（以 send-stream 为例）**：

1. 前端 → `POST /api/send-stream`（SSE）
2. 后端 `ensureGatewayProbed()` 探测网关能力（`src/server/gateway-capabilities.ts`）
3. 网关离线 → 返回"无法连接 Hermes 执行引擎网关"；在线但缺 sessions 能力 → 返回升级引导
4. `streamChatUnified`（`src/server/chat-backends.ts`）双后端：
   - **hermes-enhanced**：走网关（解锁全部增强功能）
   - **openai-compat**：直连任意 OpenAI 兼容服务（Ollama/LM Studio 等，portable 模式）
5. 网关执行 agent（工具调用/审批/终端），事件经 SSE 流式回前端

**能力开关机制**：前端 `src/lib/feature-gates.ts` 仅做技术门控（capabilities 探测），**不含商业授权门控**。商业 featureSet 由中枢下发，暂存于 `hub-state`，尚未用于 UI 功能裁剪（见 development-guide 6.4，待收口）。

---

## 四.5 产品形态分层与演进（2026-08-13 更新）

产品按 **三形态交付**，共用同一底座（安装包内置 Hermes 引擎 + 自启）：

```
装完即用：安装包内置 Hermes 引擎 + 自启（所有版本共用）
 ├─ 单机版（匿名/软登录）：本地全功能，唯一操作=首次填一次 API Key；登录可选 → 账号中心（订阅升级/云同步/遥测）
 ├─ 单机版（付费订阅：标准/专业）：登录后按 featureSet 解锁高级能力，到期自动降级
 └─ 企业版（Ti-Work-Web 分配账号登录）：企业统一下发模型白名单 / API Key 统一管理 → 用户零配置；功能裁剪+审计+席位+离线补报（G8 已实现）
```

详见 [product-tiers.md](./product-tiers.md)（形态对比表 + 批次依赖图）。分批实施顺序：**批次 0（引擎可用性兜底：UI 提示修复 + 直连降级）→ 批次 1（引擎内置+自启）→ 批次 2（软登录+账号中心）→ 批次 3（订阅解锁/降级）→ 批次 4（企业版 UI 收口）**。

## 五、二开边界（哪些不能动）

| 类别 | 处理 | 依据 |
|---|---|---|
| LICENSE 版权段（含 hermes-workspace） | **必须保留** | MIT 唯一义务 |
| package.json 的 author / repository / homepage / bugs | **必须保留**（指向 JPeetz/Hermes-Studio 源码出处） | 来源声明 |
| 执行引擎与技术协议：Hermes Agent / 网关 8642 / `~/.hermes` / `HERMES_API` / `/api/hermes-proxy` | **必须保留** | 引擎协议，改名破坏兼容 |
| 用户可见品牌（应用名/安装产物/系统标题/logo/文案） | **已改 Ti Work** | 商业品牌面 |
| 内部标识（localStorage key / Redis 前缀 / docker 服务名 / 代码注释） | **保持原样** | 迁移零收益高风险 |
| Electron 壳与打包工程 | 本仓库资产，可按需演进 | 我们自建 |

---

## 六、证据索引

- git remote：`origin https://github.com/yaonature/Ti-Work.git`
- `git log -- electron/` → 空（上游无 Electron 提交）
- `git ls-files electron/ electron-builder.yml scripts/*.mjs dist-electron` → 空（壳为未跟踪新增）
- README 矛盾：功能列表"Shipped v1.20.0" vs Roadmap"🔜 Planned"（二开残留）
- development-guide.md 三、现状盘点：上游核验结论"非 Electron，仅 Roadmap Planned"
