# 改动说明

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-24 |
| 作者 | AI 助手 |
| 分支 | 当前工作区 |
| 起始 commit | working-tree |
| 结束 commit | working-tree |
| 关联需求/单号 | 画像提炼与事件流打通（本地化 TDD 落地，DESK-06） |

## 功能改动点

- 新增本地行为画像聚合模块 `src/server/habit-profile.ts`（事件驱动习惯沉淀首版）：消费统一的 `desktop.policy_decision` 事件流，将用户真实执行、纠正、拒绝、确认的行为提炼为可查询的本地画像。
- 提炼 4 类画像（均保留来源溯源 source / reason / ts）：
  - **常用目录**（source=directory）：目录路径 + 访问次数 + 放行/拒绝计数 + 最近命中规则。
  - **常用网站**（source=website）：归一化域名（优先取 details.host，缺省从 URL 提取）+ 访问次数 + 放行/拒绝计数 + 最近命中规则。
  - **风险动作倾向**（source=terminal）：每个风险动作（execute_shell 等）的放行 / 需确认 / 需审批三档计数。
  - **纠偏记录**（source=approval 且 disposition=corrected）：用户推翻守卫判定的目录 / 域名 / 动作 + 方向 + 先序守卫判定（priorSource / priorResult）。
- 存储：按 Hermes 档案（profileName）隔离为 `~/.hermes/habits/{profile}.json`（default 用 `profile.json`），跨重启保留、默认私有，符合「先专属后平台化」的资产流转原则。无 profile 归属的决策归入 default。
- `publishPolicyDecision` 在事件广播**之前**调用 `updateHabitProfile` 增量聚合，即使活跃 run 期间总线丢弃广播，画像与审计事件仍保持一致；写盘失败静默降级，绝不阻断决策链路。
- 新增只读查询 `GET /api/habits?profile=&limit=`（走既有认证，返回 `{ ok, profile }`），供后续 UI / 云端消费；不新增菜单入口。
- 容量上限防膨胀：目录 / 网站各 200 条、风险动作 100 条、纠偏记录 50 条（超限按计数/时间裁剪）。
- 提取 `normalizeDomain` / `isDomainWithinScope` 至独立模块 `src/server/domain-utils.ts`，`authorization-guard.ts` 改从该模块导入并 re-export（对外导出不变，回归测试保障），消除 habit-profile → authorization-guard → policy-telemetry → habit-profile 的潜在运行时循环依赖。

## 涉及文件列表

- `src/server/habit-profile.ts`（新增画像聚合模块）
- `src/server/domain-utils.ts`（新增域名归一化工具模块）
- `src/server/authorization-guard.ts`（normalizeDomain 改为从 domain-utils 导入 + re-export）
- `src/server/policy-telemetry.ts`（publishPolicyDecision 接入 updateHabitProfile）
- `src/routes/api/habits.ts`（新增只读查询 API）
- `src/test/habit-profile.test.ts`（新增测试套件，10 个用例）
- `src/test/policy-telemetry.test.ts`（画像落盘隔离：测试期间画像指向临时目录）
- `src/test/authorization-guard.test.ts`（画像落盘隔离 + normalizeDomain 回归）

## 影响到的功能模块

- 权限与安全
- Authorization Guard（目录 / 网站 / 终端）
- 统一 Telemetry Queue / 事件驱动沉淀
- 行为画像与习惯沉淀（本地首版）
- 审计与画像 API（新增 /api/habits）
- 单元测试

## 测试要点（AI 生成脚本时按此展开）

- 未记录任何决策时返回空画像结构（version 1 / totalEvents 0 / 四类空数组）。
- 目录画像：同路径多次决策按路径归组，access/allowed/denied 计数正确，lastReason 取最近一次。
- 网站画像：details.host 优先按归一化域名归组（www 去除、小写、去协议端口路径）；无 host 时从 URL 提取域名。
- 风险动作：同一动作的 allowed / needs_confirmation / needs_approval 三档计数。
- 纠偏：仅 disposition=corrected 的 approval 事件进入 corrections，并记录 outcome / priorSource / priorResult。
- 档案隔离：不同 profileName 画像互不影响。
- 排序与 limit：directories 等按访问次数降序、limit 生效。
- 持久化：update 后 `{storeDir}/profile.json` 落盘内容与画像一致。
- 重置：resetHabitProfile 清空指定档案。
- 回归：authorization-guard 16 用例 + policy-telemetry 11 用例全部通过（normalizeDomain 提取后行为不变）。

## 风险点 / 遗留事项

- 云端画像写回（DESK-06 必做项 5）未做：`Ti OPC` 云端画像接入属后续阶段，本仓库仅做本地沉淀与查询。
- 画像推荐 / 默认动作 / 自动化升级未做：按文档要求，任何习惯推荐都不能突破 `Authorization Guard` 边界，属后续独立开发项（届时画像仅作提示输入，执行仍走守卫）。
- 画像 JSON 为本地明文（含常用路径 / 域名等），符合默认私有定位；后续如需可追加加密或脱敏策略。
- 全量回归中 `hermes-engine.test.ts` 1 个既有失败（引擎启动状态机 `expected 'starting' to be 'error'`），属本机引擎环境 / 探活时序问题，与本轮改动无关，未处理。
