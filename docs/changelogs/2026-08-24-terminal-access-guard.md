# 改动说明

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-24 |
| 作者 | AI 助手 |
| 分支 | 当前工作区 |
| 起始 commit | working-tree |
| 结束 commit | working-tree |
| 关联需求/单号 | 终端执行接入 Authorization Guard（本地化 TDD 落地） |

## 功能改动点

- 为 `Authorization Guard` 补齐终端（shell）执行的门禁能力：新增 `evaluateRiskAction`、`assertTerminalAccess`、`enforceTerminalAccess` 三个导出。
- 复用已有的 `risk_controls.require_confirmation / require_approval` 风险策略（键为 `execute_shell` 等风险动作），不新增独立配置结构，与设置页「高风险动作」治理对齐。
- `evaluateRiskAction` 将某个风险动作归类为 `allowed / needs_confirmation / needs_approval`；当同时命中「需确认」与「需审批」时，`needs_approval` 优先级更高。
- `assertTerminalAccess` 依据分类执行门禁：
  - `allowed` 放行（`no_risk_control`）。
  - `needs_confirmation` 抛出 `terminal_requires_confirmation`。
  - `needs_approval` 抛出 `terminal_requires_approval`。
- `enforceTerminalAccess` 作为执行链路侧一揽函数，读取已保存配置后交给 `assertTerminalAccess`，与目录/站点守卫的 `enforce*` 对齐。
- 放行 / 需确认 / 需审批结果通过 `publishChatEvent('desktop.terminal_policy', ...)` 统一发布为事件，与目录守卫（`desktop.directory_policy`）、站点守卫（`desktop.website_policy`）事件保持同构，供后续审计与确认/审批链消费。

## 涉及文件列表

- `src/server/authorization-guard.ts`（新增终端执行门禁三函数 + 终端事件发布）
- `src/test/authorization-guard.test.ts`（新增 `authorization-guard terminal access` 测试套件，共 5 个用例）

## 影响到的功能模块

- 权限与安全
- Authorization Guard（终端执行）
- 高风险动作确认 / 审批链
- 事件驱动沉淀
- 单元测试

## 测试要点（AI 生成脚本时按此展开）

- 验证未配置任何风险控制时放行。
- 验证命中 `require_confirmation` 返回 `terminal_requires_confirmation`。
- 验证命中 `require_approval` 返回 `terminal_requires_approval`。
- 验证审批优先级高于确认。
- 验证未配置的动作归类为 `allowed`，不影响其它风险动作。

## 风险点 / 遗留事项

- 本次为终端执行门禁的 TS 决策层落地（风险分类 + 事件化），真实执行拦截点在 Hermes 引擎（Python）侧，需接线到引擎的 shell 执行器。
- `needs_approval / needs_confirmation` 当前以抛错信号表达「暂停执行」，其后仍依赖「高风险动作确认/审批链」完成用户侧确认与审批、以及 approve/deny 回写执行链路的正式接通（下一开发项）。
