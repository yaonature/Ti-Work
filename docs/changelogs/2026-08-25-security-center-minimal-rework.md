# 改动说明：权限与安全中心极简改版 + 目录三级授权语义

> 用途：记录「权限与安全」页面产品化改版（极简 Tab + 默认档位 + 目录三级授权规则列表）及目录「只读 / 完全操控 / 禁止」三级语义的真实执行。
> 生成时间：2026-08-25
> 作者：Ti Work

---

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-25 |
| 作者 | Ti Work |
| 关联需求/单号 | UI-DESK-PERM-0001 |
| 分支 | feature/security-center-minimal |

---

## 功能改动点

- **页面极简改版**：`权限与安全` 由「总览卡 + 密集七子项 + 14 个开关堆叠」改为「安全档位卡片 + 简洁 Tab + 规则列表」，用户一进来即看到配置项，无需长篇文字。
- **简洁 Tab 导航**：划分为 `目录 / 网站 / 风险动作 / 安全与工具` 四个 Tab，每个 Tab 只承载一类配置，降低认知负担。
- **默认档位（推荐）**：提供 `受控工作区（推荐）/ 严格 / 宽松` 档位，新手可一键选中，高级用户再自定义。
- **目录授权三级语义规则列表**：所有目录规则统一为一条列表，每项可单独指定 `可读写（完全操控）/ 只读（仅查看下载）/ 禁止（完全拦截）`，一眼即可判断目录授权范围。
- **后端真实执行分级**：`authorization-guard` 依据 `allowed_paths`（完全操控）、`readonly_paths`（只读，禁止写）、`blocked_paths`（禁止）真正执行，而不再只是展示配置。

## 涉及文件列表

- `src/routes/settings/index.tsx`（`renderPermissions()` 极简 tab + 默认档位卡片 + 目录规则列表重写）
- `src/routes/audit.tsx`（总览 `useSecurityStatus` 解析只读字段并同步「只读目录」标签与摘要）
- `src/server/authorization-guard.ts`（新增 `readonlyPaths`，区分写/读动作拦截）
- `src/test/authorization-guard.test.ts`（新增只读三级语义用例）
- `tests/e2e/security_permissions_configuration.spec.ts`（按新 tab 结构同步 testid 与只读断言）
- `docs/changelogs/2026-08-25-security-center-minimal-rework.md`（本文件）

## 影响到的功能模块

- 权限与安全（目录 / 网站 / 风险动作 / 安全与工具）
- 文件执行链路（Authorization Guard）
- 总览页授权状态展示

## 测试要点

- 目录三级语义：只读目录允许读、阻止写并返回 `directory_readonly`；只读优先级高于完全操控；完全操控目录读写均放行。
- 顶级 tab 切换：`目录 / 网站 / 风险动作` 三个 tab 均能独立展示并操作。
- 目录规则新增：`全操控 / 只读 / 禁止` 三级分别写入 `allowed_paths / readonly_paths / blocked_paths`。
- 站点拦截、风险动作审批开关回写。

## 风险点 / 遗留事项

- E2E 需在 Electron 环境（`pnpm test:electron`）跑通，依赖 Playwright 一并验证 UI 交互。
- 通用审批链正式接入执行链路仍为独立待办（见基线清单 3.3）。
