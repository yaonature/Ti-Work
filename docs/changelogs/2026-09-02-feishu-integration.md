# 改动说明：飞书自建应用集成与定时任务投递选择

> 用途：记录「飞书自建应用」授权接入（凭据校验/配置持久化/连通性测试）及定时任务「本地/飞书」投递选择能力。
> 生成时间：2026-09-02
> 作者：Ti Work

---

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-09-02 |
| 作者 | Ti Work |
| 关联需求/单号 | FEAT-INTG-0003 |
| 分支 | main |

---

## 背景 / 问题

此前集成设置仅支持通用 Webhook，无法对接飞书开放平台；定时任务投递目标写死为本地执行，无法将执行结果推送至飞书群。为满足企业协同场景，新增飞书自建应用接入链路与任务投递目标选择。

## 功能改动点

- **飞书自建应用鉴权工具**：新增 `feishu-auth.ts`，用 App ID + App Secret 换取 `tenant_access_token`（`POST /open-apis/auth/v3/tenant_access_token/internal`），用于校验企业自建应用凭据有效性，网络异常/非 JSON 响应均返回可读错误。
- **凭据配置持久化**：`integrations.ts` 新增 `FeishuAppSettings` / `FeishuAppState` 与 `getFeishuAppSettings`，飞书 App ID / Secret 纳入集成配置持久化。
- **集成配置与连通性测试接口**：新增 `api/integrations.feishu.ts`（保存/校验飞书配置）、`api/hermes-key-test.ts`（网关连通性测试）。
- **定时任务投递选择**：新增 `screens/jobs/delivery-selector.tsx`，创建/编辑任务时可选择投递目标（本地执行 / 飞书群）；`create-job-dialog.tsx`、`edit-job-dialog.tsx` 接入选择器。

## 涉及文件列表

- `src/server/feishu-auth.ts`（新增，鉴权工具）
- `src/routes/api/integrations.feishu.ts`（新增，配置保存与校验）
- `src/routes/api/hermes-key-test.ts`（新增，网关连通性测试）
- `src/screens/jobs/delivery-selector.tsx`（新增，投递目标选择）
- `src/server/integrations.ts`（飞书配置模型与持久化）
- `src/screens/jobs/create-job-dialog.tsx` / `edit-job-dialog.tsx`（接入投递选择器）

## 影响到的功能模块

- 设置 → 集成（飞书自建应用）
- 定时任务（创建/编辑 → 投递目标）

## 测试要点

- 飞书凭据校验：正确 App ID/Secret 返回成功与 `tenant_access_token`（前缀 t-）；错误凭据返回非零 code 与可读 message。
- 配置持久化：保存后重进设置页仍可读回。
- 定时任务可选择本地/飞书投递，选择状态随编辑回显。
- 回归：`pnpm lint`、`pnpm vitest run`、`pnpm build`。

## 风险点 / 遗留事项

- 飞书凭据为敏感信息，仅作校验与 token 换取，不落盘明文日志。
- 实际群消息推送能力依赖后续 webhook/机器人通道，本次仅打通配置与鉴权链路。
