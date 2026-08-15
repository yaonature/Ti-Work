import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getMode, getTheme, setMode, setTheme, type ThemeMode } from '@/lib/theme'

export type SettingsThemeMode = 'system' | 'dark' | 'light'
export type AccentColor = 'orange' | 'purple' | 'blue' | 'green'

export type StudioSettings = {
  hermesUrl: string
  hermesToken: string
  /** API_SERVER_KEY for non-loopback Hermes instances (v0.9.0) */
  hermesApiKey: string
  theme: SettingsThemeMode
  accentColor: AccentColor
  editorFontSize: number
  editorWordWrap: boolean
  editorMinimap: boolean
  notificationsEnabled: boolean
  usageThreshold: number
  smartSuggestionsEnabled: boolean
  preferredBudgetModel: string
  preferredPremiumModel: string
  onlySuggestCheaper: boolean
  showSystemMetricsFooter: boolean
  /** Mobile chat nav mode: 'dock' = iMessage (no nav in chat), 'integrated' = chat input in nav pill, 'scroll-hide' = nav shows on scroll up */
  mobileChatNavMode: 'dock' | 'integrated' | 'scroll-hide'
  /** 云同步开关（账号中心） */
  cloudSyncEnabled: boolean
  /** 遥测开关（账号中心） */
  telemetryEnabled: boolean
}

type SettingsState = {
  settings: StudioSettings
  updateSettings: (updates: Partial<StudioSettings>) => void
}

export const defaultStudioSettings: StudioSettings = {
  hermesUrl: '',
  hermesToken: '',
  hermesApiKey: '',
  theme: 'system',
  accentColor: 'blue',
  editorFontSize: 13,
  editorWordWrap: true,
  editorMinimap: false,
  notificationsEnabled: true,
  usageThreshold: 80,
  smartSuggestionsEnabled: false,
  preferredBudgetModel: '',
  preferredPremiumModel: '',
  onlySuggestCheaper: false,
  showSystemMetricsFooter: false,
  mobileChatNavMode: 'dock',
  cloudSyncEnabled: false,
  telemetryEnabled: true,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    function createSettingsStore(set) {
      return {
        settings: defaultStudioSettings,
        updateSettings: function updateSettings(updates) {
          set(function applyUpdates(state) {
            return {
              settings: {
                ...state.settings,
                ...updates,
              },
            }
          })
        },
      }
    },
    {
      name: 'hermes-settings',
      skipHydration: true,
    },
  ),
)

export function useSettings() {
  const settings = useSettingsStore(function selectSettings(state) {
    return state.settings
  })
  const updateSettings = useSettingsStore(function selectUpdateSettings(state) {
    return state.updateSettings
  })

  return {
    settings,
    updateSettings,
  }
}

export function resolveTheme(theme?: SettingsThemeMode): ThemeMode {
  if (theme === 'light') return 'light'
  if (theme === 'dark') return 'dark'
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
  ) {
    return window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark'
  }
  return 'dark'
}

export function applyTheme(theme?: SettingsThemeMode) {
  setMode(resolveTheme(theme))
  setTheme(getTheme())
}

/** Read the raw 3-way mode setting from localStorage (store never rehydrates). */
export function getStoredThemeMode(): SettingsThemeMode {
  try {
    const raw = localStorage.getItem('hermes-settings')
    if (!raw) return 'system'
    const parsed = JSON.parse(raw) as {
      state?: { settings?: { theme?: SettingsThemeMode } }
    }
    const t = parsed?.state?.settings?.theme
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

export function initializeSettingsAppearance() {
  setMode(getMode())
  setTheme(getTheme())
}
