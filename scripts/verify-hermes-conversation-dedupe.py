# -*- coding: utf-8 -*-
"""本地移植验证：#99545 rewind 写语义 + #101470 展示投影去重（对齐上游语义）。

展示集合 = active=1 OR compacted=1，经 _dedupe_display_generations 归并：
- 尾部克隆若跨代累积（含修复前的历史会话），同内容只出现一次，优先活跃行。
- rewind 行 (0,0) 不进入展示集合。
- model-fed 读取保持 active-only（不得 regrow 被摘要的历史）。

不依赖 LLM，仅使用 hermes_state.SessionDB 的真实 SQLite 行为。
"""
import sys
import tempfile
import types
from collections import Counter
from pathlib import Path

from hermes_state import SessionDB

# 测试环境（uv 托管 python）无完整引擎依赖：get_resume_conversations 的
# model_history 投影会触发 _rows_to_conversation 懒导入 agent_runtime_helpers
# → prompt_builder → utils → yaml。repair_message_sequence 的正确性不在本
# 验证范围（仅验证 DB 语义），注入 no-op 桩避免拉取依赖树。
if "agent.agent_runtime_helpers" not in sys.modules:
    _stub = types.ModuleType("agent.agent_runtime_helpers")
    _stub.repair_message_sequence = lambda *a, **k: 0  # noqa
    sys.modules["agent.agent_runtime_helpers"] = _stub

tmp = tempfile.mkdtemp(prefix="tiwork_verify_")
db = SessionDB(Path(tmp) / "state.db")


def contents(msgs):
    return [m["content"] for m in msgs]


def flags_of(rows, content):
    return sorted(
        (r["active"], r["compacted"])
        for r in rows
        if r["content"] == content
    )


def assert_unique_cont(msgs, label):
    c = Counter(contents(msgs))
    dup = [k for k, v in c.items() if v > 1]
    assert not dup, f"{label}: 展示集合出现重复内容 {dup}"


# ══════════ 会话 1：tail_count 新语义（rewind 写路径 + 双代展示） ══════════
db.create_session("s1", source="test")
for i in range(6):
    db.append_message("s1", role="user" if i % 2 == 0 else "assistant", content=f"turn {i}")

gen1 = [
    {"role": "user", "content": "[CONTEXT COMPACTION] summary of earlier turns"},
    {"role": "assistant", "content": "Continuing from the summary."},
    {"role": "user", "content": "turn 4"},
    {"role": "assistant", "content": "turn 5"},
]
db.archive_and_compact("s1", gen1, tail_count=2)

all1 = db.get_messages("s1", include_inactive=True)
# 受保护尾部原行 rewind：active=0, compacted=0（不进展示、不再召回）
assert flags_of(all1, "turn 4") == [(0, 0), (1, 0)], flags_of(all1, "turn 4")
assert flags_of(all1, "turn 5") == [(0, 0), (1, 0)], flags_of(all1, "turn 5")
# 被摘要掉的早期行 → compacted=1（仍属于展示历史）
for i in range(4):
    assert flags_of(all1, f"turn {i}") == [(0, 1)], flags_of(all1, f"turn {i}")

# 展示读取（REST 语义）：完整历史（含 compacted 行），每条逻辑消息恰一次
disp1 = db.get_messages("s1", include_compacted=True)
c1 = contents(disp1)
assert_unique_cont(disp1, "gen1 display")
assert len(disp1) == 8, c1  # turn0-3 + summary 对 + turn4/5
assert c1.count("turn 4") == 1 and c1.count("turn 5") == 1, c1

# model-fed 读取默认 active-only：不 regrow 被摘要的历史
raw1 = db.get_messages_as_conversation("s1")
rc1 = contents(raw1)
assert len(raw1) == 4, rc1
assert all("turn 0" not in x for x in rc1) and c1.count("turn 4") == 1, rc1

# get_messages_as_conversation 展示投影与 get_messages 一致
conv1 = db.get_messages_as_conversation("s1", include_ancestors=True, include_compacted=True)
assert contents(conv1) == c1, (contents(conv1), c1)

# ── 第 2 代压缩：上代尾部克隆被 rewind，展示仍无重复 ──────────────────────
gen2 = [
    {"role": "user", "content": "[CONTEXT COMPACTION] second generation summary"},
    {"role": "assistant", "content": "Continuing generation 2."},
    {"role": "user", "content": "turn 4"},
    {"role": "assistant", "content": "turn 5"},
]
db.archive_and_compact("s1", gen2, tail_count=2)

all2 = db.get_messages("s1", include_inactive=True)
# 第 1 代尾部克隆（曾 active）被 rewind；summary-A 行变 compacted=1
f_t4 = flags_of(all2, "turn 4")
assert f_t4 == [(0, 0), (0, 0), (1, 0)], f_t4
f_t5 = flags_of(all2, "turn 5")
assert f_t5 == [(0, 0), (0, 0), (1, 0)], f_t5

disp2 = db.get_messages("s1", include_compacted=True)
assert_unique_cont(disp2, "gen2 display")
assert len(disp2) == 10, contents(disp2)
assert contents(disp2).count("turn 4") == 1 and contents(disp2).count("turn 5") == 1

# resume 双投影一致性
mh, dh = db.get_resume_conversations("s1")
mc = contents(mh)
assert len(mh) == 4, mc  # tip 活跃集 = summary-B + turn4/5
assert_unique_cont(dh, "gen2 resume display")
assert db.get_resume_message_count("s1") == len(dh), (
    db.get_resume_message_count("s1"), len(dh))
assert len(dh) >= len(mh), (len(dh), len(mh))
assert db.assert_resume_safe("s1", max_messages=0) == 0

# ══════════ 会话 2：修复前的历史会话形态（tail_count=0 全量归档、尾部跨代累积）
# 读侧去重仍必须把它压成无重复展示 —— 这正是用户看到的"对话重复"数据库形态
db.create_session("s2", source="test")
for i in range(4):
    db.append_message("s2", role="user" if i % 2 == 0 else "assistant", content=f"b{i}")
# 压缩克隆逐字节一致的前提：carried-forward 尾部携带原行 timestamp（引擎真实
# 行为，_insert_message_rows 保留 dict 内 timestamp）→ 跨代克隆同 key 才能归并。
orig = {m["content"]: m for m in db.get_messages("s2", include_inactive=True)}
tail_b = [orig["b2"], orig["b3"]]

legacy_gen1 = [
    {"role": "user", "content": "[CONTEXT COMPACTION] legacy summary A"},
    {"role": "assistant", "content": "Continuing legacy A."},
    *tail_b,
]
db.archive_and_compact("s2", legacy_gen1)  # tail_count=0：历史归档行为
legacy_gen2 = [
    {"role": "user", "content": "[CONTEXT COMPACTION] legacy summary B"},
    {"role": "assistant", "content": "Continuing legacy B."},
    *tail_b,
]
db.archive_and_compact("s2", legacy_gen2)

raw_rows = db.get_messages("s2", include_inactive=True)
# 历史行为不变：所有归档行 compacted=1，无一 rewind(0,0)
assert flags_of(raw_rows, "b0") == [(0, 1)], flags_of(raw_rows, "b0")
# b2 的原行 + 两代克隆 = 三行同内容同时间戳：修复前会重复的 DB 形态
f_b2 = flags_of(raw_rows, "b2")
assert f_b2 == [(0, 1), (0, 1), (1, 0)], f_b2

# 读侧去重：b2/b3 各恰一次，展示不重复（核心回归点）
disp_legacy = db.get_messages("s2", include_compacted=True)
assert_unique_cont(disp_legacy, "legacy display")
lc = contents(disp_legacy)
assert lc.count("b2") == 1 and lc.count("b3") == 1, lc
# 存活的 b2 是活跃克隆（去重偏好 active 行）
survivor = next(m for m in disp_legacy if m["content"] == "b2")
assert survivor["active"], survivor
assert len(disp_legacy) == 8, lc  # b0/b1 + sumA 对 + sumB 对 + b2/b3（各 3 行压 1 行）

# model-fed 仍 active-only（4 条），不膨胀
raw_legacy = db.get_messages_as_conversation("s2")
assert len(raw_legacy) == 4, contents(raw_legacy)

# ══════════ 会话 3：tail_count=0 默认保持历史归档（回归写路径默认值） ══════════
db.create_session("s3", source="test")
for i in range(4):
    db.append_message("s3", role="user" if i % 2 == 0 else "assistant", content=f"x{i}")
db.archive_and_compact("s3", [
    {"role": "user", "content": "[CONTEXT COMPACTION] plain summary"},
    {"role": "assistant", "content": "plain continue"},
])
rows3 = db.get_messages("s3", include_inactive=True)
for r in rows3:
    if r["active"] == 0:
        assert r["compacted"] == 1, r

# ══════════ 组合参数守卫 ══════════
try:
    db.get_messages("s1", include_compacted=True, include_inactive=True)
    raise SystemExit("应拒绝 include_compacted + include_inactive 组合")
except ValueError:
    pass

print("ALL ASSERTS PASSED")
print("gen1 display :", c1)
print("gen2 display :", contents(disp2))
print("legacy display:", lc)
print("model_history count:", len(mh), "display count:", len(dh))
