import { useCallback, useEffect, useRef, useState } from 'react'
import type { Mode } from '@/hooks/use-modes'
import { cn } from '@/lib/utils'
import { useModes } from '@/hooks/use-modes'

type RenameDialogProps = {
  mode: Mode
  onClose: () => void
}

export function RenameDialog({ mode, onClose }: RenameDialogProps) {
  const [name, setName] = useState(mode.name)
  const [error, setError] = useState<string | null>(null)
  const { renameMode } = useModes()
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

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
        if (!dialog) return
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, input, [tabindex]:not([tabindex="-1"])',
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

  const handleRename = useCallback(() => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('请填写模式名称')
      return
    }

    const result = renameMode(mode.id, trimmed)
    if (result.error) {
      setError(result.error)
    } else {
      onClose()
    }
  }, [name, mode.id, renameMode, onClose])

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      handleRename()
    },
    [handleRename],
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby="rename-mode-title"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-[60] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-[var(--theme-border)] bg-[var(--theme-panel)] p-6 shadow-[var(--theme-shadow-3)]"
      >
        <h2
          id="rename-mode-title"
          className="mb-4 text-lg font-semibold text-[var(--theme-text)]"
        >
          重命名模式
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label
              htmlFor="mode-name"
              className="mb-2 block text-sm font-medium text-[var(--theme-text)]"
            >
              模式名称
            </label>
            <input
              ref={inputRef}
              id="mode-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              className={cn(
                'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:border-[var(--theme-accent)] focus:outline-none focus:ring-2 focus:ring-accent-400',
                error &&
                  'border-red-500 focus:border-red-500 focus:ring-red-500',
              )}
              maxLength={50}
              aria-invalid={!!error}
              aria-describedby={error ? 'mode-name-error' : undefined}
            />
            {error && (
              <p
                id="mode-name-error"
                className="mt-1 text-xs text-red-600"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-accent-200 bg-transparent px-4 py-2 text-sm font-medium text-accent-800 transition-colors hover:bg-accent-50 focus:outline-none focus:ring-2 focus:ring-accent-400"
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-400"
            >
              重命名
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
