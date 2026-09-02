# 改动说明：测试全量修复（lint 配置 / 单测隔离 / 导航 testid / E2E 中文化与环境隔离）

> 用途：修复 CI 门禁（lint / 单测 / E2E）暴露的全部失败项，并如实归类每项失败根因（功能缺陷 / 测试过期 / 环境限制）。
> 生成时间：2026-09-01
> 作者：Ti Work

---

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-09-01 |
| 作者 | Ti Work |
| 关联需求/单号 | QA-FIX-0001（测试套件全量修复） |
| 验证方式 | `pnpm lint`（改动文件）、`pnpm vitest run`、`pnpm exec playwright test` |

---

## 背景 / 问题

用户要求「都修复吧，是功能问题还是测试文件因为功能改动没有及时更新问题？」。逐项排查后，失败根因分三类：

1. **功能侧缺陷**：ESLint flat config 加载即报错（exit 2），导航 testid 契约丢失。
2. **测试过期**：设置页 UI 已中文化，但 `integrations.spec.ts` 断言仍使用英文文案（`Integrations` / `Edit` / `Save` / `Test` / `Remove` / `Secret` / `enabled` / `Saved...`）。
3. **环境限制**：单测依赖开发机 PATH 上的真实 hermes 二进制；E2E Electron 用例被沙箱拦截真实用户目录写入而启动即退出。

---

## 功能改动点

### 1. ESLint 配置加载失败（功能缺陷）

- **根因**：`eslint.config.js` 混入了未安装的共享配置目录（`.bootstrap-stage` / `.research`，镜像上游源码），且根规则块重复声明了 `@tanstack/eslint-config` 已声明的 `@typescript-eslint` / `import` 插件，导致 `ConfigError: Cannot redefine plugin`。
- **改动**：
  - ignores 追加 `.bootstrap-stage/**`、`.research/**`。
  - 移除根规则块中重复的 `plugins` 声明及未使用的 `tseslint` / `importPlugin` import（插件统一由 `tanstackConfig` 声明，根块仅追加规则覆盖）。

### 2. 单测环境隔离（测试健壮性）

- **根因**：`hermes-engine.test.ts` 的「无引擎二进制」用例在开发机 PATH 装有 hermes 时仍能解析到真实引擎，断言环境依赖。
- **改动**：
  - `electron/hermes-engine.ts`：`EngineManagerOptions` 新增 `resolveLauncher`（引擎启动命令解析器，默认 `resolveEngineLauncher`），启动与重启路径统一走 `this.resolveLauncher(projectRoot, process.env)`。
  - `src/test/hermes-engine.test.ts`：预期 error 的用例注入 `resolveLauncher: () => null`，彻底隔离真实环境。

### 3. 导航 testid 契约恢复（功能缺陷）

- **根因**：桌面端底部菜单容器与「设置」入口在归并改造后丢失 `data-testid`，导航 E2E 无法稳定定位。
- **改动**：`src/screens/chat/components/chat-sidebar.tsx` 补回 `desktop_nav_bottom_menu`（底部菜单容器）与 `desktop_nav_settings`（设置入口按钮）。

### 4. 集成设置 E2E 断言中文化 + 导航竞态收敛（测试过期 + 测试健壮性）

- **根因**：设置页集成卡片已中文化，spec 断言仍为英文；且「更多设置 → 集成」依赖模拟点击，SSR 首载水合/遮罩关闭竞态下偶发点击失效（多次运行表现不一致）。
- **改动**（`tests/e2e/integrations.spec.ts`）：
  - 三态 reload 消息与断言同步为中文：`已保存。网关已重载…` / `已保存，但网关重载失败…` / `已保存。网关当前离线…`；按钮与标签断言改为 `编辑` / `保存` / `测试` / `移除` / `密钥` / `已启用`。
  - `prepareSettingsPage(page, section?)` 支持深链 `?section=<section>`：设置页首帧即确定 `activeSection`（低频项自动展开「更多设置」），替代易受水合竞态影响的模拟点击，测试确定性与真实用户深链路径一致。

### 5. Electron E2E 用户数据隔离（环境限制）

- **根因**：Electron 默认将用户数据写入 `%APPDATA%\hermes-studio` / `%LOCALAPPDATA%\Ti Work`，沙箱拦截后应用启动即退出（`firstWindow` 报 Target closed）。
- **改动**（`tests/e2e/electron.spec.ts`）：`launchApp` 增加 `--user-data-dir=<项目>/.e2e-electron-userdata`，并覆盖 `LOCALAPPDATA` / `APPDATA` 指向项目内 `.e2e-electron-data`，Chromium 自启动起即使用项目内可写 profile，主进程 userData 与后端 Hermes 目录同步落位。

### 6. 清理临时排查文件

- 删除 `.tmp/probe-settings.mjs`、`tests/e2e/probe.spec.ts` 及 spec 内 `[DEBUG 临时]` 日志。

### 7. 存量 lint error 全量清理（用户要求）

- **背景**：全量 `pnpm lint` 此前报 4261 个存量 error，经分类统计：**4119 个（96.8%）来自仓库内外部项目/构建产物目录**（`LingShu/`、`Ti OPC/`、`dsh桌面端/`、`.next/`、`.test-hermes-home/`、`Ti-Work-WebSite/`），非 Hermes-Studio 本体代码，且 eslint 不读 `.gitignore`，根因是 ignores 未覆盖；**主代码仅 138 个（3.2%）**，其中 137 个为 import 排序 / array-type / type-specifier 等自动修复项。
- **改动**：
  - `eslint.config.js` ignores 扩展：构建产物（`build/`、`release/`、`dist-electron/`、`dist-elec/`）、仓库内外部/历史项目（`LingShu/**`、`Ti OPC/**`、`dsh桌面端/**`、`Ti-Work-WebSite/**`）、其他框架构建产物与测试残留（`.next/**`、`.test-hermes-home/**`、`.e2e-hermes/**`、`.e2e-electron-data/**`、`.e2e-electron-userdata/**`、`test-results/**`、`playwright-report/**`、`coverage/**`）。
  - 主代码 137 个 error 由 `eslint --fix` 自动修复（纯风格项，零语义变化）。
  - 手工修复剩余 4 处（5 项）：
    - `src/components/message-item.tsx:2133`：字符类 `[⚡💭]` 含补充平面代理对（💭 U+1F4AD），正则补 `u` 标志。
    - `src/screens/chat/components/chat-composer.tsx:1082`、`src/screens/crews/components/workflow-builder.tsx:606`：删除引用未注册规则的失效 `eslint-disable-next-line react-hooks/exhaustive-deps` 注释（`@tanstack/eslint-config` 从未注册 react-hooks 插件，该规则不存在）。
    - `src/test/lineage-analytics.test.ts:40`：测试数据注释中的英文 `(todo column)` 命中 `no-todo-comments`（大小写不敏感），改措辞为 `(待办列)`，避免误判。

---

## 涉及文件列表

- `eslint.config.js`（ignores 收敛 + 重复插件声明移除）
- `electron/hermes-engine.ts`（`resolveLauncher` 注入点）
- `src/test/hermes-engine.test.ts`（用例环境隔离）
- `src/screens/chat/components/chat-sidebar.tsx`（底部菜单 / 设置入口 testid）
- `tests/e2e/integrations.spec.ts`（断言中文化 + 深链导航）
- `tests/e2e/electron.spec.ts`（userData 隔离）
- `docs/changelogs/2026-09-01-test-suite-full-repair.md`（本文件）
- `src/screens/chat/components/message-item.tsx`（正则补 `u` 标志）
- `src/screens/chat/components/chat-composer.tsx`（删除失效规则注释）
- `src/screens/crews/components/workflow-builder.tsx`（删除失效规则注释）
- `src/test/lineage-analytics.test.ts`（测试注释措辞规避误判）

---

## 影响到的功能模块

- 前端 lint 门禁（`pnpm lint` 可正常加载配置并输出结果）
- 桌面端引擎启动链路（默认行为不变，注入仅用于测试隔离）
- 桌面端底部导航定位契约（不影响视觉与交互）
- 集成设置页 E2E 断言（与中文化 UI 对齐）
- Electron 壳 E2E 启动环境（测试专用，不影响真实安装）

---

## 测试要点

- `pnpm exec eslint <改动文件>`：仅剩存量风格债（import 排序等 9 处，位于未改动行），本轮零新增错误。
- `pnpm exec eslint .`（全量）：**0 errors / 486 warnings**，存量 error 清零；剩余 warning 均为 eslint.config.js 注释约定的存量风格债务（`no-unnecessary-condition` / `no-shadow` 等），待 G1-G6 工作流改造时同步恢复 error。
- `pnpm vitest run`：394 passed / 73 skipped（含引擎 9 项用例）。
- `pnpm exec playwright test`：26 passed（含 integrations 8 项、electron 2 项、导航 2 项、执行中心 2 项、安全中心 4 项、lineage 3 项、smoke 5 项）。
- 沙箱残留拦截告警（IME 颜色配置 / AppInstaller 诊断日志等）为只读噪音，不影响用例结果。

---

## 风险点 / 遗留事项

- 存量 lint 债务（全量 `pnpm lint` 约 4261 个既有 error）仍会导致 CI `lint` job 失败，属历史存量，非本次改动引入；建议后续按文件分片清理后再开启全量 lint 硬门禁。（**已解决**：ignores 收敛 + `--fix` + 手工修复后，全量 lint 0 error，`pnpm lint` 退出码 0，CI lint 门禁可直接开启；486 个 warning 仍属存量风格债，按 G1-G6 工作流分批收敛。）
- Electron E2E 的 `--user-data-dir` / LOCALAPPDATA 覆盖仅作用于测试启动参数；打包产物的真实用户目录逻辑未改动。
