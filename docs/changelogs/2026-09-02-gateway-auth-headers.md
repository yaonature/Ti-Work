# 改动说明：API 认证头贯通与网关文案统一

> 用途：记录服务端网关调用统一携带 API 认证头（Bearer Token），并将网关提示文案由「Hermes」统一为「Ti Work / 执行引擎」。
> 生成时间：2026-09-02
> 作者：Ti Work

---

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-09-02 |
| 作者 | Ti Work |
| 关联需求/单号 | AUTH-GW-0001 |
| 分支 | main |

---

## 背景 / 问题

网关（hermes --gateway）在启用 `API_SERVER_KEY` 鉴权后，前端部分 API 路由的代理请求未携带 Bearer Token，导致 401 拒绝；另有若干接口未统一走认证头工具。

## 功能改动点

- **认证头工具导出**：`gateway-capabilities.ts` 将内部 `authHeaders()` 改为导出，集中读取 `API_SERVER_KEY` 生成 `Authorization: Bearer <token>`。
- **路由贯通**：`api/hermes-jobs.ts`、`api/hermes-jobs.$jobId.ts` 的 GET/POST/PATCH/DELETE 代理请求统一携带 `authHeaders()`。
- **文案统一**：网关升级指引、会话 API 不可用提示、网关离线提示等由「Hermes 执行引擎」统一为「执行引擎 / Ti Work」文案。

## 涉及文件列表

- `src/server/gateway-capabilities.ts`（导出 authHeaders + 文案统一）
- `src/routes/api/hermes-jobs.ts`（代理请求带认证头）
- `src/routes/api/hermes-jobs.$jobId.ts`（代理请求带认证头）

## 影响到的功能模块

- 定时任务 API 代理（hermes-jobs）
- 网关连通性提示文案

## 测试要点

- 网关开启 `API_SERVER_KEY` 后，定时任务列表/详情/增删改请求返回 200 而非 401。
- 未配置 token 时请求行为与原先一致（不发送认证头）。
- 回归：`pnpm lint`、`pnpm vitest run`。

## 风险点 / 遗留事项

- 其余 API 路由的代理请求若后续网关启用强鉴权，需同步补充认证头。
