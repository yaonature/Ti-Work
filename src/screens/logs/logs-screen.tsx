'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, ConsoleIcon } from '@hugeicons/core-free-icons'
import { EmptyState } from '@/components/ds'

type LogLevel = 'all' | 'errors'

type LogLine = {
  raw: string
  level: 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG' | 'unknown'
}

function parseLevel(line: string): LogLine['level'] {
  if (/\bERROR\b/.test(line)) return 'ERROR'
  if (/\bWARNING\b/.test(line)) return 'WARNING'
  if (/\bINFO\b/.test(line)) return 'INFO'
  if (/\bDEBUG\b/.test(line)) return 'DEBUG'
  return 'unknown'
}

function levelClass(level: LogLine['level']): string {
  if (level === 'ERROR') return 'text-red-400'
  if (level === 'WARNING') return 'text-amber-400'
  if (level === 'DEBUG') return 'text-[var(--theme-muted)]'
  return 'text-[var(--theme-text)]'
}

export function LogsScreen() {
  const [filter, setFilter] = useState<LogLevel>('all')
  const [lines, setLines] = useState<Array<LogLine>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const level = filter === 'errors' ? 'WARNING' : 'INFO'
      const res = await fetch(
        `/api/hermes-proxy/api/logs?level=${level}&tail=500`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const parsed = text
        .split('\n')
        .filter(Boolean)
        .map((raw) => ({ raw, level: parseLevel(raw) }))
      setLines(parsed)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载日志失败')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  const visible = search
    ? lines.filter((l) => l.raw.toLowerCase().includes(search.toLowerCase()))
    : lines

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={ConsoleIcon} size={18} className="text-[var(--theme-accent)]" />
          <h1 className="text-base font-semibold text-[var(--theme-text)]">系统日志</h1>
          {lines.length > 0 && (
            <span className="rounded-full bg-[var(--theme-panel)] px-2 py-0.5 text-xs text-[var(--theme-muted)]">
              {visible.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Filter tabs */}
          <div className="flex rounded-lg border border-[var(--theme-border)] p-0.5">
            {(['all', 'errors'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setFilter(lvl)}
                className="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  background: filter === lvl ? 'var(--theme-accent)' : 'transparent',
                  color: filter === lvl ? '#fff' : 'var(--theme-muted)',
                }}
              >
                {lvl === 'all' ? '全部' : '错误'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void fetchLogs()}
            disabled={loading}
            className="rounded-lg border border-[var(--theme-border)] px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] disabled:opacity-50"
          >
            {loading ? '加载中…' : '刷新'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-[var(--theme-border)] px-4 py-2">
        <div className="relative">
          <input
            type="search"
            placeholder="筛选日志…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 pr-8 text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
              aria-label="清除搜索"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* Log content */}
      <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed">
        {error ? (
          <div className="p-8">
            <EmptyState
              icon={<HugeiconsIcon icon={ConsoleIcon} size={36} />}
              title="无法加载日志"
              description={error}
            />
          </div>
        ) : !loading && visible.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<HugeiconsIcon icon={ConsoleIcon} size={36} />}
              title="暂无日志条目"
              description={
                search
                  ? '没有与筛选条件匹配的日志。'
                  : '智能体开始运行后，日志将显示在这里。'
              }
            />
          </div>
        ) : (
          <div className="px-4 py-2">
            {visible.map((line, i) => (
              <div
                key={i}
                className={`py-0.5 ${levelClass(line.level)}`}
                style={{ wordBreak: 'break-all' }}
              >
                {line.raw}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  )
}
