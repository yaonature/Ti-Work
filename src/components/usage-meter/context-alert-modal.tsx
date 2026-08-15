'use client'

import { memo } from 'react'
import { DialogContent, DialogRoot } from '@/components/ui/dialog'
import { EmojiIcon } from '@/components/emoji-icon'
import { cn } from '@/lib/utils'

type ContextAlertModalProps = {
  open: boolean
  onClose: () => void
  threshold: number
  contextPercent: number
}

function ContextAlertModalComponent({
  open,
  onClose,
  threshold,
  contextPercent,
}: ContextAlertModalProps) {
  const isCritical = threshold >= 90
  const isDanger = threshold >= 75
  // 35% is an early warning — Hermes auto-compacts at ~40%

  const barColor = isCritical
    ? 'bg-red-500'
    : isDanger
      ? 'bg-amber-500'
      : 'bg-amber-400'
  const iconBg = isCritical
    ? 'bg-red-100'
    : isDanger
      ? 'bg-amber-100'
      : 'bg-amber-100'
  const iconColor = isCritical
    ? 'text-red-600'
    : isDanger
      ? 'text-amber-600'
      : 'text-amber-600'

  return (
    <DialogRoot
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="w-[min(440px,92vw)] p-0 overflow-hidden">
        {/* Colored top bar */}
        <div className={cn('h-1.5 w-full', barColor)} />

        <div className="px-6 pt-5 pb-6">
          {/* Icon + title */}
          <div className="flex items-start gap-3 mb-4">
            <div className={cn('rounded-full p-2 shrink-0', iconBg)}>
              <svg
                viewBox="0 0 24 24"
                className={cn('size-5', iconColor)}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-primary-900">
                {isCritical
                  ? '上下文窗口即将占满'
                  : isDanger
                    ? '上下文窗口正在接近上限'
                    : '自动压缩提醒'}
              </h3>
              <p className="text-xs text-primary-500 mt-0.5">
                当前已使用模型上下文窗口的 {Math.round(contextPercent)}%
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 rounded-full bg-primary-100 overflow-hidden mb-4">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                barColor,
              )}
              style={{ width: `${Math.min(contextPercent, 100)}%` }}
            />
          </div>

          {/* What this means */}
          <div className="bg-primary-50 rounded-lg p-3 mb-4">
            <p className="text-xs font-medium text-primary-800 mb-2">
              这意味着什么？
            </p>
            <p className="text-xs text-primary-600 leading-relaxed">
              {isCritical
                ? '你的会话历史已经接近模型上限。随着模型逐渐失去更早的上下文，回复可能会变得不够准确。建议尽快开始一个新会话。'
                : isDanger
                  ? '你的会话已经比较长了，模型可能会开始遗忘较早的消息。为了获得更好的效果，建议新开一个会话。'
                  : 'Hermes 很快会自动压缩上下文（约在使用量达到 40% 时触发）。较早的消息会被总结归纳。若想保留完整上下文，建议先写一份交接摘要或直接开始新会话。'}
            </p>
          </div>

          {/* Recommendations */}
          <div className="space-y-2 mb-5">
            <p className="text-xs font-medium text-primary-800">
              建议操作
            </p>
            <div className="space-y-1.5">
              {isCritical && (
                <Recommendation
                  icon="🆕"
                  text="开启一个新会话，重置上下文"
                  emphasis
                />
              )}
              <Recommendation
                icon="🗜️"
                text="在“设置 → 配置”中启用自动压缩，让系统自动管理上下文"
              />
              <Recommendation
                icon="📋"
                text="在开始新会话前，先整理一份重要信息摘要"
              />
              {!isCritical && (
                <Recommendation
                  icon="💡"
                  text="尽量让消息更简洁，以更高效地使用上下文"
                />
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-accent-200 bg-transparent px-4 py-2 text-xs font-medium text-accent-800 hover:bg-accent-50 transition-colors"
            >
              知道了
            </button>
            {isDanger && (
              <a
                href="/new"
                className="rounded-lg bg-accent-500 px-4 py-2 text-xs font-medium text-white hover:bg-accent-600 transition-colors"
              >
                新建会话
              </a>
            )}
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  )
}

function Recommendation({
  icon,
  text,
  emphasis,
}: {
  icon: string
  text: string
  emphasis?: boolean
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs shrink-0 mt-px">
        <EmojiIcon emoji={icon} size={14} />
      </span>
      <span
        className={cn(
          'text-xs text-primary-600 leading-relaxed',
          emphasis && 'font-medium text-primary-800',
        )}
      >
        {text}
      </span>
    </div>
  )
}

export const ContextAlertModal = memo(ContextAlertModalComponent)
