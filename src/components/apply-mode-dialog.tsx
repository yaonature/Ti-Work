import { useCallback, useEffect, useRef } from 'react'
import type { Mode } from '@/hooks/use-modes'
import { Button } from '@/components/ui/button'

type ApplyModeDialogProps = {
  mode: Mode
  onConfirm: (switchModel: boolean) => void
  onClose: () => void
}

export function ApplyModeDialog({
  mode,
  onConfirm,
  onClose,
}: ApplyModeDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Focus trap
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key === 'Tab') {
        const focusable = dialog!.querySelectorAll<HTMLElement>(
          'button, [tabindex]:not([tabindex="-1"])',
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleSwitchNow = useCallback(() => {
    onConfirm(true)
  }, [onConfirm])

  const handleSkip = useCallback(() => {
    onConfirm(false)
  }, [onConfirm])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby="apply-mode-title"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-[var(--theme-border)] bg-[var(--theme-panel)] p-6 shadow-[var(--theme-shadow-3)]"
      >
        <h2
          id="apply-mode-title"
          className="mb-2 text-lg font-semibold text-[var(--theme-text)]"
        >
          切换模型？
        </h2>

        <p className="mb-6 text-sm text-[var(--theme-muted)]">
          模式“{mode.name}”使用
          <span className="font-medium text-[var(--theme-text)]">{mode.preferredModel}</span>。是否现在切换到这个模型？
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleSkip}>
            跳过
          </Button>
          <Button variant="default" onClick={handleSwitchNow}>
            立即切换
          </Button>
        </div>
      </div>
    </>
  )
}
