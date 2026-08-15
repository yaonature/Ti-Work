/**
 * Task types — Kanban board task management.
 */

export type TaskColumn = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'high' | 'medium' | 'low'
export type TaskSourceType = 'manual' | 'conductor' | 'crew'

export interface HermesTask {
  id: string
  title: string
  description: string
  column: TaskColumn
  priority: TaskPriority
  assignee: string | null
  tags: Array<string>
  dueDate: string | null
  position: number
  sourceType: TaskSourceType
  sourceId: string | null
  createdBy: string
  createdAt: number
  updatedAt: number
}

export interface CreateTaskInput {
  title: string
  description?: string
  column?: TaskColumn
  priority?: TaskPriority
  assignee?: string | null
  tags?: Array<string>
  dueDate?: string | null
  sourceType?: TaskSourceType
  sourceId?: string | null
  createdBy?: string
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  column?: TaskColumn
  priority?: TaskPriority
  assignee?: string | null
  tags?: Array<string>
  dueDate?: string | null
  position?: number
}

export const TASK_COLUMNS: ReadonlyArray<TaskColumn> = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const

export const TASK_COLUMN_LABELS: Record<TaskColumn, string> = {
  backlog: '积压',
  todo: '待办',
  in_progress: '进行中',
  review: '评审',
  done: '已完成',
}
