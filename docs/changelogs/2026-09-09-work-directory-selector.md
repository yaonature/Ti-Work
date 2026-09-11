# 改动说明

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-09-09 |
| 作者 | AI 助手 |
| 分支 | main |
| 起始 commit | working-tree |
| 结束 commit | working-tree |
| 关联需求/单号 | ZCode「选择项目」对应物；桌面端工作目录（数字员工唯一输出空间）首期=UI + 选择 + 持久化 |

## 功能改动点

新增「工作目录选择器」，位于会话输入卡片**外上方**（ZCode「选择项目」对应位，非卡片内），供用户指定数字员工的唯一输出空间。

- 新增 `src/components/work-directory-selector.tsx`：
  - 折叠态：文件夹图标 + 目录名（未设置时显示「选择工作目录」），点击展开菜单；展开态显示当前完整路径（`title` 悬浮可看全路径）或未设置引导文案「数字员工会把生成的文件保存到你的工作目录」。
  - 选择动作：经 Electron 预加载桥 `window.tiwork.selectDirectory()` 打开系统目录对话框；**非 Electron 环境不做兜底**，直接提示「未选择文件夹，或当前环境不支持选择目录。」（避免以假路径冒充结果）。
  - 选中后写入设置并 toast 反馈；点击组件外区域自动收起（`mousedown` 监听 + 容器包含判断，卸载时移除监听）。
  - UI 全量 HugeIcons 图标 + 主题 CSS 变量，无原生组件、无 emoji。
- 修改 `src/hooks/use-settings.ts`：`StudioSettings` 新增 `workDirectory: string`（默认 `''` = 未设置），随既有设置持久化链路存储。
- 修改 `src/screens/chat/components/chat-composer.tsx`：在输入卡片外上方挂载选择器，**仅非移动端视口渲染**（移动端不占位）。

## 涉及文件列表

- `src/components/work-directory-selector.tsx`（新增）
- `src/hooks/use-settings.ts`（新增 `workDirectory` 字段与默认值）
- `src/screens/chat/components/chat-composer.tsx`（挂载选择器，桌面视口限定）

## 影响到的功能模块

- 会话页输入区（ChatComposer）——新增一行选择器，不影响输入、附件、slash 菜单等既有能力
- 设置持久化（StudioSettings）——新增字段，老配置读取时由默认值补齐
- Electron 预加载桥（`window.tiwork.selectDirectory`）——新增一处调用点

## 测试要点（AI 生成脚本时按此展开）

- 未设置态：文案为「选择工作目录」，菜单内展示引导语；已设置态：按钮显示目录名、菜单展示完整路径。
- 选中目录后 `updateSettings({ workDirectory })` 被调用一次，并触发成功 toast；选择返回 null 时仅提示、不写设置。
- 点击组件外部收起菜单；`open` 为 false 时不注册 `mousedown` 监听。
- 移动端视口不渲染选择器（`!isMobileViewport` 条件）。
- 默认值断言：`defaultStudioSettings.workDirectory === ''`。

## 风险点 / 遗留事项

- 本期只做 UI + 选择 + 持久化；**尚未接入数字员工实际输出路径的下游消费**（工作目录如何被引擎读取并约束产物落盘属后续范围）。
- 非 Electron 环境（纯 Web 预览）无法选择目录，仅提示——不提供降级方案，属预期行为。
