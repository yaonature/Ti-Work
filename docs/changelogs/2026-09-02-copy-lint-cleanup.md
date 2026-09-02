# 改动说明：界面中文文案精简与 lint 修复

> 用途：记录批量界面文件的「Hermes→Ti Work」品牌文案统一、中文文案精简，以及 ESLint 自动修复（import 排序 / array-type / 类型写法）零语义变更。
> 生成时间：2026-09-02
> 作者：Ti Work

---

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-09-02 |
| 作者 | Ti Work |
| 关联需求/单号 | QA-STYLE-0002 |
| 分支 | main |

---

## 背景 / 问题

积压工作区中大量界面文件仅包含品牌文案替换、中文文案精简与 lint 自动修复（零功能语义变化），需作为独立清理批次提交，避免与功能批次混淆。

## 功能改动点

- **品牌文案统一**：多页面「Hermes / hermes-studio」等表述统一为「Ti Work / 执行引擎」。
- **中文文案精简**：命令面板、引导流程、连接状态、用量提示等页面精简冗余说明文字，保持克制表达。
- **lint 自动修复**：import 排序、`Array<T>`→`T[]`、`let`→`const`、类型写法等 ESLint 自动修复（零语义变更）。
- **删除冗余组件**：移除不再使用的 `agent-status-strip.tsx`。
- **杂项清理**：`.gitignore` 补充忽略项。

## 涉及文件列表

- 约 66 个界面/服务/工具文件（src/components、src/routes、src/screens、src/server、src/lib、src/hooks、src/routes/api 等），以及删除 `src/components/agent-status-strip.tsx`
- 详见 commit 文件清单

## 影响到的功能模块

- 全局文案与代码风格（无功能行为变化）

## 测试要点

- 全量回归：`pnpm lint`（0 error）、`pnpm vitest run`（全量通过）、`pnpm build`（client + SSR）。

## 风险点 / 遗留事项

- 文案修改不改变任何 testid 与交互结构，既有 E2E 不受影响。
