# 改动说明

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-24 |
| 作者 | AI 助手 |
| 分支 | 当前工作区 |
| 起始 commit | working-tree |
| 结束 commit | working-tree |
| 关联需求/单号 | 桌面端菜单收口与页面归并 |

## 功能改动点

- 将桌面端主导航统一收口为 `工作台 / 数字员工 / 执行中心 / 定时任务`，底部入口统一收口为 `权限与安全 / 设置`。
- 将原本分散的文件处理与终端执行能力归并到 `执行中心` 单页，通过页内视图切换承接 `文件处理` 与 `执行终端`。
- 将原本分散的审计、授权、账号与企业治理入口归并到 `权限与安全` 单页，通过页内分区承接 `总览 / 授权配置 / 审计记录 / 账号授权 / 企业中枢`。
- 将旧 `/terminal` 独立入口回流到 `执行中心` 的终端视图，并同步修正工作台快捷入口、命令面板和相关跳转文案。
- 为这轮改造补充稳定的 `data-testid` 标记，便于后续以自动化脚本持续回归导航与页面归并结果。

## 涉及文件列表

- `src/screens/chat/components/chat-sidebar.tsx`（桌面端侧边导航收口与测试标记）
- `src/components/mobile-tab-bar.tsx`（移动端底部导航测试标记）
- `src/routes/files.tsx`（执行中心复合页）
- `src/routes/audit.tsx`（权限与安全复合页）
- `src/routes/terminal.tsx`（旧终端入口回流）
- `src/screens/audit/audit-trail-screen.tsx`（嵌入式审计视图）
- `src/routes/settings/index.tsx`（复用授权 / 账号 / 企业中枢模块）
- `src/screens/dashboard/dashboard-screen.tsx`（工作台快捷入口更新）
- `src/components/dashboard-overflow-panel.tsx`（溢出入口更新）
- `src/components/command-palette.tsx`（命令面板入口更新）
- `src/screens/settings/components/provider-wizard.tsx`（终端入口文案与跳转更新）
- `tests/e2e/support/workspace.ts`（桌面端页面准备工具）
- `tests/e2e/desktop_navigation_menu_merge.spec.ts`
- `tests/e2e/execution_center_merge.spec.ts`
- `tests/e2e/security_center_merge.spec.ts`
- `tests/e2e/dashboard_execution_shortcut.spec.ts`

## 影响到的功能模块

- 桌面端导航
- 工作台快捷入口
- 执行中心
- 权限与安全
- 终端入口回流
- E2E 冒烟测试

## 测试要点（AI 生成脚本时按此展开）

- 验证桌面端主菜单严格保持 `4+2` 结构，不再出现多余一级入口。
- 验证 `执行中心` 默认进入文件处理视图，可切换到终端视图，并支持旧 `/terminal` 路由自动回流。
- 验证 `权限与安全` 页内可以切换 5 个分区，且每个分区切换后页面不崩溃。
- 验证工作台中的 `执行中心` 快捷入口直接进入 `/files`，不再延续旧终端独立心智。
- 验证这轮新增的稳定标记可供 Playwright 脚本定位，不依赖易变的中文文案作为主定位方式。

## 风险点 / 遗留事项

- 本次已完成页面壳层与入口归并，但 `站点授权规则表 / 目录权限模型 / 审批流` 仍属于下一阶段的深度治理开发内容。
- 当前仓库尚未完全收口到 `test:changed / test:full` 的统一脚本体系，本次先补齐了与改动直接对应的 E2E 冒烟用例。
