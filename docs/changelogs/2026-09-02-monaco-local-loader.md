# 改动说明：Monaco 编辑器本地化加载（离线/内网可用）

> 用途：记录将 Monaco 编辑器从 CDN 加载改为打包本地加载，解决内网/受限环境编辑器永久 Loading 的问题。
> 生成时间：2026-09-02
> 作者：Ti Work

---

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-09-02 |
| 作者 | Ti Work |
| 关联需求/单号 | FEAT-EDIT-0002 |
| 分支 | main |

---

## 背景 / 问题

`@monaco-editor/react` 默认从 jsdelivr CDN 拉取 `monaco-editor`，内网/受限环境下会永久卡在 Loading，编辑器不可用。

## 功能改动点

- **本地 Monaco 加载器**：新增 `src/lib/monaco.ts`，动态 import 本地 `monaco-editor` 与所需 worker（editor/ts），注入 `MonacoEnvironment.getWorker`，通过 `loader.config({ monaco })` 让 `@monaco-editor/react` 直接使用本地实例，完全不再请求外部 CDN。
- **SSR 兼容**：`vite.config.ts` 设置 `ssr.noExternal=true` 的情况下 Monaco 依赖浏览器 API 不可静态 import，加载器仅在客户端（useEffect）动态触发，与 `terminal-workspace.tsx` 中 xterm 的处理方式一致。
- **依赖落包**：`package.json` / `pnpm-lock.yaml` 新增 `monaco-editor` 本地依赖。
- **编辑器接入**：`MemoryEditor.tsx` 通过 `useMonacoReady()` 等待本地 Monaco 就绪后再渲染编辑器。

## 涉及文件列表

- `src/lib/monaco.ts`（新增，本地加载器）
- `src/components/memory-viewer/MemoryEditor.tsx`（接入就绪等待）
- `vite.config.ts`（SSR external 兼容）
- `package.json` / `pnpm-lock.yaml`（monaco-editor 依赖）

## 影响到的功能模块

- 记忆浏览器（MemoryEditor）

## 测试要点

- 无外网/拦截 CDN 场景下编辑器正常加载，无 Loading 卡死。
- `pnpm build`（client + SSR）通过，服务端不引用 Monaco。
- 回归：`pnpm lint`、`pnpm vitest run`。

## 风险点 / 遗留事项

- 本地打包会增大产物体积（Monaco 为较大依赖），后续可按需裁剪语言包。
- 若未来使用更丰富的语言特性，需同步补充对应 worker 配置。
