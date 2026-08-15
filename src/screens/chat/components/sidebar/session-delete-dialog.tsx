'use client'

import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogRoot,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type SessionDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionTitle: string
  onConfirm: () => void
  onCancel: () => void
}

export function SessionDeleteDialog({
  open,
  onOpenChange,
  sessionTitle,
  onConfirm,
  onCancel,
}: SessionDeleteDialogProps) {
  return (
    <AlertDialogRoot open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <div className="p-4">
          <AlertDialogTitle className="mb-1">删除会话</AlertDialogTitle>
          <AlertDialogDescription className="mb-4">
            确定要删除“{sessionTitle}”吗？此操作无法撤销。
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel onClick={onCancel}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>删除</AlertDialogAction>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialogRoot>
  )
}
