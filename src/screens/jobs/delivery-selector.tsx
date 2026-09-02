'use client'

import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'

const DELIVERY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'local', label: '本地' },
  { value: 'feishu', label: '飞书' },
]

export function DeliverySelector({
  value,
  onChange,
}: {
  value: Array<string>
  onChange: (next: Array<string>) => void
}) {
  const navigate = useNavigate()
  const [feishuConfigured, setFeishuConfigured] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadFeishuStatus() {
      try {
        const res = await fetch('/api/integrations')
        const data = await res.json()
        if (!cancelled) {
          setFeishuConfigured(Boolean(data?.integrations?.feishu?.configured))
        }
      } catch {
        if (!cancelled) setFeishuConfigured(false)
      }
    }
    void loadFeishuStatus()
    return () => {
      cancelled = true
    }
  }, [])

  function toggleDelivery(target: string) {
    const next = value.includes(target)
      ? value.filter((item) => item !== target)
      : [...value, target]
    onChange(next)
  }

  const feishuSelected = value.includes('feishu')
  const showFeishuGuide = feishuSelected && !feishuConfigured

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">投递到</label>
      <div className="flex flex-wrap gap-2">
        {DELIVERY_OPTIONS.map((option) => {
          const isActive = value.includes(option.value)
          const isFeishu = option.value === 'feishu'
          const missingFeishu = isFeishu && !feishuConfigured
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleDelivery(option.value)}
              title={
                missingFeishu
                  ? '飞书尚未配置，配置后结果将自动投递到飞书群'
                  : undefined
              }
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: isActive
                  ? 'var(--theme-accent)'
                  : 'var(--theme-card)',
                borderColor: isActive
                  ? 'var(--theme-accent)'
                  : missingFeishu
                    ? 'var(--theme-warning)'
                    : 'var(--theme-border)',
                color: isActive
                  ? '#fff'
                  : missingFeishu
                    ? 'var(--theme-warning)'
                    : 'var(--theme-text)',
              }}
            >
              {option.label}
              {missingFeishu ? (
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: 'var(--theme-warning)' }}
                />
              ) : null}
            </button>
          )
        })}
      </div>

      {showFeishuGuide ? (
        <div className="mt-1 flex items-center gap-3 rounded-lg border border-[var(--theme-warning)]/40 bg-[var(--theme-warning)]/10 px-3 py-2.5 text-xs">
          <span className="flex-1" style={{ color: 'var(--theme-warning)' }}>
            飞书尚未配置。配置后，定时任务结果将自动投递到指定飞书群。
          </span>
          <button
            type="button"
            onClick={() =>
              navigate({ to: '/settings', search: { section: 'integrations' } })
            }
            className="shrink-0 rounded-full bg-[var(--theme-warning)] px-3 py-1 font-medium text-white transition-opacity hover:opacity-90"
          >
            去配置
          </button>
        </div>
      ) : null}
    </div>
  )
}
