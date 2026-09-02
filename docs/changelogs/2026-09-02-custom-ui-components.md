# 改动说明：自定义 UI 组件库替换原生控件

> 用途：记录统一封装 Select / Textarea / Input / 确认对话框等自定义 UI 组件，替换界面中的浏览器原生控件与原生 confirm/alert，实现视觉统一与克制交互。
> 生成时间：2026-09-02
> 作者：Ti Work

---

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-09-02 |
| 作者 | Ti Work |
| 关联需求/单号 | UI-DESK-BASE-0001 |
| 分支 | main |

---

## 背景 / 问题

界面多处使用浏览器原生 `<select>` / `<input>` / `<textarea>` 与原生 `window.confirm`，观感与整体品牌风格不一致，且原生控件不可控（样式、暗色适配、交互细节）。需收敛为统一的自定义组件。

## 功能改动点

- **新增自定义 UI 组件**：
  - `ui/select.tsx`：基于 `@base-ui/react` 封装的 `Select` 系列（Trigger/Popup/List/Item/Value），全主题变量驱动。
  - `ui/textarea.tsx` / `ui/input.tsx`：统一样式的文本控件。
  - `ui/text-input-dialog.tsx`：可复用文本输入对话框。
- **原生控件替换**（25+ 界面文件）：原生 `<select>` → `Select`、`<textarea>` → `Textarea`、`<input>` → `Input`、`window.confirm` → `ConfirmActionDialog`、`window.alert` → 统一提示；替换涉及 agent 编辑、文件预览、引导流程、Conductor、Crews、作业、Lineage、记忆浏览器、运营台、模式纠正、画像、设置（提供商/MCP/用户）、技能、任务、文档/帮助等页面。
- **交互增强**：记忆浏览器未保存切换改用确认对话框（`PendingFileSelection` 机制），Lineage 任务筛选改用 `Select`，删除类操作统一二次确认。
- **删除确认收敛**：`confirm-action-dialog.tsx` 作为全局确认对话框组件被各页面复用。

## 涉及文件列表

- `src/components/ui/select.tsx`、`ui/textarea.tsx`、`ui/text-input-dialog.tsx`（新增）
- `src/components/ui/input.tsx`、`ui/confirm-action-dialog.tsx`（扩展）
- 使用方 20+ 文件：agent-chat/AgentChatInput、file-preview-dialog、hermes-onboarding、settings-dialog、agent-editor-dialog、conductor-home、create-crew-dialog、dispatch-dialog、workflow-builder、lineage-screen、memory-browser-screen、operations-screen、patterns-corrections-screen、profiles-screen、provider-wizard、mcp-settings-screen、providers-screen、users-settings-screen、skills-screen、workspace-skills-screen、task-dialog、docs-screen、help-screen 等

## 影响到的功能模块

- 全局 UI 组件库与全部使用这些控件的业务页面

## 测试要点

- 各替换页面交互与替换前等价：下拉选择、文本输入、删除/覆盖二次确认。
- 确认对话框在「未保存修改切换」场景正确拦截并支持取消/放弃。
- 全部既有 `data-testid` 保持稳定，既有 E2E 不受影响。
- 回归：`pnpm lint`、`pnpm vitest run`、`pnpm build`。

## 风险点 / 遗留事项

- `@base-ui/react` Select 为受控组件，需保证 `onValueChange` 与既有表单状态一致。
- 部分页面仍残留原生控件（本次未全覆盖），后续按需继续收敛。
