# -*- coding: utf-8 -*-
"""本地移植验证：上游三 bug 修复对齐。

覆盖（基于本地实际代码而非版本号）：
- A1 #102352：损坏/非有限消息时间戳（1e30、inf、nan、文本垃圾）不再中止整份导出。
  三个导出器回退为原始字符串；HTML 出口对回退值做转义，避免坏值当标记注入。
- A2 #102044：本地推理服务（llama.cpp / llama-server、LM Studio 等）HTTP 500 的
  "model ... failed to load" 由 retryable server_error 改判为非可重试 + 允许
  failover；无 HTTP 状态包装的消息路径同样覆盖。
- B1 #102644：ContextCompressor 惰性 _resolve_context_length 透传 custom_providers，
  使 config_context_length=None 时仍能命中 providers.<name>.models.<id>.context_length，
  不再退回 /models HTTP 探测。

不依赖 LLM/网络。yaml 桩仅用于满足导入链：
hermes_cli.config -> agent.credential_pool -> agent.auxiliary_client ->
agent.context_compressor / agent.model_metadata 在裸解释器（无 PyYAML）下导入。
"""
import re
import sys
import types

_ENGINE = r"d:\projects\Hermes-Studio\.research\hermes-agent"
if _ENGINE not in sys.path:
    sys.path.insert(0, _ENGINE)

# ── yaml 导入桩（仅静态属性，模块级 import 用）─────────────────────────────
_y = types.ModuleType("yaml")
_y.safe_load = lambda *a, **k: None
_y.safe_dump = lambda *a, **k: ""
_y.load = lambda *a, **k: None
_y.dump = lambda *a, **k: ""
_y.YAMLError = Exception
_y.YAMLObject = object
_y.SafeLoader = object
_y.SafeDumper = object
_y.Loader = object
_y.Dumper = object
_y.FullLoader = object
_y.BaseLoader = object
_y.Node = object
_y.MappingNode = object
_y.SequenceNode = object
_y.ScalarNode = object
_y.add_representer = lambda *a, **k: None
_y.add_implicit_resolver = lambda *a, **k: None
_y.add_constructor = lambda *a, **k: None
_y.representer = types.SimpleNamespace
_y.constructor = types.SimpleNamespace
_y.parser = types.SimpleNamespace
_y.composer = types.SimpleNamespace
_y.scanner = types.SimpleNamespace
_y.tokens = types.SimpleNamespace
_y.events = types.SimpleNamespace
_y.resolver = types.SimpleNamespace
sys.modules["yaml"] = _y


# ═══════════════════════════════════════════════════════════════════════════
# A1 #102352 —— 三个导出器的时间戳回退
# ═══════════════════════════════════════════════════════════════════════════
from hermes_cli import session_export as json_export          # noqa: E402
from hermes_cli import session_export_html as html_export      # noqa: E402
from hermes_cli import session_export_md as md_export          # noqa: E402

BAD_VALUES = [1e30, float("inf"), float("nan")]

# 1) 通用导出器 _format_timestamp：坏值回退原始字符串，不抛异常
for _v in BAD_VALUES:
    assert json_export._format_timestamp(_v) == str(_v), (_v, json_export._format_timestamp(_v))
assert json_export._format_timestamp("not-a-time") == "not-a-time"
assert json_export._format_timestamp(None) is None
_ok = json_export._format_timestamp(1700000000.0)
assert isinstance(_ok, str) and _ok.endswith("Z"), _ok

# 2) Markdown/QMD 辅助 _iso_timestamp：同样回退
for _v in BAD_VALUES + ["garbage-text"]:
    assert md_export._iso_timestamp(_v) == str(_v), (_v, md_export._iso_timestamp(_v))
assert md_export._iso_timestamp("") == ""
assert md_export._iso_timestamp(1700000000.0).startswith("2023-11-14T"), md_export._iso_timestamp(1700000000.0)

# 3) HTML 导出器 _format_timestamp：回退值必须被 HTML 转义
assert html_export._format_timestamp(1e30) == "1e+30"
_evil = html_export._format_timestamp("<script>alert(1)</script>")
assert "<script>" not in _evil and "&lt;script&gt;" in _evil, _evil
assert re.fullmatch(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}",
                    html_export._format_timestamp(1700000000.0))

# 4) 端到端：单条坏行不再中止整份导出，且回退文本出现在产物里
_SESSIONS = [{
    "id": "s-bad-ts",
    "title": "bad timestamps",
    "started_at": 1e30,
    "messages": [
        {"id": "m1", "role": "user", "content": "hi", "timestamp": 1e30},
        {"id": "m2", "role": "user", "content": "inf", "timestamp": float("inf")},
        {"id": "m3", "role": "user", "content": "nan", "timestamp": float("nan")},
        {"id": "m4", "role": "user", "content": "text", "timestamp": "garbage"},
        {"id": "m5", "role": "assistant", "content": "ok", "timestamp": 1700000000.0},
    ],
}]
_jsonl = json_export.render_sessions_export(_SESSIONS, fmt="jsonl", only="user-prompts")
assert "1e+30" in _jsonl and "garbage" in _jsonl, _jsonl
_md = json_export.render_sessions_export(_SESSIONS, fmt="md")
assert "1e+30" in _md and "garbage" in _md, _md
_qmd = md_export.render_session_markdown(_SESSIONS[0], fmt="qmd")
assert "1e+30" in _qmd, _qmd
_html = html_export._generate_messages_html(_SESSIONS[0]["messages"])
assert "1e+30" in _html and "garbage" in _html, _html
assert "<script>" not in _html
print("A1 #102352 OK：三类导出器坏时间戳均回退，单行不中止整份导出")


# ═══════════════════════════════════════════════════════════════════════════
# A2 #102044 —— 本地推理"模型加载失败"500 归类为非可重试 + 允许 failover
# ═══════════════════════════════════════════════════════════════════════════
from agent.error_classifier import classify_api_error, FailoverReason  # noqa: E402


def _mk(msg, status_code=None, body=None):
    """构造带 .status_code / .body 的最小 SDK 风格异常（对齐既有测试惯例）。"""
    e = Exception(msg)
    e.status_code = status_code
    if body is not None:
        e.body = body
    return e


# 4a) HTTP 500/502 + 消息命中 → server_error / 非重试 / 允许 failover
for _sc, _msg in [
    (500, "model name=qwen2.5-7b failed to load"),
    (502, "model load failed for gpt-4o"),
    (500, "error loading model qwen3-8b"),
    (502, "unable to load model gemma-3-12b"),
]:
    _r = classify_api_error(_mk(_msg, status_code=_sc),
                            provider="local", model="qwen2.5-7b")
    assert _r.reason == FailoverReason.server_error, (_sc, _msg, _r.reason)
    assert _r.retryable is False, (_sc, _msg, _r.retryable)
    assert _r.should_fallback is True, (_sc, _msg, _r.should_fallback)
    assert _r.should_compress is False, (_sc, _msg, _r.should_compress)

# 4b) 错误体 JSON 里的消息也要命中（llama.cpp 500 体：{"error":{"message": ...}}）
_body_msg = _mk("httpx error", status_code=500,
                body={"error": {"message": "model name=qwen2.5-7b failed to load"}})
_r = classify_api_error(_body_msg, provider="local", model="qwen2.5-7b")
assert _r.retryable is False and _r.should_fallback is True, (_r.reason, _r.retryable, _r.should_fallback)

# 4c) 无 HTTP 状态包装的消息路径（本地 shim 裸抛 RuntimeError）
for _msg in ["model load failed", "error loading model"]:
    _r = classify_api_error(_mk(_msg), provider="local", model="qwen2.5-7b")
    assert _r.reason == FailoverReason.server_error, (_msg, _r.reason)
    assert _r.retryable is False and _r.should_fallback is True, (_msg, _r.retryable, _r.should_fallback)

# 4d) 回归：不命中新模式的普通 500 仍保持 retryable，不允许同模型无脑切换
_r = classify_api_error(_mk("Internal server error, please retry", status_code=500),
                        provider="local", model="qwen2.5-7b")
assert _r.retryable is True and _r.should_fallback is False, (_r.retryable, _r.should_fallback)

# 4e) 回归：500 分支内既有守卫顺序不被破坏——请求校验错误仍判 format_error
_req = classify_api_error(
    _mk("unsupported parameter 'temperature2'", status_code=502,
        body={"error": {"code": "unknown_parameter"}}),
    provider="local", model="qwen2.5-7b")
assert _req.reason == FailoverReason.format_error and _req.retryable is False, _req.reason
print("A2 #102044 OK：模型加载失败 500/无状态消息 → 非重试 + failover；普通 500 不受影响")


# ═══════════════════════════════════════════════════════════════════════════
# B1 #102644 —— ContextCompressor 惰性解析透传 custom_providers
# ═══════════════════════════════════════════════════════════════════════════
import agent.context_compressor as cc_mod  # noqa: E402

_CP = {"base_url": "http://127.0.0.1:8080",
       "models": {"qwen2.5-7b": {"context_length": 32768}}}
_SEEN = {}


def _fake_gmcl(model, *, base_url=None, api_key=None, config_context_length=None,
               provider=None, custom_providers=None):
    """记录实参并返回固定窗口，隔离真实 /models 探测与网络。"""
    _SEEN["model"] = model
    _SEEN["base_url"] = base_url
    _SEEN["config_context_length"] = config_context_length
    _SEEN["provider"] = provider
    _SEEN["custom_providers"] = custom_providers
    return 32768


_orig_gmcl = cc_mod.get_model_context_length
cc_mod.get_model_context_length = _fake_gmcl
try:
    # 5a) 修复点：config_context_length=None 时 custom_providers 被透传，
    #     惰性首次解析不再退回 /models 探测（修复前 _SEEN 里永远拿不到列表）
    c = cc_mod.ContextCompressor(
        model="qwen2.5-7b", quiet_mode=True,
        config_context_length=None, provider="custom",
        base_url=_CP["base_url"], custom_providers=[_CP],
    )
    assert c._custom_providers == [_CP], c._custom_providers
    assert c.context_length == 32768
    assert _SEEN["custom_providers"] == [_CP], _SEEN
    assert _SEEN["model"] == "qwen2.5-7b"
    assert _SEEN["provider"] == "custom"
    assert _SEEN["config_context_length"] is None

    # 5b) 默认（老调用方不传 custom_providers）→ 空列表，行为不回归
    _SEEN.clear()
    c2 = cc_mod.ContextCompressor(model="m", quiet_mode=True,
                                  config_context_length=None)
    assert c2._custom_providers == [], c2._custom_providers
    assert c2.context_length == 32768
    assert _SEEN["custom_providers"] == [], _SEEN

    # 5c) 显式 config_context_length 仍原样透传（agent_init 内置压缩器形态），
    #     优先级交由 get_model_context_length 第 0 步判定，不丢配置
    _SEEN.clear()
    c3 = cc_mod.ContextCompressor(model="m", quiet_mode=True,
                                  config_context_length=64000,
                                  custom_providers=[_CP])
    assert c3.context_length == 32768
    assert _SEEN["config_context_length"] == 64000, _SEEN
    assert _SEEN["custom_providers"] == [_CP], _SEEN
finally:
    cc_mod.get_model_context_length = _orig_gmcl
print("B1 #102644 OK：惰性 _resolve_context_length 正确透传 custom_providers")


print("ALL ASSERTS PASSED")
