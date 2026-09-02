# 改动说明：Electron 品牌更名与目录选择对话框

> 用途：记录桌面端品牌由「Hermes」统一更名为「Ti Work」，并新增原生目录选择对话框 IPC 能力（文件门户选择工作目录）。
> 生成时间：2026-09-02
> 作者：Ti Work

---

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-09-02 |
| 作者 | Ti Work |
| 关联需求/单号 | BRAND-0001 / UI-DESK-FILE-0001 |
| 分支 | main |

---

## 背景 / 问题

桌面端产品品牌统一为 Ti Work（与云端门户一致），Electron 主进程/预加载层多处仍使用 Hermes 字样；文件门户缺少「选择工作目录」入口，只能手填路径。

## 功能改动点

- **品牌更名**：Electron 主进程窗口标题、应用名称、配置默认值等由 Hermes 统一改为 Ti Work。
- **目录选择 IPC**：主进程新增 `dialog:select-directory`（原生目录选择对话框），预加载层 `preload.ts` 暴露对应 API，前端文件门户通过该 API 选择工作目录并回填。
- **文件门户接入**：`file-explorer-sidebar.tsx` 接入目录选择按钮，选择结果同步为工作区根路径。

## 涉及文件列表

- `electron/main.ts`（品牌更名 + 目录选择 IPC）
- `electron/preload.ts`（暴露 `selectDirectory` API）
- `electron/config.ts`（品牌/默认配置）
- `src/components/file-explorer/file-explorer-sidebar.tsx`（目录选择入口与回填）

## 影响到的功能模块

- Electron 桌面壳（窗口标题/应用名）
- 文件门户（工作目录选择）

## 测试要点

- Electron 窗口标题与应用名显示为 Ti Work。
- 点击目录选择按钮弹出原生目录对话框，选择后工作目录回填正确。
- 回归：`pnpm build`、`pnpm test:electron`（既有 E2E）。

## 风险点 / 遗留事项

- 目录选择后需同步触发授权守卫对所选目录的访问评估（与授权配置联动）。
