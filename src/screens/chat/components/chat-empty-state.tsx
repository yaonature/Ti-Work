import { HugeiconsIcon } from '@hugeicons/react'
import { BrainIcon, CodeIcon, PuzzleIcon } from '@hugeicons/core-free-icons'
import { motion } from 'motion/react'

type SuggestionChip = {
  label: string
  prompt: string
  icon: unknown
}

const SUGGESTIONS: Array<SuggestionChip> = [
  {
    label: '分析当前工作区',
    prompt:
      '分析这个工作区结构，并给出 3 个工程风险。请使用工具，并保持简洁。',
    icon: CodeIcon,
  },
  {
    label: '保存一个偏好',
    prompt:
      '把这句话原样保存到记忆中：“演示场景下，回答最多 3 个要点，并先说风险。” 然后确认已保存。',
    icon: BrainIcon,
  },
  {
    label: '创建一个文件',
    prompt: '创建 demo-checklist.md，并写入这个应用上线前的 5 项检查项。',
    icon: PuzzleIcon,
  },
]

type ChatEmptyStateProps = {
  onSuggestionClick?: (prompt: string) => void
  compact?: boolean
}

export function ChatEmptyState({
  onSuggestionClick,
  compact = false,
}: ChatEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex h-full flex-col items-center justify-center px-4 py-8"
    >
      <div className="flex max-w-xl flex-col items-center text-center">
        {/* Avatar with accent glow */}
        <div className="relative mb-5">
          <div
            className="absolute inset-0 rounded-2xl blur-2xl opacity-35"
            style={{
              background: 'var(--theme-accent)',
              transform: 'scale(1.6)',
            }}
          />
          <img
            src="/ti-work-logo.svg"
            alt="Ti Work"
            className="relative size-20 rounded-2xl"
            style={{
              boxShadow:
                '0 8px 32px color-mix(in srgb, var(--theme-accent) 30%, transparent)',
            }}
          />
        </div>

        {/* Title + value prop */}
        <h2
          className="text-xl font-semibold tracking-tight"
          style={{ color: 'var(--theme-text)' }}
        >
          Ti Work
        </h2>

        {!compact && (
          <>
            <p className="mt-2 text-sm" style={{ color: 'var(--theme-muted)' }}>
              智能体会话 · 实时工具 · 记忆能力 · 全链路可观测
            </p>
          </>
        )}

        {/* Prompt chips */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.label}
              type="button"
              onClick={() => onSuggestionClick?.(suggestion.prompt)}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all hover:scale-[1.02]"
              style={{
                background: 'var(--theme-card)',
                border: '1px solid var(--theme-border)',
                color: 'var(--theme-text)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--theme-card2)'
                e.currentTarget.style.borderColor = 'var(--theme-accent-border)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--theme-card)'
                e.currentTarget.style.borderColor = 'var(--theme-border)'
              }}
            >
              <HugeiconsIcon
                icon={suggestion.icon as any}
                size={14}
                strokeWidth={1.5}
                style={{ color: 'var(--theme-accent)' }}
              />
              {suggestion.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
