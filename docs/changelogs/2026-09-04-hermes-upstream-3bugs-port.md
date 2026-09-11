# 改动说明

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-09-04 |
| 作者 | AI 助手 |
| 分支 | 当前工作区 |
| 起始 commit | working-tree（.research/hermes-agent 内未提交改动） |
| 结束 commit | working-tree |
| 关联需求/单号 | 上游 NousResearch/hermes-agent issues #102352（A1）、#102044（A2）、#102644（B1） |

## 功能改动点

基于 GitHub 上游 issues 语义 + 本地代码（0.20.0 基线混血 0.20.1-0.21）逐点移植三个可落地的错误处理修复，均以最小改动落地：

### A1 #102352 — 损坏消息时间戳不再中止整份导出

导出链路中 `datetime.fromtimestamp` 对超出平台范围 / 非有限（1e30、inf、nan）或文本垃圾时间戳会抛异常，单个坏行此前直接中止整份导出。三处格式化入口统一加守卫，坏值回退为**原始字符串**（单行降级为一段奇怪日期文本），HTML 出口额外做 HTML 转义，杜绝坏值被当成标记注入：

- `hermes_cli/session_export.py` `_format_timestamp`：int/float 分支的转换包入 try/except，捕获 `OverflowError/OSError/ValueError` 后回退 `str(value)`（JSONL 记录与 MD 行标题共用）。
- `hermes_cli/session_export_html.py` `_format_timestamp`：捕获 `OverflowError/OSError/TypeError/ValueError`，回退 `_escape_html(str(ts))`。四个调用点（消息体、侧栏 started_at、会话 Started）全部收口至此函数。
- `hermes_cli/session_export_md.py` `_iso_timestamp`：`float(value)` 与 `fromtimestamp` 同入 try，捕获 `TypeError/ValueError/OverflowError/OSError` 回退 `str(value)`。

### A2 #102044 — 本地推理"模型加载失败"500 误判 retryable 导致重试洪泛

llama.cpp / llama-server、LM Studio 等本地推理服务在服务端模型加载失败（权重缺失/损坏、量化超内存）时以 HTTP 500 上报，错误体形如 `model name=<id> failed to load`。这是确定性端点状态，同一模型盲重试只会复制同样的失败直到预算耗尽。此前落入 500/502 分支尾部粗粒度 `server_error, retryable=True` 造成洪泛：

- `agent/error_classifier.py` 新增 `_MODEL_LOAD_FAILURE_PATTERNS`（`failed to load` / `model load failed` / `error loading model` / `unable to load model`）。
- 500/502 分支：在空响应与上下文溢出守卫**之后**、粗粒度 retryable 返回**之前**插入新守卫 → `server_error, retryable=False, should_fallback=True`（配置了兜底模型的会话直接切走）。
- `_classify_by_message`（无 HTTP 状态包装的裸抛路径，如本地 shim RuntimeError）：同样插入守卫返回上述结果，避免落入 retryable 的 unknown/server_error 桶继续盲重试。
- 与 `_MODEL_NOT_FOUND_PATTERNS` / "model unloaded"（#62765）同族：未加载/加载失败的模型是端点状态信号，不是路由问题。

### B1 #102644 — ContextCompressor 惰性路径忽略 providers.<name>.models.<id>.context_length

`get_model_context_length()` 第 0b 步依赖 `custom_providers` 命中自定义提供方每模型 context_length。此前所有调用点均透传该列表，唯独 `ContextCompressor._resolve_context_length` 漏传：当 `config_context_length=None`（未显式配置且 LM Studio 运行时未核准等路径）时，惰性首次解析退回 HTTP `/models` 探测，离线/不可达端点直接回归默认窗口。重启后每次会话启动都重复此探测失败：

- `agent/context_compressor.py`：`__init__` 新增 `custom_providers: list | None = None` 参数并存储为 `self._custom_providers`（缺省空列表，老调用方零回归）。
- `_resolve_context_length()` 调用 `get_model_context_length` 时透传 `custom_providers=self._custom_providers`。
- `agent/agent_init.py`：内置压缩器构造处透传 `custom_providers=_custom_providers`（与插件 ContextEngine 路径既有的透传方式一致）。语义保留：显式 `config_context_length` 仍走第 0 步优先；为 None 时第 0b 步自定义提供方配置成为胜者。

## 涉及文件列表

- `.research/hermes-agent/hermes_cli/session_export.py`（A1）
- `.research/hermes-agent/hermes_cli/session_export_html.py`（A1）
- `.research/hermes-agent/hermes_cli/session_export_md.py`（A1）
- `.research/hermes-agent/agent/error_classifier.py`（A2）
- `.research/hermes-agent/agent/context_compressor.py`（B1）
- `.research/hermes-agent/agent/agent_init.py`（B1）
- `scripts/verify-hermes-upstream-3bugs.py`（新增，本地集成验证）

## 影响到的功能模块

- 会话导出（JSONL / Markdown / QMD / HTML 四类出口的时间戳渲染）
- API 错误分类 / failover 决策（本地推理服务 500、无状态裸抛错误）
- 上下文压缩窗口惰性解析（自定义提供方每模型 context_length 命中，离线不再退回探测失败）

## 测试要点（AI 生成脚本时按此展开）

`scripts/verify-hermes-upstream-3bugs.py` 本地已跑通（`ALL ASSERTS PASSED`）。运行方式：

```
C:\Users\Mr.xu\AppData\Roaming\uv\python\cpython-3.11-windows-x86_64-none\python.exe scripts/verify-hermes-upstream-3bugs.py
```

- A1：三导出器格式化函数对 1e30/inf/nan/文本垃圾全部回退原始字符串不抛异常；HTML 回退值必须被转义（`<script>` → `&lt;script&gt;`）；端到端（JSONL user-prompts、全量 MD、QMD、HTML 消息段）含坏行仍产出完整文本且回退值出现；正常时间戳格式不受影响。
- A2：500/502 消息命中 → `server_error, retryable=False, should_fallback=True, should_compress=False`；错误体 JSON 内消息同样命中；无状态裸抛消息路径一致；回归：普通 500 仍 `retryable=True`，请求校验 502（unknown_parameter）仍判 `format_error`（分支内既有守卫顺序未被破坏）。
- B1：monkeypatch 模块级 `get_model_context_length` 记录实参，断言 `config_context_length=None` 时 `custom_providers` 被透传且惰性解析取用返回窗口；缺省不传 → 空列表；显式 `config_context_length` 仍原样透传。
- 语法编译：六个改动文件 `python -m py_compile` 全通过（COMPILE_EXIT=0）。

## 风险点 / 遗留事项

- A2 仅改本地分类器（模式列表 + 两处守卫），未触碰 failover 消费侧（`conversation_loop._try_activate_fallback` 等）的既有语义。
- B1 只覆盖惰性首次解析路径；`update_model()` 切换/回退路径由调用方显式传入 `context_length:int`，不经此路径（上游语义一致）。
- 本地 0.20.0 与上游存在结构性差异处（如上游 issue 附带的测试/工具集）未整包并入；本批修复的最终行为建议在真实本地推理服务 + 自定义提供方配置下做一次运行时观察（后续观察点）。
