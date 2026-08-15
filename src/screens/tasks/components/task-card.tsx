import type { HermesTask, TaskPriority } from '@/types/task'
import type { Status } from '@/components/ds/status-badge'
import { Card } from '@/components/ds/card'
import { StatusBadge } from '@/components/ds/status-badge'
import { EmojiIcon } from '@/components/emoji-icon'

const PRIORITY_STATUS: Record<TaskPriority, Status> = {
  high: 'error',
  medium: 'warning',
  low: 'idle',
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const SOURCE_ICON: Record<HermesTask['sourceType'], string> = {
  manual: '✏️',
  conductor: '🎯',
  crew: '👥',
}

const SOURCE_LABELS: Record<HermesTask['sourceType'], string> = {
  manual: '手动',
  conductor: '编排',
  crew: '多智能体团队',
}

interface TaskCardProps {
  task: HermesTask
  onEdit: (task: HermesTask) => void
  onDragStart: (e: React.DragEvent, taskId: string) => void
}

export function TaskCard({ task, onEdit, onDragStart }: TaskCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onEdit(task)}
      style={{ cursor: 'grab', borderColor: 'var(--theme-border)' }}
    >
      <Card
        className="hover:border-[var(--theme-accent-border)] transition-colors"
      >
        <div className="flex flex-col gap-2">
          {/* Title row with source icon */}
          <div className="flex items-start justify-between gap-2">
            <span
              className="text-sm font-medium leading-snug flex-1"
              style={{ color: 'var(--theme-text)' }}
            >
              {task.title}
            </span>
            <span className="text-xs flex-shrink-0" title={SOURCE_LABELS[task.sourceType]}>
              <EmojiIcon emoji={SOURCE_ICON[task.sourceType]} size={12} />
            </span>
          </div>

          {/* Description (2 lines max) */}
          {task.description && (
            <p
              className="text-xs leading-relaxed"
              style={{
                color: 'var(--theme-muted)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {task.description}
            </p>
          )}

          {/* Priority badge + assignee */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <StatusBadge status={PRIORITY_STATUS[task.priority]} label={PRIORITY_LABELS[task.priority]} size="sm" />
            {task.assignee && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: 'var(--theme-accent-subtle)',
                  color: 'var(--theme-accent)',
                  border: '1px solid var(--theme-accent-border)',
                }}
              >
                {task.assignee}
              </span>
            )}
          </div>

          {/* Tags */}
          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    background: 'var(--theme-hover)',
                    color: 'var(--theme-muted)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
