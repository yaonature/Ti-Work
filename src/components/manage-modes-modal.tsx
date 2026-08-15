import { useCallback, useEffect, useRef, useState } from 'react'
import { RenameDialog } from './rename-mode-dialog'
import type { Mode } from '@/hooks/use-modes'
import { cn } from '@/lib/utils'
import { useModes } from '@/hooks/use-modes'
import { EmojiIcon } from '@/components/emoji-icon'

type ManageModesModalProps = {
  onClose: () => void
  availableModels: Array<string>
}

export function ManageModesModal({
  onClose,
  availableModels,
}: ManageModesModalProps) {
  const { modes, deleteMode } = useModes()
  const [modeToRename, setModeToRename] = useState<Mode | null>(null)
  const [modeToDelete, setModeToDelete] = useState<Mode | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Focus trap
  useEffect(() => {
    const modal = modalRef.current
    if (!modal) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key === 'Tab') {
        const focusable = modal!.querySelectorAll<HTMLElement>(
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

  const handleDelete = useCallback(
    (mode: Mode) => {
      deleteMode(mode.id)
      setModeToDelete(null)
    },
    [deleteMode],
  )

  if (modes.length === 0) {
    return (
      <>
        <div
          className="fixed inset-0 z-50 bg-black/50"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={modalRef}
          role="dialog"
          aria-labelledby="manage-modes-title"
          aria-modal="true"
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-[var(--theme-border)] bg-[var(--theme-panel)] p-6 shadow-[var(--theme-shadow-3)]"
        >
          <h2
            id="manage-modes-title"
            className="mb-4 text-lg font-semibold text-[var(--theme-text)]"
          >
            管理模式
          </h2>
          <p className="mb-6 text-sm text-[var(--theme-muted)]">当前还没有已保存模式。</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-400"
            >
              关闭
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-labelledby="manage-modes-title"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-[var(--theme-border)] bg-[var(--theme-panel)] p-6 shadow-[var(--theme-shadow-3)]"
      >
        <h2
          id="manage-modes-title"
          className="mb-4 text-lg font-semibold text-[var(--theme-text)]"
        >
          管理模式
        </h2>

        <div className="mb-6 max-h-[24rem] space-y-3 overflow-y-auto">
          {modes.map((mode) => {
            const modelUnavailable =
              mode.preferredModel &&
              !availableModels.includes(mode.preferredModel)

            return (
              <div
                key={mode.id}
                className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-4"
              >
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="font-medium text-[var(--theme-text)]">
                    {mode.name}
                    {modelUnavailable && (
                      <span
                        className="ml-2 text-xs text-red-600"
                        title="模型不可用"
                      >
                        <> <EmojiIcon emoji="⚠️" size={12} /> 模型不可用</>
                      </span>
                    )}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setModeToRename(mode)}
                      className="rounded-lg border border-accent-200 bg-transparent px-3 py-1 text-xs font-medium text-accent-800 transition-colors hover:bg-accent-50 focus:outline-none focus:ring-2 focus:ring-accent-400"
                      aria-label={`重命名 ${mode.name}`}
                    >
                      重命名
                    </button>
                    <button
                      type="button"
                      onClick={() => setModeToDelete(mode)}
                      className="rounded-lg border border-red-200 bg-transparent px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
                      aria-label={`删除 ${mode.name}`}
                    >
                      删除
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-[var(--theme-muted)]">
                  {mode.preferredModel && (
                    <div>
                      <span className="font-medium">模型：</span>{' '}
                      <span className={cn(modelUnavailable && 'text-red-600')}>
                        {mode.preferredModel}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="font-medium">智能建议：</span>{' '}
                    {mode.smartSuggestionsEnabled ? '开启' : '关闭'}
                  </div>
                  <div>
                    <span className="font-medium">仅推荐更便宜模型：</span>{' '}
                    {mode.onlySuggestCheaper ? '开启' : '关闭'}
                  </div>
                  {mode.preferredBudgetModel && (
                    <div>
                      <span className="font-medium">预算模型：</span>{' '}
                      {mode.preferredBudgetModel}
                    </div>
                  )}
                  {mode.preferredPremiumModel && (
                    <div>
                      <span className="font-medium">高阶模型：</span>{' '}
                      {mode.preferredPremiumModel}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-400"
          >
            关闭
          </button>
        </div>
      </div>

      {/* Rename Dialog */}
      {modeToRename && (
        <RenameDialog
          mode={modeToRename}
          onClose={() => setModeToRename(null)}
        />
      )}

      {/* Delete Confirmation */}
      {modeToDelete && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50"
            onClick={() => setModeToDelete(null)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-labelledby="delete-mode-title"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-[60] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-[var(--theme-border)] bg-[var(--theme-panel)] p-6 shadow-[var(--theme-shadow-3)]"
          >
            <h2
              id="delete-mode-title"
              className="mb-2 text-lg font-semibold text-[var(--theme-text)]"
            >
              删除模式
            </h2>
            <p className="mb-6 text-sm text-[var(--theme-muted)]">
              确定要删除“{modeToDelete.name}”吗？此操作无法撤销。
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModeToDelete(null)}
                className="rounded-lg border border-accent-200 bg-transparent px-4 py-2 text-sm font-medium text-accent-800 transition-colors hover:bg-accent-50 focus:outline-none focus:ring-2 focus:ring-accent-400"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => handleDelete(modeToDelete)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                删除
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
