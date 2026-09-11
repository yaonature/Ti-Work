'use client'

import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  Folder01Icon,
} from '@hugeicons/core-free-icons'

import { useSettings } from '@/hooks/use-settings'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

/** Electron 预加载桥（window.tiwork）的最小类型声明。 */
type TiWorkPicker = {
  tiwork?: { selectDirectory?: () => Promise<string | null> }
}

/** 打开系统目录选择对话框；非 Electron 环境返回 null。 */
async function pickLocalDirectory(): Promise<string | null> {
  const bridge = (window as unknown as TiWorkPicker).tiwork
  if (!bridge?.selectDirectory) return null
  try {
    return await bridge.selectDirectory()
  } catch {
    return null
  }
}

/** 取路径最后的目录名（兼容 Windows / Unix 分隔符）。 */
function getFolderName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : path
}

/**
 * 工作目录选择器（ZCode「选择项目」对应物）。
 * 全局唯一、用户自选、可在设置页切换；本期只做 UI + 选择 + 持久化。
 */
export function WorkDirectorySelector() {
  const { settings, updateSettings } = useSettings()
  const workDirectory = settings.workDirectory ?? ''
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  async function handleChoose() {
    const picked = await pickLocalDirectory()
    if (!picked) {
      toast('未选择文件夹，或当前环境不支持选择目录。', {
        type: 'warning',
      })
      return
    }
    updateSettings({ workDirectory: picked })
    setOpen(false)
    toast(`工作目录已设为「${getFolderName(picked)}」`, { type: 'success' })
  }

  const label = workDirectory ? getFolderName(workDirectory) : '选择工作目录'

  return (
    <div className="relative inline-flex" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)] cursor-pointer"
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="work-directory-selector"
      >
        <HugeiconsIcon icon={Folder01Icon} size={15} strokeWidth={1.5} />
        <span className="max-w-[8rem] truncate">{label}</span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={13}
          strokeWidth={1.5}
          className={cn(
            'shrink-0 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-[200] mt-1 w-64 overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-1 shadow-xl dark:border-neutral-700 animate-in fade-in slide-in-from-top-2 duration-150"
          role="menu"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
            {workDirectory ? '当前工作目录' : '工作目录'}
          </div>
          {workDirectory ? (
            <div
              className="truncate px-3 pb-1 text-[11px] text-[var(--theme-muted)]"
              title={workDirectory}
            >
              {workDirectory}
            </div>
          ) : (
            <div className="px-3 pb-1 text-[11px] text-[var(--theme-muted)]">
              数字员工会把生成的文件保存到你的工作目录。
            </div>
          )}
          <button
            type="button"
            onClick={handleChoose}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-panel)]"
            role="menuitem"
          >
            <HugeiconsIcon icon={Folder01Icon} size={16} strokeWidth={1.5} />
            <span>{workDirectory ? '重新选择' : '选择文件夹'}</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
