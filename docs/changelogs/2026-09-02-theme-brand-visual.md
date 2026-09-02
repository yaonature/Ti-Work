# 改动说明：主题 CSS 变量重构与品牌视觉统一

> 用途：记录界面主题由 Tailwind 固定色值重构为 CSS 变量（--theme-*）驱动的品牌视觉体系，并统一品牌图形（扶桑树 · 日轮）与文案表达。
> 生成时间：2026-09-02
> 作者：Ti Work

---

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-09-02 |
| 作者 | Ti Work |
| 关联需求/单号 | UI-THEME-0001 |
| 分支 | main |

---

## 背景 / 问题

此前主题色散落在 Tailwind 类与内联样式（如 `#1a1a24` 等硬编码色值），暗色/亮色切换依赖散点覆盖；品牌图形（用户头像等）与 Ti Work 品牌家族（扶桑树 · 日轮）不一致。

## 功能改动点

- **CSS 变量主题体系**：`styles.css` 定义 `--theme-*` 变量（背景/卡片/边框/文本/主色/强调色等），`theme.ts` 提供运行时变量映射，按钮、开关等基础组件改用变量驱动，消除硬编码色值。
- **品牌视觉统一**：
  - `user-avatar.tsx` 重构为品牌家族图形（深炭底 + 品牌蓝人像 + 金乌之日轮光环），与助手 logo（扶桑树 · 日轮）语义区分。
  - `emoji-icon.tsx` 作为图形占位与主题联动。
- **文案统一**：`provider-catalog.ts` 中「API Key」等专业用词统一为「API 密钥」，`slash-command-menu.tsx` 精简冗余中文文案。

## 涉及文件列表

- `src/styles.css`（主题变量体系）
- `src/lib/theme.ts`（变量映射）
- `src/components/ui/button.tsx`、`ui/switch.tsx`（组件改用变量）
- `src/components/avatars/user-avatar.tsx`（品牌图形）
- `src/components/emoji-icon.tsx`、`src/components/slash-command-menu.tsx`、`src/lib/provider-catalog.ts`（文案与图形收敛）

## 影响到的功能模块

- 全局主题（暗色/亮色）
- 用户头像、按钮、开关等基础组件

## 测试要点

- 暗色/亮色切换后各页面颜色随 `--theme-*` 联动，无硬编码色值残留导致的割裂。
- 按钮/开关交互与替换前一致。
- 回归：`pnpm lint`、`pnpm vitest run`、`pnpm build`。

## 风险点 / 遗留事项

- 若仍有页面内联硬编码色值（本次未全覆盖），后续逐步迁移至变量。
