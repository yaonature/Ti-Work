/**
 * Conductor settings — slide-out drawer for orchestrator/worker model,
 * projects directory, max parallel, and supervised mode.
 *
 * Adapted from upstream conductor.tsx settings panel.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { EmojiIcon } from '@/components/emoji-icon'
import type { ConductorSettings } from '@/types/conductor'
import { cn } from '@/lib/utils'

type AvailableModel = {
  id?: string
  provider?: string
  name?: string
}

function getModelDisplayName(model: AvailableModel | undefined, modelId: string | null | undefined): string {
  if (!modelId) return '默认（自动）'
  return model?.name?.trim() || model?.id?.trim() || modelId
}

function getProviderLabel(provider: string | null | undefined): string {
  const raw = provider?.trim()
  if (!raw) return '未知'
  return raw
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function groupModelsByProvider(models: Array<AvailableModel>) {
  const groups = new Map<string, Array<AvailableModel>>()
  for (const model of models) {
    const provider = getProviderLabel(model.provider)
    const existing = groups.get(provider)
    if (existing) {
      existing.push(model)
    } else {
      groups.set(provider, [model])
    }
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([provider, providerModels]) => ({
      provider,
      models: [...providerModels].sort((a, b) =>
        getModelDisplayName(a, a.id).localeCompare(getModelDisplayName(b, b.id)),
      ),
    }))
}

function ModelSelectorDropdown({
  label,
  value,
  onChange,
  models,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (nextValue: string) => void
  models: Array<AvailableModel>
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  const selectedModel = models.find((m) => (m.id ?? '') === value)
  const groupedModels = useMemo(() => groupModelsByProvider(models), [models])

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{label}</span>
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => !disabled && setOpen((c) => !c)}
          className={cn(
            'inline-flex min-h-[3rem] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm shadow-sm transition-colors',
            disabled ? 'cursor-not-allowed opacity-60' : '',
          )}
          style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg)', color: 'var(--theme-text)' }}
          disabled={disabled}
        >
          <span className="inline-flex min-w-0 items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card2)', color: 'var(--theme-text)' }}>
            <span className={cn('size-2 rounded-full', value ? 'bg-emerald-500' : 'bg-neutral-400')} />
            <span className="truncate">{getModelDisplayName(selectedModel, value)}</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={cn('shrink-0 transition-transform', open && 'rotate-180')} style={{ color: 'var(--theme-muted)' }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open ? (
          <div className="absolute left-0 top-[calc(100%+0.5rem)] z-[80] w-full overflow-hidden rounded-2xl border shadow-lg" style={{ borderColor: 'var(--theme-border2)', background: 'var(--theme-card)' }}>
            <div className="max-h-80 overflow-y-auto p-2">
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors', !value ? 'bg-emerald-500/10' : '')}
                style={{ color: 'var(--theme-text)' }}
              >
                <span className={cn('size-2 rounded-full', !value ? 'bg-emerald-500' : 'bg-neutral-400')} />
                <span className="min-w-0 flex-1 truncate">默认（自动）</span>
              </button>
              {groupedModels.map((group) => (
                <div key={group.provider} className="mt-2 first:mt-3">
                  <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--theme-muted)' }}>
                    {group.provider}
                  </div>
                  {group.models.map((model) => {
                    const modelId = model.id ?? ''
                    const active = modelId === value
                    return (
                      <button
                        key={`${group.provider}-${modelId}`}
                        type="button"
                        onClick={() => { onChange(modelId); setOpen(false) }}
                        className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors', active ? 'bg-emerald-500/10' : '')}
                        style={{ color: 'var(--theme-text)' }}
                      >
                        <span className={cn('size-2 rounded-full', active ? 'bg-emerald-500' : 'bg-neutral-400')} />
                        <span className="min-w-0 flex-1 truncate">{getModelDisplayName(model, modelId)}</span>
                        <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card2)', color: 'var(--theme-muted)' }}>
                          {group.provider}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function ConductorSettingsDrawer({
  open,
  onClose,
  settings,
  onUpdate,
}: {
  open: boolean
  onClose: () => void
  settings: ConductorSettings
  onUpdate: (patch: Partial<ConductorSettings>) => void
}) {
  const modelsQuery = useQuery({
    queryKey: ['conductor', 'models'],
    queryFn: async () => {
      const res = await fetch('/api/models')
      const data = (await res.json()) as { ok?: boolean; models?: Array<AvailableModel> }
      return data.models ?? []
    },
    enabled: open,
    staleTime: 60_000,
  })
  const availableModels = modelsQuery.data ?? []

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-md flex-col overflow-y-auto border-l p-6" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--theme-text)' }}>Conductor 设置</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 transition-colors" style={{ color: 'var(--theme-muted)' }}>
            <EmojiIcon emoji="✕" size={14} />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <ModelSelectorDropdown
            label="编排模型"
            value={settings.orchestratorModel}
            onChange={(v) => onUpdate({ orchestratorModel: v })}
            models={availableModels}
          />

          <ModelSelectorDropdown
            label="工作模型"
            value={settings.workerModel}
            onChange={(v) => onUpdate({ workerModel: v })}
            models={availableModels}
          />

          <div className="space-y-2">
            <span className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>项目目录</span>
            <input
              type="text"
              value={settings.projectsDir}
              onChange={(e) => onUpdate({ projectsDir: e.target.value })}
              placeholder="/tmp"
              className="w-full rounded-2xl border px-4 py-3 text-sm"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg)', color: 'var(--theme-text)' }}
            />
            <p className="text-xs" style={{ color: 'var(--theme-muted)' }}>工作智能体输出写入的位置。留空表示 /tmp。</p>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>最大并行智能体数</span>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={5}
                value={settings.maxParallel}
                onChange={(e) => onUpdate({ maxParallel: Number(e.target.value) })}
                className="flex-1"
              />
              <span className="w-8 text-center text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>{settings.maxParallel}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>监督模式</span>
              <p className="text-xs" style={{ color: 'var(--theme-muted)' }}>每个任务执行前需要审批。</p>
            </div>
            <button
              type="button"
              onClick={() => onUpdate({ supervised: !settings.supervised })}
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors',
                settings.supervised ? 'bg-emerald-500' : 'bg-neutral-600',
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform',
                settings.supervised && 'translate-x-5',
              )} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
