'use client'

/**
 * Patterns & Corrections Screen — surfaces agent learnings from MEMORY.md.
 *
 * Hermes stores memory as `§`-delimited entries in ~/.hermes/memories/MEMORY.md.
 * This screen reads that file, classifies each entry, and presents two tabs:
 *
 *   Patterns   — all entries NOT prefixed with "CORRECTION:"
 *   Corrections — entries prefixed with "CORRECTION:" + a form to add new ones
 *
 * Writes (add correction, delete entry) go back through POST /api/memory/write
 * which overwrites the full file — same pattern as the agent itself.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MemoryEntry as Entry } from '@/lib/memory-parser'
import {
  appendCorrection,
  buildMemoryContent,
  parseEntries,
  removeEntry,
} from '@/lib/memory-parser'

// ── Constants ─────────────────────────────────────────────────────────────────

const MEMORY_PATH = 'memories/MEMORY.md'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'patterns' | 'corrections'

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchMemory(): Promise<string> {
  const res = await fetch(
    `/api/memory/read?path=${encodeURIComponent(MEMORY_PATH)}`,
  )
  if (res.status === 404) return ''
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return typeof data.content === 'string' ? data.content : ''
}

async function saveMemory(content: string): Promise<void> {
  const res = await fetch('/api/memory/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: MEMORY_PATH, content }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onDelete,
}: {
  entry: Entry
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const preview = entry.body.length > 180 ? entry.body.slice(0, 180) + '…' : entry.body

  return (
    <div
      style={{
        background: 'var(--theme-card)',
        border: '1px solid var(--theme-border)',
        borderRadius: 10,
        padding: '0.75rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
      }}
    >
      <div
        style={{
          fontSize: '0.8rem',
          color: 'var(--theme-text)',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {expanded ? entry.body : preview}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.5rem',
          marginTop: '0.25rem',
        }}
      >
        {entry.body.length > 180 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              fontSize: '0.7rem',
              color: 'var(--theme-text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {expanded ? '收起' : '展开'}
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          style={{
            fontSize: '0.7rem',
            color: 'var(--theme-error, #ef4444)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
          title="删除此条目"
        >
          删除
        </button>
      </div>
    </div>
  )
}

function TabButton({
  label,
  active,
  onClick,
  count,
}: {
  label: string
  active: boolean
  onClick: () => void
  count: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.4rem 0.9rem',
        borderRadius: 999,
        fontSize: '0.78rem',
        fontWeight: active ? 600 : 400,
        border: 'none',
        cursor: 'pointer',
        background: active
          ? 'var(--theme-accent, #6366f1)'
          : 'var(--theme-surface-2, #1e1e2e)',
        color: active ? '#fff' : 'var(--theme-text-muted)',
        transition: 'background 0.15s, color 0.15s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
      }}
    >
      {label}
      <span
        style={{
          display: 'inline-block',
          minWidth: 18,
          textAlign: 'center',
          borderRadius: 999,
          padding: '0 5px',
          fontSize: '0.65rem',
          background: active ? 'rgba(255,255,255,0.25)' : 'var(--theme-border)',
          color: active ? '#fff' : 'var(--theme-text-muted)',
        }}
      >
        {count}
      </span>
    </button>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function PatternsCorrectionScreen() {
  const [rawContent, setRawContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<Tab>('patterns')
  const [search, setSearch] = useState('')
  const [newCorrection, setNewCorrection] = useState('')
  const [addMsg, setAddMsg] = useState<string | null>(null)

  const entries = useMemo(
    () => (rawContent !== null ? parseEntries(rawContent) : []),
    [rawContent],
  )

  const patterns = useMemo(
    () => entries.filter((e) => !e.isCorrection),
    [entries],
  )
  const corrections = useMemo(
    () => entries.filter((e) => e.isCorrection),
    [entries],
  )

  const filteredPatterns = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? patterns.filter((e) => e.body.toLowerCase().includes(q)) : patterns
  }, [patterns, search])

  const filteredCorrections = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q
      ? corrections.filter((e) => e.body.toLowerCase().includes(q))
      : corrections
  }, [corrections, search])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchMemory()
      .then((text) => {
        setRawContent(text)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '加载失败')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = useCallback(
    async (entryIndex: number) => {
      const content = removeEntry(rawContent ?? '', entryIndex)
      setSaving(true)
      try {
        await saveMemory(content)
        setRawContent(content)
      } catch (err) {
        setError(err instanceof Error ? err.message : '保存失败')
      } finally {
        setSaving(false)
      }
    },
    [rawContent],
  )

  const handleAddCorrection = useCallback(async () => {
    const body = newCorrection.trim()
    if (!body) return
    const newContent = appendCorrection(rawContent ?? '', body)
    setSaving(true)
    setAddMsg(null)
    try {
      await saveMemory(newContent)
      setRawContent(newContent)
      setNewCorrection('')
      setAddMsg('修正已添加。')
      setTimeout(() => setAddMsg(null), 3000)
    } catch (err) {
      setAddMsg(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }, [rawContent, newCorrection])

  const displayed = tab === 'patterns' ? filteredPatterns : filteredCorrections

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--theme-bg)',
        color: 'var(--theme-text)',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>
          模式与修正
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--theme-text-muted)' }}>
          来自{' '}
          <code style={{ fontFamily: 'monospace' }}>~/.hermes/memories/MEMORY.md</code>{' '}
          的学习总结 — 按{' '}
          <code style={{ fontFamily: 'monospace' }}>§</code> 分隔符解析
        </p>
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid #ef4444',
            borderRadius: 8,
            padding: '0.6rem 0.9rem',
            fontSize: '0.8rem',
            color: '#ef4444',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {error}
          <button
            type="button"
            onClick={load}
            style={{
              fontSize: '0.75rem',
              color: '#ef4444',
              border: '1px solid #ef4444',
              borderRadius: 6,
              padding: '0.2rem 0.6rem',
              background: 'none',
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--theme-text-muted)', fontSize: '0.85rem' }}>
          加载中…
        </div>
      ) : (
        <>
          {/* Tabs + search row */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.6rem',
              alignItems: 'center',
            }}
          >
            <TabButton
              label="模式"
              active={tab === 'patterns'}
              onClick={() => setTab('patterns')}
              count={patterns.length}
            />
            <TabButton
              label="修正"
              active={tab === 'corrections'}
              onClick={() => setTab('corrections')}
              count={corrections.length}
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索…"
              style={{
                marginLeft: 'auto',
                background: 'var(--theme-card)',
                border: '1px solid var(--theme-border)',
                borderRadius: 8,
                padding: '0.35rem 0.7rem',
                fontSize: '0.78rem',
                color: 'var(--theme-text)',
                outline: 'none',
                width: 200,
              }}
            />
            <button
              type="button"
              onClick={load}
              disabled={saving}
              style={{
                fontSize: '0.75rem',
                color: 'var(--theme-text-muted)',
                background: 'var(--theme-card)',
                border: '1px solid var(--theme-border)',
                borderRadius: 8,
                padding: '0.35rem 0.7rem',
                cursor: 'pointer',
              }}
            >
              刷新
            </button>
          </div>

          {/* Add correction form (corrections tab only) */}
          {tab === 'corrections' && (
            <div
              style={{
                background: 'var(--theme-card)',
                border: '1px solid var(--theme-border)',
                borderRadius: 12,
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--theme-text-muted)',
                }}
              >
                添加修正
              </div>
              <textarea
                value={newCorrection}
                onChange={(e) => setNewCorrection(e.target.value)}
                placeholder="描述智能体做错了什么以及正确的行为是什么…"
                rows={3}
                style={{
                  background: 'var(--theme-bg)',
                  border: '1px solid var(--theme-border)',
                  borderRadius: 8,
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8rem',
                  color: 'var(--theme-text)',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              {addMsg && (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: addMsg.startsWith('保存失败') ? '#ef4444' : '#22c55e',
                  }}
                >
                  {addMsg}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleAddCorrection}
                  disabled={saving || !newCorrection.trim()}
                  style={{
                    background: 'var(--theme-accent, #6366f1)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '0.45rem 1rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: saving || !newCorrection.trim() ? 0.5 : 1,
                  }}
                >
                  {saving ? '保存中…' : '添加修正'}
                </button>
              </div>
            </div>
          )}

          {/* Entry list */}
          {displayed.length === 0 ? (
            <div
              style={{
                padding: '3rem 1rem',
                textAlign: 'center',
                color: 'var(--theme-text-muted)',
                fontSize: '0.85rem',
              }}
            >
              {search
                ? '没有符合搜索条件的条目。'
                : tab === 'corrections'
                  ? '还没有修正记录，使用上方表单添加一条。'
                  : '在 MEMORY.md 中未找到模式条目。'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {displayed.map((entry) => (
                <EntryCard
                  key={entry.index}
                  entry={entry}
                  onDelete={() => handleDelete(entry.index)}
                />
              ))}
            </div>
          )}

          <div
            style={{
              fontSize: '0.7rem',
              color: 'var(--theme-text-muted)',
              textAlign: 'right',
              marginTop: 'auto',
            }}
          >
            {entries.length} 条 · {patterns.length} 条模式 · {corrections.length} 条修正
          </div>
        </>
      )}
    </div>
  )
}
