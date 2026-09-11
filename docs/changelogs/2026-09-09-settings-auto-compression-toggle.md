# 改动说明

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-09-09 |
| 作者 | AI 助手 |
| 分支 | main |
| 起始 commit | working-tree |
| 结束 commit | working-tree |
| 关联需求/单号 | 设置页暴露引擎上下文压缩开关（`compression.enabled`），避免用户只能改配置文件 |

## 功能改动点

在设置页「Hermes 配置」区新增「自动压缩」开关，把引擎既有的上下文压缩能力暴露为可配置项。

- 修改 `src/routes/settings/index.tsx`：
  - 读取 `data.config.compression`（缺省空对象，配置缺失不报错）；
  - 新增 `SettingsRow`「自动压缩」，描述文案「接近上下文上限时自动总结较早消息，释放上下文空间。」；
  - `Switch` 受控值 = `readBoolean(compressionConfig.enabled, true)`（**默认开启**），切换即 `saveConfig({ config: { compression: { enabled: checked } } })`。
- 沿用本页既有 `SettingsRow` / `Switch` / `readBoolean` / `saveConfig` 组件与写入契约，无新增状态源。

## 涉及文件列表

- `src/routes/settings/index.tsx`（新增 compression 配置读取与开关行）

## 影响到的功能模块

- 设置页（Hermes 配置区）——新增一行开关，不改变既有配置项布局与保存链路
- 引擎上下文压缩行为（`compression.enabled`）——开关的直接作用对象

## 测试要点（AI 生成脚本时按此展开）

- 配置中 `compression.enabled` 缺失时，开关显示为「开」（默认 true）。
- 切换开关触发一次 `saveConfig`，载荷为 `{ config: { compression: { enabled: <新值> } } }`。
- 配置中 `compression` 整个缺失时不抛错（空对象回退）。

## 风险点 / 遗留事项

- 开关写入后**生效时机取决于引擎读取配置的时点**（是否需要重启会话/引擎未做即时热更新验证）。
- 本次只暴露 `enabled`，其余压缩参数（阈值、窗口等）仍走配置文件。
