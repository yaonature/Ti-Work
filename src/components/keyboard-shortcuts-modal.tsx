'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
const MOD = isMac ? '⌘' : 'Ctrl'

const SHORTCUT_GROUPS = [
  {
    title: '导航',
    items: [
      { keys: [`${MOD}+K`], label: '打开搜索' },
      { keys: [`${MOD}+P`], label: '快速打开文件' },
      { keys: [`${MOD}+B`], label: '切换侧栏' },
      { keys: [`${MOD}+J`], label: '切换会话面板' },
      { keys: [`${MOD}+Shift+L`], label: '活动日志' },
      { keys: ['Ctrl+`'], label: '切换终端' },
      { keys: ['?'], label: '快捷键面板' },
    ],
  },
  {
    title: '会话',
    items: [
      { keys: ['Enter'], label: '发送消息' },
      { keys: ['Shift+Enter'], label: '插入换行' },
      { keys: ['Escape'], label: '关闭弹窗 / 取消' },
    ],
  },
  {
    title: '编辑器',
    items: [{ keys: [`${MOD}+S`], label: '保存文件' }],
  },
]

export function KeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Only trigger on '?' when no input/textarea is focused
      if (
        event.key === '?' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime safety
        const tag = (event.target as HTMLElement)?.tagName?.toLowerCase()

        if (
          tag === 'input' ||
          tag === 'textarea' ||
          (event.target as HTMLElement)?.isContentEditable
        ) {
          return
        }
        event.preventDefault()
        setIsOpen((prev) => !prev)
      }

      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative z-10 mx-4 w-full max-w-lg overflow-hidden rounded-[20px] border border-[var(--theme-border)] bg-[var(--theme-panel)] shadow-[var(--theme-shadow-3)]"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-3.5">
              <h2 className="text-sm font-semibold text-[var(--theme-text)]">
                键盘快捷键
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-[var(--theme-muted)] transition hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
                aria-label="关闭"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M4 4L12 12M12 4L4 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto p-5">
              {SHORTCUT_GROUPS.map((group) => (
                <div key={group.title} className="mb-5 last:mb-0">
                  <h3 className="mb-2.5 text-xs font-medium uppercase tracking-wider text-[var(--theme-muted)]">
                    {group.title}
                  </h3>
                  <div className="space-y-1.5">
                    {group.items.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between rounded-lg px-2 py-1.5"
                      >
                        <span className="text-sm text-[var(--theme-text)]">
                          {item.label}
                        </span>
                        <div className="flex items-center gap-1">
                          {item.keys.map((key) => (
                            <kbd
                              key={key}
                              className="inline-flex min-w-[24px] items-center justify-center rounded-md border border-[var(--theme-border)] bg-[var(--theme-card2)] px-1.5 py-0.5 text-xs font-medium text-[var(--theme-text)]"
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--theme-border)] px-5 py-2.5 text-center text-xs text-[var(--theme-muted)]">
              按{' '}
              <kbd className="mx-0.5 rounded border border-[var(--theme-border)] bg-[var(--theme-card2)] px-1 text-[10px] font-medium">
                ?
              </kbd>{' '}
              可切换显示 ·{' '}
              <kbd className="mx-0.5 rounded border border-[var(--theme-border)] bg-[var(--theme-card2)] px-1 text-[10px] font-medium">
                Esc
              </kbd>{' '}
              可关闭
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
