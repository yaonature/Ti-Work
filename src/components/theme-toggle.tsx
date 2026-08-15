import { useState } from 'react'
import { ComputerIcon, Moon01Icon, Sun01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { SettingsThemeMode } from '@/hooks/use-settings'
import { applyTheme, useSettingsStore } from '@/hooks/use-settings'
import { cn } from '@/lib/utils'

const MODES: Array<{
  value: SettingsThemeMode
  icon: typeof Sun01Icon
  label: string
}> = [
  { value: 'light', icon: Sun01Icon, label: '浅色' },
  { value: 'dark', icon: Moon01Icon, label: '深色' },
  { value: 'system', icon: ComputerIcon, label: '跟随系统' },
]

function readStoredMode(): SettingsThemeMode {
  try {
    const raw = localStorage.getItem('hermes-settings')
    if (!raw) return 'dark'
    const parsed = JSON.parse(raw) as { state?: { settings?: { theme?: SettingsThemeMode } } }
    const theme = parsed?.state?.settings?.theme
    return theme === 'light' || theme === 'system' ? theme : 'dark'
  } catch {
    return 'dark'
  }
}

type ThemeToggleProps = {
  /** "icon" = small icon button, "pill" = pill toggle (default) */
  variant?: 'icon' | 'pill'
}

export function ThemeToggle({ variant = 'pill' }: ThemeToggleProps) {
  const [mode, setMode] = useState<SettingsThemeMode>(readStoredMode)
  const updateSettings = useSettingsStore((state) => state.updateSettings)

  function setThemeMode(theme: SettingsThemeMode) {
    setMode(theme)
    applyTheme(theme)
    updateSettings({ theme })
  }

  if (variant === 'icon') {
    const isLight =
      mode === 'light' ||
      (mode === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: light)').matches)
    return (
      <button
        type="button"
        onClick={() => setThemeMode(isLight ? 'dark' : 'light')}
        className="inline-flex size-7 items-center justify-center rounded-md text-primary-400 transition-colors hover:text-primary-700 dark:hover:text-primary-300"
        aria-label={isLight ? '切换到深色模式' : '切换到浅色模式'}
        title={isLight ? '切换到深色模式' : '切换到浅色模式'}
      >
        <HugeiconsIcon icon={isLight ? Moon01Icon : Sun01Icon} size={16} strokeWidth={1.5} />
      </button>
    )
  }

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border border-[var(--theme-border)] bg-[var(--theme-panel)] p-0.5"
      role="group"
      aria-label="明暗模式"
    >
      {MODES.map((item) => {
        const active = mode === item.value
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => setThemeMode(item.value)}
            className={cn(
              'inline-flex size-7 items-center justify-center rounded-full transition-all duration-200',
              active
                ? 'bg-accent-500 text-white shadow-sm'
                : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
            )}
            aria-label={active ? `${item.label}模式（当前）` : `${item.label}模式`}
            title={item.label}
          >
            <HugeiconsIcon icon={item.icon} size={14} strokeWidth={1.8} />
          </button>
        )
      })}
    </div>
  )
}
