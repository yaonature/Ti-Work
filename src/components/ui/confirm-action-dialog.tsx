'use client'

import { AlertDialog } from '@base-ui/react/alert-dialog'
import type { ReactNode } from 'react'
import { Button } from './button'
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogRoot,
  AlertDialogTitle,
} from './alert-dialog'

type ConfirmActionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: 'default' | 'destructive'
  onConfirm: () => void
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  confirmVariant = 'destructive',
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <AlertDialogRoot open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <div className="p-5">
          <AlertDialogTitle className="mb-1">{title}</AlertDialogTitle>
          <AlertDialogDescription className="mb-4">
            {description}
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialog.Close render={<Button variant="outline" />}>
              {cancelLabel}
            </AlertDialog.Close>
            <AlertDialog.Close
              render={<Button variant={confirmVariant} />}
              onClick={onConfirm}
            >
              {confirmLabel}
            </AlertDialog.Close>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialogRoot>
  )
}
