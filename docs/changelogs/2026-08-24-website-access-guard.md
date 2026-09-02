# 改动说明

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-24 |
| 作者 | AI 助手 |
| 分支 | 当前工作区 |
| 起始 commit | working-tree |
| 结束 commit | working-tree |
| 关联需求/单号 | 浏览器站点访问接入 Authorization Guard（本地化 TDD 落地） |

## 功能改动点

- 为 `Authorization Guard` 补齐站点访问能力：新增 `normalizeDomain`、`assertWebsiteAccess`、`enforceWebsiteAccess` 三个导出。
- `normalizeDomain` 归一化站点 URL：去协议、去路径/查询/锚点、去端口、去 `www.` 前缀并统一小写，作为域名比对基准。
- `assertWebsiteAccess` 依据 `website_access` 策略执行站点门禁：
  - `enabled=false` 时全部放行（`website_access_disabled`）。
  - 命中 `blockedDomains`（含子域名）拒绝并返回 `website_blocked`。
  - `allowlist` 模式下未命中 `allowedDomains`（含子域名）拒绝并返回 `website_not_allowed`。
  - `balanced` 模式默认放行非禁止域名。
- `enforceWebsiteAccess` 作为路由侧一揽函数，读取已保存配置后交给 `assertWebsiteAccess`，与目录守卫的 `enforceDirectoryAccess` 对齐。
- 放行/拒绝结果通过 `publishChatEvent('desktop.website_policy', ...)` 统一发布为事件，与目录守卫事件（`desktop.directory_policy`）保持同构，供后续审计与习惯沉淀消费。

## 涉及文件列表

- `src/server/authorization-guard.ts`（新增站点访问门禁三函数 + 站点事件发布）
- `src/test/authorization-guard.test.ts`（新增 `authorization-guard website access` 测试套件，共 7 个用例）

## 影响到的功能模块

- 权限与安全
- Authorization Guard（站点访问）
- 事件驱动沉淀
- 单元测试

## 测试要点（AI 生成脚本时按此展开）

- 验证 `normalizeDomain` 对协议、路径、端口、`www.`、大小写、首尾空格的归一化正确。
- 验证 `enabled=false` 时放行。
- 验证 `blockedDomains` 命中（含子域名）返回 `website_blocked`。
- 验证 `allowlist` 模式未在白名单返回 `website_not_allowed`、在白名单（含子域名）放行。
- 验证 `balanced` 模式对非禁止域名放行。

## 风险点 / 遗留事项

- 本次为站点访问门禁的 TS 纯函数层落地（策略解析 + 门禁判定 + 事件化），与目录守卫对齐。
- 浏览器导航动作的真拦截点在 Hermes 引擎（Python，8642 端口）侧，需后续接线到导航动作；本仓库接管决策与事件消费，引擎侧接入点待与用户确认后再落。
- 站点访问检测目前只针对域名；`ask` 模式与高风险确认流程依赖后续「高风险动作确认/审批链」开发项。
