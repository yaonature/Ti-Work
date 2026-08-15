'use client'

import { useState } from 'react'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type SessionRenameDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionTitle: string
  onSave: (newTitle: string) => void
  onCancel: () => void
}

export function SessionRenameDialog({
  open,
  onOpenChange,
  sessionTitle,
  onSave,
  onCancel,
}: SessionRenameDialogProps) {
  const [renameValue, setRenameValue] = useState(sessionTitle)

  // Keep controlled value in sync when the dialog opens with a new session
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) setRenameValue(sessionTitle)
    onOpenChange(nextOpen)
  }

  return (
    <DialogRoot open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <div className="p-4">
          <DialogTitle className="mb-1">重命名</DialogTitle>
          <DialogDescription className="mb-4">
            请输入这个会话的新名称。
          </DialogDescription>
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onSave(renameValue)
              }
            }}
            className="w-full rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none focus:border-primary-400"
            placeholder="会话名称"
            autoFocus
          />
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose onClick={onCancel}>取消</DialogClose>
            <Button onClick={() => onSave(renameValue)}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
