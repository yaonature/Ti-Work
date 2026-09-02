import { useEffect, useRef, useState } from 'react'
import { Button } from './button'
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from './dialog'
import { Input } from './input'

type TextInputDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: (value: string) => void
}

export function TextInputDialog({
  open,
  onOpenChange,
  title,
  description,
  defaultValue = '',
  placeholder,
  confirmLabel = '确认',
  cancelLabel = '取消',
  onConfirm,
}: TextInputDialogProps) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    setValue(defaultValue)
  }, [defaultValue, open])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [open])

  const trimmedValue = value.trim()

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(440px,92vw)]">
        <div className="space-y-4 p-5">
          <div>
            <DialogTitle className="mb-1">{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </div>

          <Input
            ref={inputRef}
            value={value}
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || !trimmedValue) return
              event.preventDefault()
              onConfirm(trimmedValue)
            }}
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            <Button
              disabled={!trimmedValue}
              onClick={() => onConfirm(trimmedValue)}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
