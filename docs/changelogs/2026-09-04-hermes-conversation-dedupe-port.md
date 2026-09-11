# 改动说明

## 元信息

| 字段 | 值 |
|------|-----|
| 日期 | 2026-09-04 |
| 作者 | AI 助手 |
| 分支 | 当前工作区 |
| 起始 commit | working-tree（.research/hermes-agent 内未提交改动） |
| 结束 commit | working-tree |
| 关联需求/单号 | 桌面会话页「对话重复」问题；上游 NousResearch/hermes-agent issue #101938、PR #99545 / #101470 |

## 功能改动点

修复「引擎压缩后对话区出现重复消息」。根因经 GitHub 上游（NousResearch/hermes-agent，本仓库已非开源仓库）溯源确认，为双根因叠加：

1. **写侧（#99545，issue #86366/#101938）**：`archive_and_compact` 每次 in-place 压缩都把"受保护尾部"以新 id 克隆重插为活跃行，原行被软归档。跨代压缩后同一条逻辑消息在 DB 累积多条同内容行；此前既无 rewind 语义也无读侧去重，活跃/展示集合出现多份重复。
2. **读侧（#101470，issue #92080/#101938）**：展示投影此前未对压缩代次去重，前端仅按单一 id 排重，无法合并"同内容不同行"。

以最小改动、语义化重写方式移植两个上游补丁到当前 hermes-agent（0.20.0 基线）源码，不整包替换：

- `hermes_state.archive_and_compact` 新增 `tail_count` 参数：`tail_count>0` 时把被新克隆取代的尾部原行标记为 **rewind 语义（active=0, compacted=0）**，其余活跃行归档为 compacted=1；默认 `tail_count=0` 保持历史归档行为。本地无上游 watermark/tail_ids 设施，rewind 目标简化为"压缩前最后 N 条 active 行"。
- `agent/context_compressor.py` 新增 `_COMPACTION_TAIL_MARKER`：`compress()` 对 carried-forward 尾行（含摘要 merge 目标行）立即打标；`_sync_micro_compact_to_db` 传 `tail_count=len-1`（微压缩除摘要标记行外全部为原样携带）。
- `agent/conversation_compression.py`：in-place 提交点在大小估算（anti-growth）之前 pop 标记，按**最终提交列表**统计 `tail_count` 传入 `archive_and_compact`。
- 读侧新增唯一归并定义 `_dedupe_display_generations`（本地无 `split_user_originated_turn` 拆分设施，直接用 DB 存储列 role/content/timestamp/tool_call_id/tool_calls/tool_name 作 key；活跃行优先、其次 id 较新的代），并统一接入各展示投影：
  - `get_messages(include_compacted=True)`（REST 展示转录；与 include_inactive/after_id 互斥，分页在去重后）；
  - `get_messages_as_conversation(include_compacted=True)`；
  - `get_resume_conversations`：展示投影含 `(active=1 OR compacted=1)` 全谱系并去重；model 投影保持 active-only；
  - `get_resume_message_count` / `assert_resume_safe` 按展示集合（active OR compacted）计数；
  - `get_ancestor_display_prefix`：先去重再剔除 tip 行。
- 展示集合定义 = `active=1 OR compacted=1`（rewind/undo 的 0,0 行不入展示、不再被召回）；model-fed 读取保持 active-only，压缩掉的摘要前历史不会被重新喂给模型。
- 接线：REST `sessions.py get_session_messages` 与 gateway 展示读取（`tui_gateway/server.py`、`tui_gateway/methods_session.py`）的展示转录读取开启 `include_compacted=True`。

## 涉及文件列表

- `.research/hermes-agent/hermes_state.py`（写侧 tail_count/rewind + 读侧 _dedupe_display_generations/include_compacted/各展示投影）
- `.research/hermes-agent/agent/context_compressor.py`（_COMPACTION_TAIL_MARKER + 打标 + tail_count 传递）
- `.research/hermes-agent/agent/conversation_compression.py`（pop 标记 + in-place 提交 tail_count）
- `.research/hermes-agent/hermes_cli/web_routers/sessions.py`（REST 展示转录 include_compacted=True）
- `.research/hermes-agent/tui_gateway/server.py`、`.research/hermes-agent/tui_gateway/methods_session.py`（gateway 展示读取 include_compacted=True）
- 交付包同步：`.bootstrap-stage/hermes-agent-source`（`node scripts/stage-hermes-bootstrap.mjs`）
- `scripts/verify-hermes-conversation-dedupe.py`（新增，DB 层集成验证）

## 影响到的功能模块

- 会话展示转录（REST `GET /api/sessions/{id}/messages`）
- gateway 会话恢复 / 直播可见历史（session.resume 双投影）
- 上下文压缩（in-place 压缩 / 微压缩）
- 会话搜索召回（rewind 行不再被召回）

## 测试要点（AI 生成脚本时按此展开）

`scripts/verify-hermes-conversation-dedupe.py` 本地已跑通（`ALL ASSERTS PASSED`）。运行方式（使用项目 uv 托管 python）：

```
$env:PYTHONPATH = "d:\projects\Hermes-Studio\.research\hermes-agent"
python scripts/verify-hermes-conversation-dedupe.py
```

- 会话 1（rewind 新语义）：tail_count>0 压缩后尾部原行 → (0,0)，被摘要行 → (0,1)；连续两代压缩后展示集合每条逻辑消息恰一次；model-fed 默认读取保持 active-only 不膨胀；resume model/display 双投影一致；计数守卫按展示集合。
- 会话 2（修复前历史会话形态）：跨代同内容同 timestamp 的克隆（原行 + 两代克隆 3 行）在展示中去重为 1 条且优先活跃行 —— 对应线上历史会话无需回填即可消除重复。
- 会话 3（tail_count=0 默认）：保持历史归档行为（全部 compacted=1，无 rewind 行）。
- 组合参数守卫：include_compacted 与 include_inactive/after_id 互斥。

## 风险点 / 遗留事项

- 修复只作用于**此后**的压缩代（写侧）与**全部**展示读取（读侧，含历史会话）；真实"压缩后桌面无重复"需在长会话触发自动压缩后于桌面会话页观察确认（后续观察点）。
- 本地 0.20.0 与上游存在结构性差异（无 watermark / tail_ids / split_user_originated_turn），移植为语义等价简化版；若后续引擎大版本升级对齐上游，可再核对差异点。
