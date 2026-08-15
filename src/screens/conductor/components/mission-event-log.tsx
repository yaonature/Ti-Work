/**
 * Mission event log — cycling status indicator for active missions.
 *
 * Adapted from upstream conductor.tsx CyclingStatus/PlanningIndicator.
 */
import { useEffect, useState } from 'react'
import { EmojiIcon } from '@/components/emoji-icon'

const PLANNING_STEPS = ['正在规划任务…', '正在分析需求…', '正在准备智能体…', '正在起草计划…']
const WORKING_STEPS = [
  '📋 正在审阅任务简报…',
  '🔍 正在扫描现有模式…',
  '✏️ 正在起草实现方案…',
  '☕ 短暂休息一下…',
  '🧠 正在思考边界情况…',
  '🎨 正在打磨设计细节…',
  '🔧 正在串联组件逻辑…',
  '📐 正在检查布局…',
  '🚀 快完成了…',
]

export function CyclingStatus({
  steps,
  intervalMs = 3000,
  isPaused = false,
}: {
  steps: Array<string>
  intervalMs?: number
  isPaused?: boolean
}) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (isPaused) return
    const timer = window.setInterval(() => setStep((current) => (current + 1) % steps.length), intervalMs)
    return () => window.clearInterval(timer)
  }, [isPaused, steps.length, intervalMs])

  if (isPaused) {
    return (
      <div className="flex items-center gap-3 py-3">
        <div className="flex size-3.5 items-center justify-center rounded-full border border-amber-400/60 bg-amber-500/10 text-[9px] text-amber-300">
          ||
        </div>
        <p className="text-sm" style={{ color: 'var(--theme-muted)' }}>已暂停</p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="size-3.5 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
      <p className="text-sm transition-opacity duration-500" style={{ color: 'var(--theme-muted)' }}>
        {(() => {
          const current = steps[step] ?? ''
          const firstChar = Array.from(current)[0] ?? ''
          // eslint-disable-next-line no-misleading-character-class
          if (/^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(firstChar)) {
            return (
              <span className="inline-flex items-center gap-1">
                <EmojiIcon emoji={firstChar} size={14} />
                {current.slice(firstChar.length).trimStart()}
              </span>
            )
          }
          return current
        })()}
      </p>
    </div>
  )
}

export function PlanningIndicator() {
  return <CyclingStatus steps={PLANNING_STEPS} intervalMs={2500} />
}

export function WorkingIndicator({ isPaused = false }: { isPaused?: boolean }) {
  return <CyclingStatus steps={WORKING_STEPS} intervalMs={3500} isPaused={isPaused} />
}
