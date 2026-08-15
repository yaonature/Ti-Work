import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Loading03Icon,
  MinusSignCircleIcon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

export type Status = 'running' | 'success' | 'error' | 'warning' | 'idle' | 'pending'

interface StatusBadgeProps {
  status: Status
  label?: string
  size?: 'sm' | 'md'
  className?: string
}

const statusConfig: Record<
  Status,
   
  { icon: any; colorVar: string; defaultLabel: string; spin?: boolean }
> = {
  running: { icon: Loading03Icon,          colorVar: 'var(--theme-active)',   defaultLabel: '运行中', spin: true },
  success: { icon: CheckmarkCircle01Icon,  colorVar: 'var(--theme-success)',  defaultLabel: '成功' },
  error:   { icon: Cancel01Icon,           colorVar: 'var(--theme-danger)',   defaultLabel: '异常' },
  warning: { icon: Alert02Icon,            colorVar: 'var(--theme-warning)',  defaultLabel: '警告' },
  idle:    { icon: MinusSignCircleIcon,    colorVar: 'var(--theme-muted)',    defaultLabel: '空闲' },
  pending: { icon: Clock01Icon,            colorVar: 'var(--theme-muted)',    defaultLabel: '等待中' },
}

export function StatusBadge({ status, label, size = 'sm', className }: StatusBadgeProps) {
  const { icon, colorVar, defaultLabel, spin } = statusConfig[status]
  const iconSize = size === 'sm' ? 14 : 16
  const textClass = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <span
      className={cn('inline-flex items-center gap-1.5', className)}
      style={{ color: colorVar }}
    >
      <span className={cn(spin && 'animate-spin')}>
        <HugeiconsIcon icon={icon} size={iconSize} />
      </span>
      <span className={textClass}>{label ?? defaultLabel}</span>
    </span>
  )
}
