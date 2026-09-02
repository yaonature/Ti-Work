import { useEffect, useState } from 'react'
import type { CreateTaskInput, HermesTask, TaskColumn, TaskPriority } from '@/types/task'
import {
  DialogClose,
  DialogContent,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectItem,
  SelectList,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TASK_COLUMNS, TASK_COLUMN_LABELS } from '@/types/task'

const PRIORITY_OPTIONS: Array<TaskPriority> = ['high', 'medium', 'low']

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

interface TaskDialogProps {
  open: boolean
  onClose: () => void
  onSave: (input: CreateTaskInput) => void
  task: HermesTask | null
}

export function TaskDialog({ open, onClose, onSave, task }: TaskDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [column, setColumn] = useState<TaskColumn>('backlog')
  const [assignee, setAssignee] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')

  // Pre-fill from existing task when editing
  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description ?? '')
      setPriority(task.priority)
      setColumn(task.column)
      setAssignee(task.assignee ?? '')
      setTagsRaw(task.tags.join(', '))
    } else {
      setTitle('')
      setDescription('')
      setPriority('medium')
      setColumn('backlog')
      setAssignee('')
      setTagsRaw('')
    }
  }, [task, open])

  const handleSave = () => {
    if (!title.trim()) return
    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      column,
      assignee: assignee.trim() || null,
      tags,
    })
    onClose()
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500,
    marginBottom: '4px',
    color: 'var(--theme-muted)',
  }

  return (
    <DialogRoot open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="w-[min(480px,92vw)]">
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <DialogTitle>{task ? '编辑任务' : '新建任务'}</DialogTitle>
          <DialogClose>取消</DialogClose>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto">
          {/* Title */}
          <div>
            <label style={labelStyle}>标题 *</label>
            <Input
              className="w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="任务标题"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>描述</label>
            <Textarea
              className="w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选描述…"
              rows={3}
            />
          </div>

          {/* Priority + Column row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>优先级</label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as TaskPriority)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  <SelectList>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectList>
                </SelectPopup>
              </Select>
            </div>
            <div>
              <label style={labelStyle}>列</label>
              <Select
                value={column}
                onValueChange={(value) => setColumn(value as TaskColumn)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  <SelectList>
                    {TASK_COLUMNS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {TASK_COLUMN_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectList>
                </SelectPopup>
              </Select>
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label style={labelStyle}>负责人</label>
            <Input
              className="w-full"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="用户名或姓名"
            />
          </div>

          {/* Tags */}
          <div>
            <label style={labelStyle}>标签（逗号分隔）</label>
            <Input
              className="w-full"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="例如：frontend, urgent"
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3 border-t"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <Button variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!title.trim()}>
            {task ? '保存更改' : '创建任务'}
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
