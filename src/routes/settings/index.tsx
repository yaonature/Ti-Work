import { HugeiconsIcon } from '@hugeicons/react'
import {
  CheckmarkCircle02Icon,
  CloudIcon,
  LockIcon,
  MessageMultiple01Icon,
  Mic01Icon,
  Notification03Icon,
  PaintBoardIcon,
  Settings02Icon,
  SourceCodeSquareIcon,
  SparklesIcon,
  UserIcon,
  VolumeHighIcon,
} from '@hugeicons/core-free-icons'
import { Link, createFileRoute, useSearch } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import type * as React from 'react'
import type { LoaderStyle } from '@/hooks/use-chat-settings'
import type { BrailleSpinnerPreset } from '@/components/ui/braille-spinner'
import type { ThemeId } from '@/lib/theme'
import { usePageTitle } from '@/hooks/use-page-title'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { getStoredThemeMode, useSettings } from '@/hooks/use-settings'
import { ThemeToggle } from '@/components/theme-toggle'
import { THEMES, getTheme, setTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import {
  FEATURE_LABELS,
  PLAN_META,
  derivePlanFromFeatureSet,
  type PlanId,
} from '@/lib/feature-set'
import { EmojiIcon, LobsterIcon } from '@/components/emoji-icon'
import {
  getChatProfileDisplayName,
  useChatSettingsStore,
} from '@/hooks/use-chat-settings'
import { UserAvatar } from '@/components/avatars'
import { Input } from '@/components/ui/input'
import { LogoLoader } from '@/components/logo-loader'
import { BrailleSpinner } from '@/components/ui/braille-spinner'
import { ThreeDotsSpinner } from '@/components/ui/three-dots-spinner'
// useWorkspaceStore removed — hamburger eliminated on mobile

export const Route = createFileRoute('/settings/')({
  component: SettingsRoute,
})

function PageThemeSwatch({
  colors,
}: {
  colors: {
    bg: string
    panel: string
    border: string
    accent: string
    text: string
  }
}) {
  return (
    <div
      className="flex h-10 w-full overflow-hidden rounded-md border"
      style={{ borderColor: colors.border, backgroundColor: colors.bg }}
    >
      <div
        className="flex h-full w-4 flex-col gap-0.5 p-0.5"
        style={{ backgroundColor: colors.panel }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1.5 w-full rounded-sm"
            style={{ backgroundColor: colors.border }}
          />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-1">
        <div
          className="h-1.5 w-3/4 rounded"
          style={{ backgroundColor: colors.text, opacity: 0.8 }}
        />
        <div
          className="h-1 w-1/2 rounded"
          style={{ backgroundColor: colors.text, opacity: 0.3 }}
        />
        <div
          className="mt-0.5 h-1.5 w-6 rounded-full"
          style={{ backgroundColor: colors.accent }}
        />
      </div>
    </div>
  )
}

const THEME_PREVIEWS: Record<
  ThemeId,
  { bg: string; panel: string; border: string; accent: string; text: string }
> = {
  'ti-work': {
    bg: '#1D1D20',
    panel: '#24242D',
    border: '#3A3A40',
    accent: '#148AFF',
    text: '#FAFAFA',
  },
  'hermes-os': {
    bg: '#080c14',
    panel: '#0f1828',
    border: '#18263c',
    accent: '#38bdf8',
    text: '#e4edff',
  },
  'hermes-official': {
    bg: '#0A0E1A',
    panel: '#11182A',
    border: '#24304A',
    accent: '#6366F1',
    text: '#E6EAF2',
  },
  'hermes-classic': {
    bg: '#0d0f12',
    panel: '#1a1f26',
    border: '#2a313b',
    accent: '#b98a44',
    text: '#eceff4',
  },
  'hermes-slate': {
    bg: '#0d1117',
    panel: '#1c2128',
    border: '#30363d',
    accent: '#7eb8f6',
    text: '#c9d1d9',
  },
  'hermes-mono': {
    bg: '#111111',
    panel: '#222222',
    border: '#333333',
    accent: '#aaaaaa',
    text: '#e6edf3',
  },
}

/** Live-track <html data-mode> so swatches react to the mode toggle. */
function useMode(): 'light' | 'dark' {
  const [mode, setModeState] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-mode') === 'light'
      ? 'light'
      : 'dark',
  )
  useEffect(() => {
    const el = document.documentElement
    const update = () =>
      setModeState(el.getAttribute('data-mode') === 'light' ? 'light' : 'dark')
    const mo = new MutationObserver(update)
    mo.observe(el, { attributes: true, attributeFilter: ['data-mode'] })
    return () => mo.disconnect()
  }, [])
  return mode
}

const THEME_PREVIEWS_LIGHT: Partial<
  Record<ThemeId, { bg: string; panel: string; border: string; accent: string; text: string }>
> = {
  'ti-work': {
    bg: '#FFFFFF',
    panel: '#FFFFFF',
    border: '#E4E4E7',
    accent: '#0A84FF',
    text: '#09090B',
  },
}

function WorkspaceThemePicker() {
  const { updateSettings } = useSettings()
  const mode = useMode()
  const [current, setCurrent] = useState<ThemeId>(() => getTheme())

  function applyWorkspaceTheme(id: ThemeId) {
    setTheme(id)
    // Preserve the user's light/dark/system mode — do not force dark.
    updateSettings({ theme: getStoredThemeMode() })
    setCurrent(id)
  }

  return (
    <div className="grid w-full gap-2 md:grid-cols-3">
      {THEMES.map((t) => {
        const isActive = current === t.id
        const preview =
          (mode === 'light' ? THEME_PREVIEWS_LIGHT[t.id] : undefined) ??
          THEME_PREVIEWS[t.id]
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => applyWorkspaceTheme(t.id)}
            className={cn(
              'flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors',
              isActive
                ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-subtle)] text-[var(--theme-text)]'
                : 'border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] hover:bg-[var(--theme-card2)]',
            )}
          >
            <PageThemeSwatch colors={preview} />
            <div className="flex items-center gap-1.5">
              <span className="text-xs">
                <EmojiIcon emoji={t.icon} size={14} />
              </span>
              <span className="text-xs font-semibold">{t.label}</span>
              {isActive && (
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-[var(--theme-accent)]">
                  使用中
                </span>
              )}
            </div>
            <p className="text-[10px] leading-tight text-[var(--theme-muted)]">
              {t.description}
            </p>
          </button>
        )
      })}
    </div>
  )
}

type SectionProps = {
  title: string
  description: string
  icon: React.ComponentProps<typeof HugeiconsIcon>['icon']
  children: React.ReactNode
}

function SettingsSection({ title, description, icon, children }: SectionProps) {
  return (
    <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-4 shadow-sm backdrop-blur-xl md:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/70">
          <HugeiconsIcon icon={icon} size={20} strokeWidth={1.5} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-medium text-[var(--theme-text)] text-balance">
            {title}
          </h2>
          <p className="text-sm text-[var(--theme-muted)] text-pretty">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

type RowProps = {
  label: string
  description?: React.ReactNode
  children: React.ReactNode
}

function SettingsRow({ label, description, children }: RowProps) {
  return (
    <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--theme-text)] text-balance">
          {label}
        </p>
        {description ? (
          <p className="text-xs text-[var(--theme-muted)] text-pretty">{description}</p>
        ) : null}
      </div>
      <div className="flex w-full items-center gap-2 md:w-auto md:justify-end">
        {children}
      </div>
    </div>
  )
}

type SettingsSectionId =
  | 'profile'
  | 'appearance'
  | 'chat'
  | 'hermes'
  | 'agent'
  | 'permissions'
  | 'routing'
  | 'voice'
  | 'display'
  | 'notifications'
  | 'integrations'
  | 'identity'
  | 'account'
  | 'autostart'
  | 'hub'
  | 'advanced'

type SettingsNavItem = {
  id: SettingsSectionId | 'mcp' | 'users'
  label: string
  to?: '/settings/mcp' | '/settings/users'
}

const SETTINGS_NAV_ITEMS: Array<SettingsNavItem> = [
  { id: 'hermes', label: '模型与服务商' },
  { id: 'agent', label: '智能体行为' },
  { id: 'permissions', label: '权限与工具集' },
  { id: 'routing', label: '智能路由' },
  { id: 'voice', label: '语音' },
  { id: 'display', label: '显示' },
  { id: 'appearance', label: '外观' },
  { id: 'chat', label: '会话' },
  { id: 'notifications', label: '通知' },
  { id: 'integrations', label: '集成' },
  { id: 'identity', label: '身份与账号' },
  { id: 'account', label: '账号中心' },
  { id: 'autostart', label: '开机自启' },
  { id: 'hub', label: '企业中枢' },
  { id: 'users', label: '用户管理', to: '/settings/users' },
  { id: 'mcp', label: 'MCP 服务器', to: '/settings/mcp' },
]

function SettingsRoute() {
  usePageTitle('设置')
  const { settings, updateSettings } = useSettings()

  // Phase 4.2: Fetch models for preferred model dropdowns
  const [availableModels, setAvailableModels] = useState<
    Array<{ id: string; label: string }>
  >([])
  const [modelsError, setModelsError] = useState(false)

  useEffect(() => {
    async function fetchModels() {
      setModelsError(false)
      try {
        const res = await fetch('/api/models')
        if (!res.ok) {
          setModelsError(true)
          return
        }
        const data = await res.json()
        const models = Array.isArray(data.models) ? data.models : []
        setAvailableModels(
          models.map((m: any) => ({
            id: m.id || '',
            label: m.id?.split('/').pop() || m.id || '',
          })),
        )
      } catch {
        setModelsError(true)
      }
    }
    void fetchModels()
  }, [])

  // 支持外部升级 CTA 跳转：/settings?section=account|hub → 定位对应板块
  const search = useSearch({ strict: false }) as {
    section?: string
  }
  const requestedSection = search?.section

  const [activeSection, setActiveSection] = useState<SettingsSectionId>(() => {
    if (
      typeof requestedSection === 'string' &&
      SETTINGS_NAV_ITEMS.some((item) => item.id === requestedSection)
    ) {
      return requestedSection as SettingsSectionId
    }
    return 'hermes'
  })

  useEffect(() => {
    if (
      typeof requestedSection === 'string' &&
      SETTINGS_NAV_ITEMS.some((item) => item.id === requestedSection)
    ) {
      setActiveSection(requestedSection as SettingsSectionId)
    }
  }, [requestedSection])

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="pointer-events-none fixed inset-0 bg-radial from-primary-400/20 via-transparent to-transparent" />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-primary-100/25 via-transparent to-primary-300/20" />

      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-6 pb-24 sm:px-6 md:flex-row md:gap-6 md:pb-8 lg:pt-8">
        {/* Sidebar nav */}
        <nav className="hidden w-48 shrink-0 md:block">
          <div className="sticky top-8">
            <h1 className="mb-4 text-lg font-semibold text-[var(--theme-text)] px-3">
              设置
            </h1>
            <div className="flex flex-col gap-0.5">
              {SETTINGS_NAV_ITEMS.map((item) =>
                item.to ? (
                  <Link
                    key={item.id}
                    to={item.to}
                    className="rounded-lg px-3 py-2 text-left text-sm text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-panel)] hover:text-[var(--theme-text)]"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setActiveSection(item.id as SettingsSectionId)
                    }
                    className={cn(
                      'rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      activeSection === item.id
                        ? 'bg-[var(--theme-accent)]/10 text-accent-600 font-medium'
                        : 'text-[var(--theme-muted)] hover:bg-[var(--theme-panel)] hover:text-[var(--theme-text)]',
                    )}
                  >
                    {item.label}
                  </button>
                ),
              )}
            </div>
          </div>
        </nav>

        {/* Mobile header — intentionally omitted; MobilePageHeader above shows "Settings" */}

        {/* Mobile section pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none md:hidden">
          {SETTINGS_NAV_ITEMS.map((item) =>
            item.to ? (
              <Link
                key={item.id}
                to={item.to}
                className="shrink-0 rounded-full bg-[var(--theme-panel)] px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id as SettingsSectionId)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  activeSection === item.id
                    ? 'bg-[var(--theme-accent)] text-white'
                    : 'bg-[var(--theme-panel)] text-[var(--theme-muted)]',
                )}
              >
                {item.label}
              </button>
            ),
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* ── Hermes Agent ──────────────────────────────────── */}
          {activeSection === 'hermes' && (
            <HermesConfigSection activeView="hermes" />
          )}
          {activeSection === 'agent' && (
            <HermesConfigSection activeView="agent" />
          )}
          {activeSection === 'routing' && (
            <HermesConfigSection activeView="routing" />
          )}
          {activeSection === 'voice' && (
            <HermesConfigSection activeView="voice" />
          )}
          {activeSection === 'display' && (
            <HermesConfigSection activeView="display" />
          )}
          {activeSection === 'permissions' && (
            <HermesConfigSection activeView="permissions" />
          )}

          {/* ── Appearance ──────────────────────────────────────── */}
          {activeSection === 'appearance' && (
            <>
              <SettingsSection
                title="外观"
                description="选择界面明暗与工作区主题。"
                icon={PaintBoardIcon}
              >
                <SettingsRow
                  label="明暗模式"
                  description="切换浅色 / 深色，或跟随系统。"
                >
                  <ThemeToggle />
                </SettingsRow>
                <SettingsRow
                  label="主题"
                  description="工作区主题。Ti Work 支持浅色与深色，其余主题为深色设计。"
                >
                  <div className="w-full">
                    <WorkspaceThemePicker />
                  </div>
                </SettingsRow>

                {/* Accent color removed — themes control accent */}
              </SettingsSection>
              {/* LoaderStyleSection removed — not relevant for Hermes */}
            </>
          )}

          {/* ── Chat ────────────────────────────────────────────── */}
          {activeSection === 'chat' && <ChatDisplaySection />}

          {/* ── Editor ──────────────────────────────────────────── */}
          {activeSection === ('editor' as SettingsSectionId) && (
            <SettingsSection
              title="编辑器"
              description="配置文件工作区中的 Monaco 默认设置。"
              icon={SourceCodeSquareIcon}
            >
              <SettingsRow
                label="字号"
                description="在 12 到 20 之间调整编辑器字号。"
              >
                <div className="flex w-full items-center gap-2 md:max-w-xs">
                  <input
                    type="range"
                    min={12}
                    max={20}
                    value={settings.editorFontSize}
                    onChange={(e) =>
                      updateSettings({ editorFontSize: Number(e.target.value) })
                    }
                    className="w-full accent-primary-900 dark:accent-primary-400"
                    aria-label={`编辑器字号：${settings.editorFontSize} 像素`}
                    aria-valuemin={12}
                    aria-valuemax={20}
                    aria-valuenow={settings.editorFontSize}
                  />
                  <span className="w-12 text-right text-sm tabular-nums text-[var(--theme-text)]">
                    {settings.editorFontSize}px
                  </span>
                </div>
              </SettingsRow>
              <SettingsRow
                label="自动换行"
                description="默认在编辑器中自动换行。"
              >
                <Switch
                  checked={settings.editorWordWrap}
                  onCheckedChange={(checked) =>
                    updateSettings({ editorWordWrap: checked })
                  }
                  aria-label="自动换行"
                />
              </SettingsRow>
              <SettingsRow
                label="缩略图"
                description="在 Monaco 编辑器中显示代码缩略图。"
              >
                <Switch
                  checked={settings.editorMinimap}
                  onCheckedChange={(checked) =>
                    updateSettings({ editorMinimap: checked })
                  }
                  aria-label="显示缩略图"
                />
              </SettingsRow>
            </SettingsSection>
          )}

          {/* ── Notifications ───────────────────────────────────── */}
          {activeSection === 'notifications' && (
            <>
              <SettingsSection
                title="通知"
                description="控制提醒通知的发送与用量预警阈值。"
                icon={Notification03Icon}
              >
                <SettingsRow
                  label="启用提醒"
                  description="显示用量和系统提醒通知。"
                >
                  <Switch
                    checked={settings.notificationsEnabled}
                    onCheckedChange={(checked) =>
                      updateSettings({ notificationsEnabled: checked })
                    }
                    aria-label="启用提醒"
                  />
                </SettingsRow>
                <SettingsRow
                  label="用量阈值"
                  description="设置 50% 到 100% 之间的用量预警触发值。"
                >
                  <div className="flex w-full items-center gap-2 md:max-w-xs">
                    <input
                      type="range"
                      min={50}
                      max={100}
                      value={settings.usageThreshold}
                      onChange={(e) =>
                        updateSettings({
                          usageThreshold: Number(e.target.value),
                        })
                      }
                      className="w-full accent-primary-900 dark:accent-primary-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!settings.notificationsEnabled}
                      aria-label={`用量阈值：${settings.usageThreshold}%`}
                      aria-valuemin={50}
                      aria-valuemax={100}
                      aria-valuenow={settings.usageThreshold}
                    />
                    <span className="w-12 text-right text-sm tabular-nums text-[var(--theme-text)]">
                      {settings.usageThreshold}%
                    </span>
                  </div>
                </SettingsRow>
              </SettingsSection>

              <SettingsSection
                title="智能建议"
                description="主动获取模型建议，以优化成本与质量。"
                icon={Settings02Icon}
              >
                <SettingsRow
                  label="启用智能建议"
                  description="为简单任务推荐更便宜的模型，为复杂工作推荐更好的模型。"
                >
                  <Switch
                    checked={settings.smartSuggestionsEnabled}
                    onCheckedChange={(checked) =>
                      updateSettings({ smartSuggestionsEnabled: checked })
                    }
                    aria-label="启用智能建议"
                  />
                </SettingsRow>
                <SettingsRow
                  label="首选经济型模型"
                  description="更便宜建议的默认模型（留空则自动检测）。"
                >
                  <select
                    value={settings.preferredBudgetModel}
                    onChange={(e) =>
                      updateSettings({ preferredBudgetModel: e.target.value })
                    }
                    className="h-9 w-full rounded-lg border border-[var(--theme-border)] dark:border-gray-600 bg-[var(--theme-bg)] dark:bg-gray-800 px-3 text-sm text-[var(--theme-text)] dark:text-gray-100 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-400 dark:focus-visible:ring-primary-500 md:max-w-xs"
                    aria-label="首选经济型模型"
                  >
                    <option value="">自动检测</option>
                    {modelsError && (
                      <option disabled>加载模型失败</option>
                    )}
                    {availableModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </SettingsRow>
                <SettingsRow
                  label="首选高端模型"
                  description="升级建议的默认模型（留空则自动检测）。"
                >
                  <select
                    value={settings.preferredPremiumModel}
                    onChange={(e) =>
                      updateSettings({ preferredPremiumModel: e.target.value })
                    }
                    className="h-9 w-full rounded-lg border border-[var(--theme-border)] dark:border-gray-600 bg-[var(--theme-bg)] dark:bg-gray-800 px-3 text-sm text-[var(--theme-text)] dark:text-gray-100 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-400 dark:focus-visible:ring-primary-500 md:max-w-xs"
                    aria-label="首选高端模型"
                  >
                    <option value="">自动检测</option>
                    {modelsError && (
                      <option disabled>加载模型失败</option>
                    )}
                    {availableModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </SettingsRow>
                <SettingsRow
                  label="仅建议更便宜的模型"
                  description="从不建议升级，只建议更便宜的替代方案。"
                >
                  <Switch
                    checked={settings.onlySuggestCheaper}
                    onCheckedChange={(checked) =>
                      updateSettings({ onlySuggestCheaper: checked })
                    }
                    aria-label="仅建议更便宜的模型"
                  />
                </SettingsRow>
              </SettingsSection>
            </>
          )}

          {/* ── Integrations ────────────────────────────────────── */}
          {activeSection === 'integrations' && <IntegrationsSection />}

          {/* ── Identity ────────────────────────────────────────── */}
          {activeSection === 'identity' && <IdentityFileEditor />}

          {/* ── Account center（软登录：单机版可选登录）──────────── */}
          {activeSection === 'account' && <AccountCenterSection />}

          {/* ── Auto-start ──────────────────────────────────────── */}
          {activeSection === 'autostart' && <SystemdAutoStartSection />}
          {activeSection === 'hub' && <HubSection />}

          <footer className="mt-auto pt-4">
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)]/70 p-3 text-sm text-[var(--theme-muted)] backdrop-blur-sm">
              <HugeiconsIcon
                icon={Settings02Icon}
                size={20}
                strokeWidth={1.5}
              />
              <span className="text-pretty">
                更改会自动保存到本地存储。
              </span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  )
}

// ── Identity File Editor ──────────────────────────────────────────────────────

/**
 * Reads and writes the three identity-defining files in ~/.hermes:
 *   • SOUL.md      — agent persona / tone (loaded every message, no restart)
 *   • persona.md   — startup directives (read at session start)
 *   • CLAUDE.md    — coding guidelines / project context
 *
 * All I/O goes through GET|POST /api/files which is scoped to ~/.hermes.
 */
const IDENTITY_FILES = [
  {
    path: 'SOUL.md',
    label: 'Soul（人格）',
    description:
      '定义智能体的人格与语气。每条消息都会重新加载，修改后无需重启 Hermes 即可生效。',
  },
  {
    path: 'persona.md',
    label: 'Persona（启动）',
    description:
      '每次会话开始时读取的启动指令。可用于要求智能体加载身份文件、记忆日志或用户资料。',
  },
  {
    path: 'CLAUDE.md',
    label: 'CLAUDE.md（项目上下文）',
    description:
      '注入到每次 Claude Code 会话中的编码规范和项目上下文。可编辑以加入自定义规则或移除不需要的默认项。',
  },
] as const

type IdentityFilePath = (typeof IDENTITY_FILES)[number]['path']

async function readIdentityFile(path: IdentityFilePath): Promise<string> {
  const res = await fetch(`/api/files?action=read&path=${encodeURIComponent(path)}`)
  if (!res.ok) {
    if (res.status === 404) return ''
    throw new Error(`HTTP ${res.status}`)
  }
  const data = await res.json()
  return typeof data.content === 'string' ? data.content : ''
}

async function writeIdentityFile(
  path: IdentityFilePath,
  content: string,
): Promise<void> {
  const res = await fetch('/api/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'write', path, content }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

function IdentityFileEditor() {
  const [selectedPath, setSelectedPath] = useState<IdentityFilePath>('SOUL.md')
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    text: string
    kind: 'success' | 'error'
  } | null>(null)

  const selectedFile = IDENTITY_FILES.find((f) => f.path === selectedPath)!
  const isDirty = content !== originalContent

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessage(null)
    readIdentityFile(selectedPath)
      .then((text) => {
        if (!cancelled) {
          setContent(text)
          setOriginalContent(text)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setMessage({
            text: err instanceof Error ? err.message : '加载失败',
            kind: 'error',
          })
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [selectedPath])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await writeIdentityFile(selectedPath, content)
      setOriginalContent(content)
      setMessage({ text: '已保存。', kind: 'success' })
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : '保存失败',
        kind: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setContent(originalContent)
    setMessage(null)
  }

  return (
    <SettingsSection
      title="身份文件"
      description="编辑定义你的 Hermes 智能体人格、启动行为与编码规范的文件。更改会直接保存到 ~/.hermes。"
      icon={UserIcon}
    >
      {/* File picker */}
      <div className="flex flex-wrap gap-2 mb-4">
        {IDENTITY_FILES.map((f) => (
          <button
            key={f.path}
            type="button"
            onClick={() => {
              if (isDirty && !window.confirm('确定放弃未保存的更改吗？')) return
              setSelectedPath(f.path)
            }}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border',
              selectedPath === f.path
                ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]'
                : 'border-[var(--theme-border)] bg-[var(--theme-panel)] text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <p className="text-xs text-[var(--theme-muted)] mb-3">
        {selectedFile.description}
      </p>

      {/* Editor */}
      {loading ? (
        <div className="h-48 flex items-center justify-center text-sm text-[var(--theme-muted)]">
          加载中…
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          rows={18}
          placeholder={`# ${selectedPath}\n\n开始编写…`}
          className="w-full resize-y rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2.5 font-mono text-xs leading-relaxed text-[var(--theme-text)] outline-none focus:border-[var(--theme-accent)] transition-colors"
          style={{ minHeight: '12rem' }}
        />
      )}

      {/* Feedback message */}
      {message && (
        <div
          className="rounded-lg px-3 py-2 text-xs font-medium mt-2"
          style={{
            backgroundColor:
              message.kind === 'error'
                ? 'rgba(239,68,68,0.12)'
                : 'rgba(34,197,94,0.12)',
            color: message.kind === 'error' ? '#ef4444' : '#22c55e',
          }}
        >
          {message.text}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 mt-3">
        <span className="text-[10px] text-[var(--theme-muted)]">
          {isDirty ? '有未保存更改' : '已是最新'}
        </span>
        <div className="flex gap-2">
          {isDirty && (
            <Button size="sm" variant="outline" onClick={handleDiscard}>
              放弃
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}

// ── Enterprise Hub Section（G8：企业中枢接入）───────────────────────────────

interface HubStatusPayload {
  configured: boolean
  connected: boolean
  baseUrl: string
  tenantId: string
  email: string
  deviceId: string
  featureSet: Array<string>
  license: {
    edition: string
    expiresAt: number
    hardDeadline: number
    inGrace: boolean
    seats: number
    activeSeats: number
  } | null
  licenseExpired: boolean
  inGrace: boolean
  lastHeartbeatAt: number | null
  disconnectedAt: number | null
  lastError: string | null
  outboxDepth: number
  enterprise: {
    modelAllowlist: Array<string>
    provider?: string
    apiKeyEnv?: string
  } | null
}

/**
 * 模型白名单选择器（企业统一下发，只读浏览）：
 * 以 chips 网格展示白名单模型，按 provider 前缀着色，模型较多时可搜索过滤。
 */
function ModelAllowlistSelector({ models }: { models: Array<string> }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = q ? models.filter((m) => m.toLowerCase().includes(q)) : models
  const showSearch = models.length > 8

  return (
    <div className="mt-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--theme-text)]">
          模型白名单
          <span className="rounded-full bg-[var(--theme-accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--theme-accent)]">
            {models.length}
          </span>
          <span className="font-normal text-[var(--theme-muted)]">
            企业统一下发 · 仅以下模型可被选用
          </span>
        </span>
        {showSearch && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索模型…"
            className="w-40 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1 text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />
        )}
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-[var(--theme-muted)]">没有匹配的模型</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {filtered.map((model) => {
            const sep = model.includes(':')
              ? ':'
              : model.includes('/')
                ? '/'
                : null
            const prefix = sep ? model.slice(0, model.indexOf(sep)) : null
            return (
              <span
                key={model}
                title={model}
                className="flex items-center gap-1.5 rounded-full border border-[var(--theme-border)] bg-[var(--theme-input)] px-2.5 py-1 font-mono text-[11px] text-[var(--theme-text)]"
              >
                {prefix && (
                  <span className="rounded-full bg-[var(--theme-accent)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--theme-accent)]">
                    {prefix}
                  </span>
                )}
                {model}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function HubSection() {
  const [status, setStatus] = useState<HubStatusPayload | null>(null)
  const [baseUrl, setBaseUrl] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const refresh = useCallback(() => {
    fetch('/api/hub')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { status?: HubStatusPayload } | null) => {
        if (d?.status) setStatus(d.status)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleConnect() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/hub?action=connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, tenantId, email, password }),
      })
      const d = (await res.json()) as {
        ok?: boolean
        error?: string
        status?: HubStatusPayload
      }
      if (!res.ok || !d.ok) {
        throw new Error(d.error || `连接失败（HTTP ${res.status}）`)
      }
      if (d.status) setStatus(d.status)
      setPassword('')
      setMsg({ kind: 'ok', text: '已连接企业中枢。' })
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : '连接失败',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleAction(action: 'disconnect' | 'heartbeat' | 'flush') {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/hub?action=${action}`, { method: 'POST' })
      const d = (await res.json()) as { ok?: boolean; error?: string; status?: HubStatusPayload }
      if (!res.ok || !d.ok) throw new Error(d.error || `${action} 失败`)
      if (d.status) setStatus(d.status)
      setMsg({
        kind: 'ok',
        text:
          action === 'disconnect'
            ? '已断开与中枢的连接。'
            : action === 'heartbeat'
              ? '心跳已发送。'
              : '待上报事件已全部补报。',
      })
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : `${action} 失败` })
    } finally {
      setBusy(false)
    }
  }

  const fmtDate = (ts: number | null | undefined) =>
    ts ? new Date(ts).toLocaleString() : '—'

  return (
    <>
      <SettingsSection
        title="企业中枢"
        description="接入 Ti Work 企业中枢：登录/席位/有效期受中枢控制，血缘与审计事件自动上报（离线暂存、联网补报）。"
        icon={CloudIcon}
      >
        {status?.configured ? (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                  status.connected
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-amber-500/10 text-amber-600',
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    status.connected ? 'bg-emerald-500' : 'bg-amber-500',
                  )}
                />
                {status.connected ? '已连接' : '未连接'}
              </span>
              {status.licenseExpired && (
                <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600">
                  许可证已过期 —— 已禁止登录
                </span>
              )}
              {status.inGrace && !status.licenseExpired && (
                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600">
                  宽限期
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--theme-muted)]">
              {status.baseUrl} · 租户 {status.tenantId} · {status.email} · 设备 {status.deviceId}
            </p>
            {status.license && (
              <p className="text-xs text-[var(--theme-muted)]">
                版本 <code className="inline-code">{status.license.edition}</code> · 席位{' '}
                {status.license.activeSeats}/{status.license.seats} · 到期{' '}
                {fmtDate(status.license.expiresAt)}
                {status.license.inGrace && `（宽限期至 ${fmtDate(status.license.hardDeadline)}）`}
              </p>
            )}
            {status.featureSet.length > 0 && (
              <p className="text-xs text-[var(--theme-muted)]">
                功能：{status.featureSet.join(', ')}
              </p>
            )}
            {status.enterprise && status.enterprise.modelAllowlist.length > 0 && (
              <ModelAllowlistSelector
                models={status.enterprise.modelAllowlist}
              />
            )}
            {status.enterprise?.apiKeyEnv && (
              <p className="text-xs text-emerald-600">
                API Key 已由企业统一配置（{status.enterprise.apiKeyEnv}），用户零配置
              </p>
            )}
            <p className="text-xs text-[var(--theme-muted)]">
              最近心跳 {fmtDate(status.lastHeartbeatAt)} · 待上报{' '}
              <strong className="font-semibold text-[var(--theme-text)]">{status.outboxDepth}</strong>
              {status.lastError && (
                <span className="ml-2 text-red-600">· {status.lastError}</span>
              )}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => handleAction('heartbeat')} disabled={busy}>
                发送心跳
              </Button>
              <Button size="sm" onClick={() => handleAction('flush')} disabled={busy}>
                立即上报
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleAction('disconnect')}
                disabled={busy}
              >
                断开连接
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--theme-muted)]">
            尚未接入企业中枢。输入中枢地址与账号即可接入（专业版 / 私有化版功能）。
          </p>
        )}
      </SettingsSection>

      {!status?.configured && (
        <SettingsSection
          title="连接中枢"
          description="使用中枢下发的企业账号接入。凭证仅用于本次登录，不落盘；会话令牌由桌面端本地保管（0600）。"
          icon={CloudIcon}
        >
          <div className="flex w-full flex-col gap-3 md:max-w-md">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--theme-muted)]">
                中枢地址
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://hub.example.com"
                  className="text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--theme-muted)]">
                租户 ID
                <Input
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="租户 ID"
                  className="text-sm"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--theme-muted)]">
                邮箱
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--theme-muted)]">
                密码
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="text-sm"
                />
              </label>
            </div>
            {msg && (
              <p
                className={cn(
                  'text-xs',
                  msg.kind === 'ok' ? 'text-emerald-600' : 'text-red-600',
                )}
              >
                {msg.text}
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={handleConnect} disabled={busy || !baseUrl || !tenantId || !email || !password}>
                {busy ? '连接中…' : '连接'}
              </Button>
              <Button variant="secondary" onClick={refresh} disabled={busy}>
                刷新
              </Button>
            </div>
          </div>
        </SettingsSection>
      )}
    </>
  )
}

// ── Account Center Section（单机版软登录：登录可选，不登录零限制）────────────

/**
 * 账号中心 —— 单机版软登录呈现：
 *  - 当前订阅计划（免费/标准/专业），企业中枢已接入时以中枢 featureSet 为准
 *  - 升级 CTA（FeatureLockedCard 的入口之一，批次 3 门禁落地后复用）
 *  - 云同步 / 遥测开关（本地持久化，云同步为订阅增值能力占位）
 */
function AccountCenterSection() {
  const { settings, updateSettings } = useSettings()
  const [hubPlan, setHubPlan] = useState<PlanId | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)

  useEffect(() => {
    fetch('/api/hub')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { status?: HubStatusPayload } | null) => {
        if (d?.status?.featureSet && d.status.featureSet.length > 0) {
          setHubPlan(derivePlanFromFeatureSet(d.status.featureSet))
        }
      })
      .catch(() => {})
  }, [])

  const currentPlan: PlanId = hubPlan ?? 'free'
  const meta = PLAN_META[currentPlan]

  return (
    <>
      <SettingsSection
        title="账号中心"
        description="登录可选：不登录也能使用全部本地功能。登录后解锁订阅升级 / 云同步 / 遥测能力。"
        icon={UserIcon}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)]/60 p-4">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600">
              <HugeiconsIcon icon={SparklesIcon} size={20} strokeWidth={1.5} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-[var(--theme-text)]">
                  {meta.name}
                </p>
                {hubPlan !== null && (
                  <span className="rounded-full bg-primary-500/10 px-2 py-0.5 text-[10px] font-medium text-primary-600">
                    企业中枢下发
                  </span>
                )}
                {meta.badge && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                    {meta.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--theme-muted)]">{meta.tagline}</p>
            </div>
            <Button size="sm" onClick={() => setShowUpgrade(true)}>
              {meta.cta}
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {meta.features.map((f) => (
              <div
                key={f}
                className="flex items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)]/40 px-3 py-2 text-xs text-[var(--theme-muted)]"
              >
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  size={14}
                  strokeWidth={1.5}
                  className="text-emerald-500"
                />
                {FEATURE_LABELS[f]}
              </div>
            ))}
          </div>

          {showUpgrade && (
            <SubscriptionPanel currentPlan={currentPlan} />
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title="云同步"
        description="登录后跨设备同步会话与设置。当前为单机版本地存储，该开关预留增值入口。"
        icon={CloudIcon}
      >
        <SettingsRow
          label="开启云同步"
          description="登录账号后自动备份会话与偏好设置。"
        >
          <Switch
            checked={settings.cloudSyncEnabled}
            onCheckedChange={(checked) =>
              updateSettings({ cloudSyncEnabled: checked })
            }
            aria-label="开启云同步"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="遥测"
        description="帮助改进产品：匿名上报崩溃与使用情况，不含任何对话内容。"
        icon={Notification03Icon}
      >
        <SettingsRow
          label="开启遥测"
          description="匿名技术数据（启动耗时/崩溃/版本），可随时关闭。"
        >
          <Switch
            checked={settings.telemetryEnabled}
            onCheckedChange={(checked) =>
              updateSettings({ telemetryEnabled: checked })
            }
            aria-label="开启遥测"
          />
        </SettingsRow>
      </SettingsSection>
    </>
  )
}

/**
 * 升级 CTA 统一入口：跳转账号中心订阅/授权引导（与 FeatureLockedCard 同款收口）。
 * 若已在账号中心，AccountCenterSection 直接展开内联订阅面板。
 */
function openUpgradeGuide(): void {
  const settingsUrl = new URL('/settings', window.location.origin)
  settingsUrl.searchParams.set('section', 'account')
  window.location.href = settingsUrl.toString()
}

/**
 * 订阅与授权引导面板 —— 升级 CTA 的落地内容：
 *  - 计划对比（免费 / 标准 / 专业）
 *  - 企业授权入口 → 连接企业中枢（settings?section=hub）
 *  - 个人订阅意向收集（邮箱 + 目标计划 → 邮件提交，仅作收口兜底）
 */
function SubscriptionPanel({
  currentPlan,
}: {
  currentPlan: PlanId
}) {
  const [email, setEmail] = useState('')
  const [plan, setPlan] = useState<PlanId>('standard')
  const [submitted, setSubmitted] = useState(false)

  const targetPlan = PLAN_META[plan]
  const emailValid =
    email.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  function handleSubmit() {
    if (!emailValid) return
    const subject = `Ti Work 订阅授权咨询（${targetPlan.name}）`
    const body = [
      '您好，',
      '',
      `我想订阅 Ti Work ${targetPlan.name} 授权。`,
      '',
      `联系邮箱：${email.trim()}`,
      `目标计划：${targetPlan.name}`,
      '',
      '请提供订阅流程与开通指引，谢谢。',
    ].join('\n')
    window.open(
      `mailto:sales@tiwork.example?subject=${encodeURIComponent(
        subject,
      )}&body=${encodeURIComponent(body)}`,
      '_blank',
    )
    setSubmitted(true)
  }

  return (
    <div className="mt-3 space-y-4 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)]/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--theme-text)]">
          订阅与授权
        </p>
        <p className="text-xs text-[var(--theme-muted)]">
          个人订阅或组织授权，任选一种方式
        </p>
      </div>

      {/* 计划对比 */}
      <div className="grid gap-2 sm:grid-cols-3">
        {(['free', 'standard', 'professional'] as const).map((id) => {
          const meta = PLAN_META[id]
          const isCurrent = id === currentPlan
          const isTarget = id === plan
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPlan(id)}
              className={cn(
                'flex flex-col gap-1 rounded-xl border p-3 text-left transition-all',
                isTarget
                  ? 'border-accent-500 bg-accent-500/5 ring-1 ring-accent-500/30'
                  : 'border-[var(--theme-border)] bg-[var(--theme-card)]',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--theme-text)]">
                  {meta.name}
                </span>
                {isCurrent && (
                  <span className="rounded-full bg-[var(--theme-accent)]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent-600">
                    当前
                  </span>
                )}
              </div>
              <p className="line-clamp-2 text-[11px] leading-relaxed text-[var(--theme-muted)]">
                {meta.tagline}
              </p>
              <p className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-[var(--theme-muted)]/80">
                {meta.features.slice(0, 3).join(' · ')}
              </p>
            </button>
          )
        })}
      </div>

      {/* 企业授权入口 */}
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-card)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--theme-text)]">
              组织使用？连接企业中枢统一授权
            </p>
            <p className="text-xs text-[var(--theme-muted)]">
              由企业管理员下发订阅与模型白名单，成员零配置。
            </p>
          </div>
          <Button size="sm" onClick={openUpgradeGuideToHub}>
            前往企业授权
          </Button>
        </div>
      </div>

      {/* 个人订阅意向 */}
      <div className="flex flex-col gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3">
        <p className="text-xs font-medium text-[var(--theme-text)]">
          个人订阅意向（{targetPlan.name}）
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="min-w-0 flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!emailValid || submitted}
          >
            {submitted ? '已发送意向' : '提交订阅意向'}
          </Button>
        </div>
        {submitted && (
          <p className="text-xs text-emerald-600">
            已打开邮件客户端预填信息，发送后我们会在 1 个工作日内联系你。
          </p>
        )}
      </div>
    </div>
  )
}

function openUpgradeGuideToHub(): void {
  const settingsUrl = new URL('/settings', window.location.origin)
  settingsUrl.searchParams.set('section', 'hub')
  window.location.href = settingsUrl.toString()
}

// ── Integrations Section ─────────────────────────────────────────────────────

function IntegrationsSection() {
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState<{
    keySet: boolean
    keyMasked: string
    fromEnv: boolean
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    fetch('/api/skills/settings')
      .then((r) => r.json())
      .then((d: { skillsmpApiKeySet?: boolean; skillsmpApiKeyMasked?: string; skillsmpApiKeyFromEnv?: boolean }) => {
        setStatus({
          keySet: Boolean(d.skillsmpApiKeySet),
          keyMasked: d.skillsmpApiKeyMasked || '',
          fromEnv: Boolean(d.skillsmpApiKeyFromEnv),
        })
      })
      .catch(() => {})
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/skills/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillsmpApiKey: apiKey }),
      })
      const d = await res.json() as { ok?: boolean; skillsmpApiKeySet?: boolean; skillsmpApiKeyMasked?: string; skillsmpApiKeyFromEnv?: boolean; error?: string }
      if (!res.ok || !d.ok) throw new Error(d.error || '保存失败')
      setStatus({
        keySet: Boolean(d.skillsmpApiKeySet),
        keyMasked: d.skillsmpApiKeyMasked || '',
        fromEnv: Boolean(d.skillsmpApiKeyFromEnv),
      })
      setApiKey('')
      setShowKey(false)
      setSaveMsg('接口密钥已保存。')
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/skills/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillsmpApiKey: '' }),
      })
      const d = await res.json() as { ok?: boolean; skillsmpApiKeySet?: boolean; skillsmpApiKeyMasked?: string; skillsmpApiKeyFromEnv?: boolean; error?: string }
      if (!res.ok || !d.ok) throw new Error(d.error || '清除失败')
      setStatus({
        keySet: Boolean(d.skillsmpApiKeySet),
        keyMasked: d.skillsmpApiKeyMasked || '',
        fromEnv: Boolean(d.skillsmpApiKeyFromEnv),
      })
      setApiKey('')
      setSaveMsg('接口密钥已移除。')
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : '清除失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <SettingsSection
      title="集成"
      description="连接 Ti Work 功能所依赖的外部服务。"
      icon={SparklesIcon}
    >
      <SettingsRow
        label="skillsmp.com 接口密钥"
        description={
          <span>
            用于技能市场搜索。{' '}
            <a
              href="https://skillsmp.com/docs/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:opacity-80"
            >
              前往 skillsmp.com/docs/api 获取 →
            </a>
          </span>
        }
      >
        <div className="flex w-full flex-col gap-2 md:max-w-sm">
          {status?.fromEnv ? (
            <p className="text-xs text-[var(--theme-muted)]">
              密钥已通过 <code className="inline-code">SKILLSMP_API_KEY</code>{' '}
              环境变量设置，不能在这里修改。
            </p>
          ) : (
            <>
              {status?.keySet && (
                <div className="flex items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-panel)]/60 px-3 py-2 text-sm">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="shrink-0 text-green-600" />
                  <span className="font-mono text-xs text-[var(--theme-text)] flex-1 truncate">
                    {status.keyMasked}
                  </span>
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={saving}
                    className="text-xs text-[var(--theme-muted)] hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    移除
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder={status?.keySet ? '输入新密钥以替换…' : 'sk_live_…'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1 font-mono text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && apiKey.trim()) void handleSave()
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="px-2 text-xs text-[var(--theme-muted)] hover:text-[var(--theme-text)] transition-colors"
                  aria-label={showKey ? '隐藏密钥' : '显示密钥'}
                >
                  {showKey ? '隐藏' : '显示'}
                </button>
              </div>
              <Button
                size="sm"
                disabled={saving || !apiKey.trim()}
                onClick={() => void handleSave()}
              >
                {saving ? '保存中…' : '保存密钥'}
              </Button>
              {saveMsg && (
                <p className="text-xs text-[var(--theme-muted)]">{saveMsg}</p>
              )}
            </>
          )}
        </div>
      </SettingsRow>

      {/* Feishu / DingTalk webhook channels → ~/.hermes/config.yaml `integrations` */}
      <div className="border-t border-[var(--theme-border)] pt-4">
        <p className="text-sm font-medium text-[var(--theme-text)]">
          飞书 / 钉钉 Webhook
        </p>
        <p className="mb-3 text-xs text-[var(--theme-muted)]">
          网关事件使用的消息投递渠道。保存到{' '}
          <code className="inline-code">~/.hermes/config.yaml</code>{' '}
          后网关会自动重载。
        </p>
        <div className="flex flex-col gap-3">
          <IntegrationChannelCard channel="feishu" />
          <IntegrationChannelCard channel="dingtalk" />
        </div>
      </div>
    </SettingsSection>
    <PlatformsSection />
    </>
  )
}

// ── Integration webhook channels (Feishu / DingTalk) ─────────────────────────

const INTEGRATION_CHANNELS = [
  {
    key: 'feishu',
    label: 'Feishu (飞书)',
    hint: '飞书群中的自定义机器人 Webhook，可选签名密钥。',
    webhookPlaceholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxxx',
  },
  {
    key: 'dingtalk',
    label: 'DingTalk (钉钉)',
    hint: '钉钉群中的自定义机器人 Webhook，建议使用签名密钥。',
    webhookPlaceholder: 'https://oapi.dingtalk.com/robot/send?access_token=xxxx',
  },
] as const

type IntegrationChannelKey = (typeof INTEGRATION_CHANNELS)[number]['key']

type IntegrationChannelState = {
  configured: boolean
  enabled: boolean
  secretSet: boolean
  secretMasked: string
  webhookUrlMasked: string
}

type IntegrationReloadStatus = 'reloaded' | 'reload-failed' | 'gateway-offline'

const RELOAD_MESSAGES: Record<IntegrationReloadStatus, string> = {
  reloaded: '已保存。网关已重载，设置已即时生效。',
  'reload-failed':
    '已保存，但网关重载失败。请重启网关后生效。',
  'gateway-offline':
    '已保存。网关当前离线，启动后会自动加载这些设置。',
}

function IntegrationChannelCard({ channel }: { channel: IntegrationChannelKey }) {
  const meta = INTEGRATION_CHANNELS.find((c) => c.key === channel)!
  const [state, setState] = useState<IntegrationChannelState | null>(null)
  const [editing, setEditing] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState<{
    kind: 'ok' | 'err' | 'info'
    text: string
  } | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/integrations')
      .then((r) => r.json())
      .then((d: { integrations?: Record<string, IntegrationChannelState> }) => {
        if (!alive) return
        setState(d.integrations?.[channel] ?? null)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [channel])

  function startEdit() {
    setWebhookUrl('')
    setSecret('')
    setEnabled(state?.enabled ?? true)
    setEditing(true)
    setMsg(null)
  }

  function cancelEdit() {
    setEditing(false)
    setMsg(null)
  }

  async function save() {
    const url = webhookUrl.trim()
    if (!url) {
      setMsg({ kind: 'err', text: 'Webhook URL 不能为空。' })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          settings: {
            enabled,
            webhookUrl: url,
            // 留空不传 secret → 后端保留现有值（避免误清）
            ...(secret.trim() ? { secret: secret.trim() } : {}),
          },
        }),
      })
      const d = (await res.json()) as {
        ok?: boolean
        message?: string
        state?: IntegrationChannelState
        reload?: { status?: IntegrationReloadStatus }
      }
      if (!res.ok || !d.ok) throw new Error(d.message || '保存失败')
      if (d.state) setState(d.state)
      setEditing(false)
      setSecret('')
      const reloadStatus = d.reload?.status ?? 'reloaded'
      setMsg({ kind: 'ok', text: RELOAD_MESSAGES[reloadStatus] })
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : '保存失败',
      })
    } finally {
      setSaving(false)
    }
  }

  async function test() {
    setTesting(true)
    setMsg(null)
    try {
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      })
      const d = (await res.json()) as {
        ok?: boolean
        delivered?: boolean
        message?: string
        status?: number
      }
      setMsg({
        kind: d.delivered ? 'ok' : 'err',
        text:
          d.message ||
          (d.delivered ? '测试消息已发送。' : '投递失败。'),
      })
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : '测试失败',
      })
    } finally {
      setTesting(false)
    }
  }

  async function remove() {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, settings: null }),
      })
      const d = (await res.json()) as { ok?: boolean; message?: string }
      if (!res.ok || !d.ok) throw new Error(d.message || '移除失败')
      setState(null)
      setEditing(false)
      setMsg({ kind: 'info', text: '渠道已移除。' })
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : '移除失败',
      })
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 font-mono text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--theme-text)]">
            {meta.label}
            {state?.configured && (
              <span
                className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  state.enabled
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}
              >
                {state.enabled ? '已启用' : '已暂停'}
              </span>
            )}
          </p>
          <p className="text-xs text-[var(--theme-muted)]">{meta.hint}</p>
        </div>
        {!editing && state?.configured && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void test()}
              disabled={testing || saving}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-panel)] disabled:opacity-40"
            >
              {testing ? '测试中…' : '测试'}
            </button>
            <button
              type="button"
              onClick={startEdit}
              disabled={saving}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-panel)] disabled:opacity-40"
            >
              编辑
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={saving}
              className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              移除
            </button>
          </div>
        )}
      </div>

      {!editing && state?.configured && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-panel)]/60 px-3 py-1.5">
            <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--theme-muted)]">
              Webhook
            </span>
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--theme-text)]">
              {state.webhookUrlMasked}
            </code>
          </div>
          {state.secretSet && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-panel)]/60 px-3 py-1.5">
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--theme-muted)]">
                密钥
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--theme-text)]">
                {state.secretMasked}
              </code>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--theme-text)]">
              Webhook URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder={meta.webhookPlaceholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void save()
                }}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--theme-text)]">
              签名密钥
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={
                  state?.secretSet
                    ? '留空以保留当前密钥'
                    : '可选'
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void save()
                }}
                className={inputCls}
              />
            </div>
            <p className="text-[11px] text-[var(--theme-muted)]">
              留空以保留现有密钥。
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--theme-text)]">
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label={`启用 ${meta.label} 渠道`}
            />
            已启用
          </label>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => void save()} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
            <Button size="sm" variant="outline" onClick={cancelEdit}>
              取消
            </Button>
          </div>
        </div>
      )}

      {!editing && !state?.configured && (
        <div>
          <Button size="sm" variant="outline" onClick={startEdit}>
            配置
          </Button>
        </div>
      )}

      {msg && (
        <p
          className={`text-xs ${
            msg.kind === 'err'
              ? 'text-red-600 dark:text-red-400'
              : msg.kind === 'info'
                ? 'text-[var(--theme-muted)]'
                : 'text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  )
}

// ── Platforms Section (chat platform tokens → ~/.hermes/.env) ────────────────

const CHAT_PLATFORMS = [
  {
    key: 'telegram',
    label: 'Telegram',
    envVar: 'TELEGRAM_BOT_TOKEN',
    placeholder: '1234567890:AAFxxxxxx',
    hint: '通过 @BotFather 在 Telegram 上创建机器人。',
    allowedUsersVar: 'TELEGRAM_ALLOWED_USERS',
    allowedUsersPlaceholder: '123456789,987654321',
  },
  {
    key: 'discord',
    label: 'Discord',
    envVar: 'DISCORD_BOT_TOKEN',
    placeholder: 'MTxxxxxxxxxxxxxxx.Gxxxxx.xxxx',
    hint: '在 discord.com/developers 创建机器人。',
    allowedUsersVar: 'DISCORD_ALLOWED_USERS',
    allowedUsersPlaceholder: '用户名#0000 或用户 ID',
  },
  {
    key: 'slack',
    label: 'Slack',
    envVar: 'SLACK_BOT_TOKEN',
    placeholder: 'xoxb-…',
    hint: '在 api.slack.com 创建 Slack 应用。',
    allowedUsersVar: 'SLACK_ALLOWED_USERS',
    allowedUsersPlaceholder: 'U01234567',
  },
  {
    key: 'signal',
    label: 'Signal',
    envVar: 'SIGNAL_HTTP_URL',
    placeholder: 'http://localhost:8080',
    hint: '需要以 HTTP 守护进程方式运行 signal-cli。',
    allowedUsersVar: 'SIGNAL_ACCOUNT',
    allowedUsersPlaceholder: '+1234567890',
  },
  {
    key: 'bluebubbles',
    label: 'BlueBubbles (iMessage)',
    envVar: 'BLUEBUBBLES_URL',
    placeholder: 'http://your-mac:1234',
    hint: '需要在 Mac 上运行 BlueBubbles 服务器。',
    allowedUsersVar: 'BLUEBUBBLES_PASSWORD',
    allowedUsersPlaceholder: '服务器密码',
  },
  {
    key: 'wechat',
    label: 'WeChat (Weixin)',
    envVar: 'WECHAT_ILINK_TOKEN',
    placeholder: 'iLink Bot API token',
    hint: '通过 iLink Bot API —— 需要微信公众号。',
    allowedUsersVar: 'WECHAT_ALLOWED_USERS',
    allowedUsersPlaceholder: '微信用户 ID',
  },
  {
    key: 'wecom',
    label: 'WeCom (Enterprise)',
    envVar: 'WECOM_CORP_ID',
    placeholder: 'your-corp-id',
    hint: '企业微信回调模式 —— 自建企业应用。',
    allowedUsersVar: 'WECOM_AGENT_SECRET',
    allowedUsersPlaceholder: '应用密钥',
  },
] as const

type PlatformKey = (typeof CHAT_PLATFORMS)[number]['key']

function PlatformsSection() {
  // envVars: current values from ~/.hermes/.env (masked)
  const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({})
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [msgs, setMsgs] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/hermes-config')
      .then((r) => r.json())
      .then((d: { config?: Record<string, unknown> }) => {
        // The GET returns config but not raw env values (masked).
        // We can only detect whether the token is configured by checking
        // the platform section in config.yaml (platforms: { telegram: { enabled } }).
        // As a proxy, treat any non-empty value in our local inputs as "set".
        // Reset — presence is inferred from the PATCH response later.
        void d
        setEnvStatus({})
      })
      .catch(() => {})
  }, [])

  const setInput = (key: string, value: string) =>
    setInputs((prev) => ({ ...prev, [key]: value }))

  const saveToken = async (platform: (typeof CHAT_PLATFORMS)[number]) => {
    const token = (inputs[platform.key] || '').trim()
    setSaving((prev) => ({ ...prev, [platform.key]: true }))
    setMsgs((prev) => ({ ...prev, [platform.key]: '' }))
    try {
      const res = await fetch('/api/hermes-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          env: { [platform.envVar]: token },
        }),
      })
      const d = (await res.json()) as { ok?: boolean; message?: string }
      if (!res.ok) throw new Error(d.message || '保存失败')
      setEnvStatus((prev) => ({ ...prev, [platform.key]: Boolean(token) }))
      setInputs((prev) => ({ ...prev, [platform.key]: '' }))
      setMsgs((prev) => ({
        ...prev,
        [platform.key]: token
          ? '已保存。重启网关以连接。'
          : '令牌已移除。',
      }))
    } catch (err) {
      setMsgs((prev) => ({
        ...prev,
        [platform.key]: err instanceof Error ? err.message : '保存失败',
      }))
    }
    setSaving((prev) => ({ ...prev, [platform.key]: false }))
  }

  const saveAllowedUsers = async (
    platform: (typeof CHAT_PLATFORMS)[number],
  ) => {
    const value = (inputs[`${platform.key}_allowed`] || '').trim()
    setSaving((prev) => ({ ...prev, [`${platform.key}_allowed`]: true }))
    setMsgs((prev) => ({ ...prev, [`${platform.key}_allowed`]: '' }))
    try {
      const res = await fetch('/api/hermes-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          env: { [platform.allowedUsersVar]: value },
        }),
      })
      if (!res.ok) throw new Error('保存失败')
      setMsgs((prev) => ({
        ...prev,
        [`${platform.key}_allowed`]: '已保存。',
      }))
      setInputs((prev) => ({ ...prev, [`${platform.key}_allowed`]: '' }))
    } catch (err) {
      setMsgs((prev) => ({
        ...prev,
        [`${platform.key}_allowed`]: err instanceof Error ? err.message : '失败',
      }))
    }
    setSaving((prev) => ({ ...prev, [`${platform.key}_allowed`]: false }))
  }

  return (
    <SettingsSection
      title="消息平台"
      description="将 Hermes 连接到聊天平台。令牌保存到 ~/.hermes/.env，使用 hermes --gateway 重启网关后生效。"
      icon={MessageMultiple01Icon}
    >
      {CHAT_PLATFORMS.map((platform) => (
        <div key={platform.key} className="flex flex-col gap-3 border-t border-[var(--theme-border)] pt-4 first:border-0 first:pt-0">
          <p className="text-sm font-semibold text-[var(--theme-text)]">
            {platform.label}
            {envStatus[platform.key] && (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                已配置
              </span>
            )}
          </p>
          <p className="text-xs text-[var(--theme-muted)]">{platform.hint}</p>

          {/* Token field */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--theme-text)]">
              {platform.key === 'signal' ? 'HTTP URL' : '机器人令牌'}
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={inputs[platform.key] || ''}
                onChange={(e) => setInput(platform.key, e.target.value)}
                placeholder={platform.placeholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveToken(platform)
                }}
                className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 font-mono text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              />
              <button
                type="button"
                onClick={() => void saveToken(platform)}
                disabled={saving[platform.key]}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: 'var(--theme-accent)' }}
              >
                {saving[platform.key] ? '保存中…' : '保存'}
              </button>
              {envStatus[platform.key] && (
                <button
                  type="button"
                  onClick={() => {
                    setInputs((prev) => ({ ...prev, [platform.key]: ' ' }))
                    void saveToken({ ...platform })
                  }}
                  disabled={saving[platform.key]}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  移除
                </button>
              )}
            </div>
            {msgs[platform.key] && (
              <p className="text-xs text-[var(--theme-muted)]">
                {msgs[platform.key]}
              </p>
            )}
          </div>

          {/* Allowed users / account field */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--theme-text)]">
              {platform.key === 'signal' ? 'Signal 账号' : '允许的用户'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputs[`${platform.key}_allowed`] || ''}
                onChange={(e) =>
                  setInput(`${platform.key}_allowed`, e.target.value)
                }
                placeholder={platform.allowedUsersPlaceholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveAllowedUsers(platform)
                }}
                className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 font-mono text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              />
              <button
                type="button"
                onClick={() => void saveAllowedUsers(platform)}
                disabled={saving[`${platform.key}_allowed`]}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: 'var(--theme-accent)' }}
              >
                {saving[`${platform.key}_allowed`] ? '保存中…' : '保存'}
              </button>
            </div>
            {msgs[`${platform.key}_allowed`] && (
              <p className="text-xs text-[var(--theme-muted)]">
                {msgs[`${platform.key}_allowed`]}
              </p>
            )}
          </div>
        </div>
      ))}
    </SettingsSection>
  )
}

// ── Profile Section ─────────────────────────────────────────────────────

const PROFILE_IMAGE_MAX_DIMENSION = 128
const PROFILE_IMAGE_MAX_FILE_SIZE = 10 * 1024 * 1024

function _ProfileSection() {
  const { settings: chatSettings, updateSettings: updateChatSettings } =
    useChatSettingsStore()
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileProcessing, setProfileProcessing] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const displayName = getChatProfileDisplayName(chatSettings.displayName)

  function handleNameChange(value: string) {
    if (value.length > 50) {
      setNameError('显示名称过长（最多 50 个字符）')
      return
    }
    setNameError(null)
    updateChatSettings({ displayName: value })
  }

  async function handleAvatarUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setProfileError('不支持的文件类型。')
      return
    }
    if (file.size > PROFILE_IMAGE_MAX_FILE_SIZE) {
      setProfileError('图片过大（最大 10MB）。')
      return
    }
    setProfileError(null)
    setProfileProcessing(true)
    try {
      const url = URL.createObjectURL(file)
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = () => reject(new Error('图片加载失败'))
        i.src = url
      })
      const max = PROFILE_IMAGE_MAX_DIMENSION
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      updateChatSettings({ avatarDataUrl: canvas.toDataURL(outputType, 0.82) })
    } catch {
      setProfileError('图片处理失败。')
    } finally {
      setProfileProcessing(false)
    }
  }

  return (
    <SettingsSection
      title="个人资料"
      description="你在会话中使用的显示名称与头像。"
      icon={UserIcon}
    >
      <div className="flex items-center gap-4">
        <UserAvatar
          size={56}
          src={chatSettings.avatarDataUrl}
          alt={displayName}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--theme-text)]">{displayName}</p>
          <p className="text-xs text-[var(--theme-muted)]">
            显示在侧边栏和会话消息中。
          </p>
        </div>
      </div>
      <SettingsRow label="显示名称" description="留空则使用默认值。">
        <div className="w-full md:max-w-xs">
          <Input
            value={chatSettings.displayName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="用户"
            className="h-9 w-full"
            maxLength={50}
            aria-label="显示名称"
            aria-invalid={!!nameError}
            aria-describedby={nameError ? 'profile-name-error' : undefined}
          />
          {nameError && (
            <p
              id="profile-name-error"
              className="mt-1 text-xs text-red-600"
              role="alert"
            >
              {nameError}
            </p>
          )}
        </div>
      </SettingsRow>
      <SettingsRow
        label="头像"
        description="调整为 128×128，保存在本地。"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={profileProcessing}
                aria-label="上传头像"
                className="block w-full cursor-pointer text-xs text-[var(--theme-text)] dark:text-gray-300 md:max-w-xs file:mr-2 file:cursor-pointer file:rounded-md file:border file:border-[var(--theme-border)] dark:file:border-gray-600 file:bg-[var(--theme-panel)] dark:file:bg-gray-700 file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-[var(--theme-text)] dark:file:text-gray-100 file:transition-colors hover:file:bg-[var(--theme-hover)] dark:hover:file:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateChatSettings({ avatarDataUrl: null })}
              disabled={!chatSettings.avatarDataUrl || profileProcessing}
            >
              移除
            </Button>
          </div>
          {profileError && (
            <p className="text-xs text-red-600" role="alert">
              {profileError}
            </p>
          )}
        </div>
      </SettingsRow>
    </SettingsSection>
  )
}

// ── Chat Display Section ────────────────────────────────────────────────

function ChatDisplaySection() {
  const { settings: chatSettings, updateSettings: updateChatSettings } =
    useChatSettingsStore()
  const { settings, updateSettings } = useSettings()

  return (
    <>
      <SettingsSection
        title="会话显示"
        description="控制会话消息中显示的内容。"
        icon={MessageMultiple01Icon}
      >
        <SettingsRow
          label="显示工具消息"
          description="当智能体使用工具时，显示工具调用详情。"
        >
          <Switch
            checked={chatSettings.showToolMessages}
            onCheckedChange={(checked) =>
              updateChatSettings({ showToolMessages: checked })
            }
            aria-label="显示工具消息"
          />
        </SettingsRow>
        <SettingsRow
          label="显示推理块"
          description="展示模型的思考与推理过程。"
        >
          <Switch
            checked={chatSettings.showReasoningBlocks}
            onCheckedChange={(checked) =>
              updateChatSettings({ showReasoningBlocks: checked })
            }
            aria-label="显示推理块"
          />
        </SettingsRow>
      </SettingsSection>
      {/* Mobile Navigation removed — not relevant for Hermes Studio */}
    </>
  )
}

// ── Loader Style Section ────────────────────────────────────────────────

type LoaderStyleOption = { value: LoaderStyle; label: string }

const LOADER_STYLES: Array<LoaderStyleOption> = [
  { value: 'dots', label: '圆点' },
  { value: 'braille-hermes', label: 'Hermes' },
  { value: 'braille-orbit', label: '轨道' },
  { value: 'braille-breathe', label: '呼吸' },
  { value: 'braille-pulse', label: '脉冲' },
  { value: 'braille-wave', label: '波浪' },
  { value: 'lobster', label: 'Lobster' },
  { value: 'logo', label: '标志' },
]

function getPreset(style: LoaderStyle): BrailleSpinnerPreset | null {
  const map: Record<string, BrailleSpinnerPreset> = {
    'braille-hermes': 'hermes',
    'braille-orbit': 'orbit',
    'braille-breathe': 'breathe',
    'braille-pulse': 'pulse',
    'braille-wave': 'wave',
  }
  return map[style] ?? null
}

function LoaderPreview({ style }: { style: LoaderStyle }) {
  if (style === 'dots') return <ThreeDotsSpinner />
  if (style === 'lobster') return <LobsterIcon size={16} className="animate-pulse" />
  if (style === 'logo') return <LogoLoader />
  const preset = getPreset(style)
  return preset ? (
    <BrailleSpinner
      preset={preset}
      size={16}
      speed={120}
      className="text-[var(--theme-muted)]"
    />
  ) : (
    <ThreeDotsSpinner />
  )
}

function _LoaderStyleSection() {
  const { settings: chatSettings, updateSettings: updateChatSettings } =
    useChatSettingsStore()

  return (
    <SettingsSection
      title="加载动画"
      description="选择助手流式输出时显示的动画样式。"
      icon={Settings02Icon}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LOADER_STYLES.map((option) => {
          const active = chatSettings.loaderStyle === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => updateChatSettings({ loaderStyle: option.value })}
              className={cn(
                'flex min-h-16 flex-col items-center justify-center gap-2 rounded-xl border px-2 py-2 transition-colors',
                active
                  ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-subtle)] text-[var(--theme-text)]'
                  : 'border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text)] hover:bg-[var(--theme-panel)]',
              )}
              aria-pressed={active}
            >
              <span className="flex h-5 items-center justify-center">
                <LoaderPreview style={option.value} />
              </span>
              <span className="text-[11px] font-medium text-center leading-4">
                {option.label}
              </span>
            </button>
          )
        })}
      </div>
    </SettingsSection>
  )
}

// ── Hermes Agent Configuration ──────────────────────────────────────

type HermesProvider = {
  id: string
  name: string
  authType: string
  envKeys: Array<string>
  configured: boolean
  maskedKeys: Record<string, string>
}

type HermesConfigData = {
  config: Record<string, unknown>
  providers: Array<HermesProvider>
  activeProvider: string
  activeModel: string
  hermesHome: string
}

const HERMES_API = process.env.HERMES_API_URL || 'http://127.0.0.1:8642'

type AvailableModelsResponse = {
  provider: string
  models: Array<{ id: string; description: string }>
  providers: Array<{ id: string; label: string; authenticated: boolean }>
}

const KNOWN_PLATFORMS = [
  'telegram', 'discord', 'slack', 'whatsapp', 'signal',
  'homeassistant', 'mattermost', 'matrix', 'bluebubbles',
  'sms', 'email', 'webhook', 'cli',
]

function AddPlatformOverride({
  existing,
  onAdd,
}: {
  existing: Array<string>
  onAdd: (platform: string) => void
}) {
  const [selected, setSelected] = useState('')
  const available = KNOWN_PLATFORMS.filter((p) => !existing.includes(p))
  if (available.length === 0) return null
  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1 text-xs text-[var(--theme-text)] focus:outline-none"
      >
        <option value="">添加平台…</option>
        {available.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      {selected && (
        <button
          onClick={() => { onAdd(selected); setSelected('') }}
          className="rounded px-2 py-0.5 text-xs font-medium transition-colors hover:bg-[var(--theme-hover)]"
          style={{ color: 'var(--theme-accent)' }}
        >
          添加
        </button>
      )}
    </div>
  )
}

function HermesConfigSection({
  activeView = 'hermes',
}: {
  activeView?: 'hermes' | 'agent' | 'permissions' | 'routing' | 'voice' | 'display'
}) {
  const [data, setData] = useState<HermesConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [modelInput, setModelInput] = useState('')
  const [providerInput, setProviderInput] = useState('')
  const [baseUrlInput, setBaseUrlInput] = useState('')
  const [newToolset, setNewToolset] = useState('')
  const [newAllowlistCmd, setNewAllowlistCmd] = useState('')
  const [newBlocklistDomain, setNewBlocklistDomain] = useState('')
  const [newQcKey, setNewQcKey] = useState('')
  const [newQcVal, setNewQcVal] = useState('')

  const [availableProviders, setAvailableProviders] = useState<
    Array<{ id: string; label: string; authenticated: boolean }>
  >([])
  const [availableModels, setAvailableModels] = useState<
    Array<{ id: string; description: string }>
  >([])
  const [loadingModels, setLoadingModels] = useState(false)

  const syncInputsFromData = useCallback((configData: HermesConfigData) => {
    setModelInput(configData.activeModel || '')
    setProviderInput(configData.activeProvider || '')
    setBaseUrlInput((configData.config?.base_url as string) || '')
  }, [])

  const fetchConfig = useCallback(async () => {
    const res = await fetch('/api/hermes-config')
    const configData = (await res.json()) as HermesConfigData
    setData(configData)
    syncInputsFromData(configData)
    return configData
  }, [syncInputsFromData])

  const fetchModelsForProvider = useCallback(async (provider: string) => {
    if (!provider) {
      setAvailableModels([])
      return
    }
    setLoadingModels(true)
    try {
      const res = await fetch(
        `/api/hermes-proxy/api/available-models?provider=${encodeURIComponent(provider)}`,
      )
      if (res.ok) {
        const result = (await res.json()) as AvailableModelsResponse
        setAvailableModels(result.models || [])
        if (result.providers?.length) setAvailableProviders(result.providers)
      }
    } catch {
      // ignore
    }
    setLoadingModels(false)
  }, [])

  useEffect(() => {
    fetchConfig()
      .then((configData) => {
        setLoading(false)
        if (configData.activeProvider) {
          void fetchModelsForProvider(configData.activeProvider)
        }
      })
      .catch(() => setLoading(false))
  }, [fetchConfig, fetchModelsForProvider])

  const saveConfig = async (updates: {
    config?: Record<string, unknown>
    env?: Record<string, string>
  }) => {
    setSaving(true)
    setSaveMessage(null)
    try {
      const res = await fetch('/api/hermes-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const result = (await res.json()) as { message?: string }
      setSaveMessage(result.message || '已保存')
      const refreshData = await fetchConfig()
      if (refreshData.activeProvider) {
        void fetchModelsForProvider(refreshData.activeProvider)
      }
      setTimeout(() => setSaveMessage(null), 3000)
    } catch {
      setSaveMessage('保存失败')
    }
    setSaving(false)
  }

  const selectClassName =
    'h-9 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 text-sm text-[var(--theme-text)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-400 md:max-w-sm'

  const readNumber = (value: unknown, fallback: number) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const readBoolean = (value: unknown, fallback: boolean) => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') return value === 'true'
    return fallback
  }

  const saveNumberField = (
    section: string,
    field: string,
    rawValue: string,
    fallback: number,
  ) => {
    const value = rawValue === '' ? fallback : Number(rawValue)
    if (!Number.isFinite(value)) return
    void saveConfig({ config: { [section]: { [field]: value } } })
  }

  if (loading) {
    return (
      <SettingsSection
        title="Hermes 智能体"
        description="正在加载配置..."
        icon={Settings02Icon}
      >
        <div
          className="h-20 animate-pulse rounded-lg"
          style={{ backgroundColor: 'var(--theme-panel)' }}
        />
      </SettingsSection>
    )
  }

  if (!data) {
    return (
      <SettingsSection
        title="Hermes 智能体"
        description="无法加载 Hermes 配置。"
        icon={Settings02Icon}
      >
        <p className="text-sm" style={{ color: 'var(--theme-muted)' }}>
          请确保 Hermes 智能体运行在 localhost:8642
        </p>
      </SettingsSection>
    )
  }

  const memoryConfig = (data.config.memory as Record<string, unknown>) || {}
  const terminalConfig = (data.config.terminal as Record<string, unknown>) || {}
  const displayConfig = (data.config.display as Record<string, unknown>) || {}
  const agentConfig = (data.config.agent as Record<string, unknown>) || {}
  const smartRouting =
    (data.config.smart_model_routing as Record<string, unknown>) || {}
  const ttsConfig = (data.config.tts as Record<string, unknown>) || {}
  const sttConfig = (data.config.stt as Record<string, unknown>) || {}
  const customProviders = Array.isArray(data.config.custom_providers)
    ? (data.config.custom_providers as Array<Record<string, unknown>>)
    : []
  const securityConfig = (data.config.security as Record<string, unknown>) || {}
  const websiteBlocklist =
    (securityConfig.website_blocklist as Record<string, unknown>) || {}
  const approvalsConfig =
    (data.config.approvals as Record<string, unknown>) || {}
  const codeExecConfig =
    (data.config.code_execution as Record<string, unknown>) || {}
  const toolsets = Array.isArray(data.config.toolsets)
    ? (data.config.toolsets as Array<string>)
    : []
  const commandAllowlist = Array.isArray(data.config.command_allowlist)
    ? (data.config.command_allowlist as Array<string>)
    : []
  const blocklistDomains = Array.isArray(websiteBlocklist.domains)
    ? (websiteBlocklist.domains as Array<string>)
    : []
  const quickCommands =
    data.config.quick_commands &&
    typeof data.config.quick_commands === 'object' &&
    !Array.isArray(data.config.quick_commands)
      ? (data.config.quick_commands as Record<string, string>)
      : {}

  const sessionResetConfig =
    (data.config.session_reset as Record<string, unknown>) || {}
  const platformOverrides =
    displayConfig.platforms &&
    typeof displayConfig.platforms === 'object' &&
    !Array.isArray(displayConfig.platforms)
      ? (displayConfig.platforms as Record<string, Record<string, string>>)
      : {}

  const ttsProvider = (ttsConfig.provider as string) || 'edge'
  const ttsEdge = (ttsConfig.edge as Record<string, unknown>) || {}
  const ttsElevenLabs = (ttsConfig.elevenlabs as Record<string, unknown>) || {}
  const ttsOpenAi = (ttsConfig.openai as Record<string, unknown>) || {}
  const sttProvider = (sttConfig.provider as string) || 'local'
  const sttLocal = (sttConfig.local as Record<string, unknown>) || {}

  const renderHermesOverview = () => (
    <>
      <SettingsSection
        title="模型与服务提供方"
        description="为 Hermes 智能体配置默认 AI 模型。"
        icon={SourceCodeSquareIcon}
      >
        <SettingsRow
          label="服务提供方"
          description="选择推理服务提供方。"
        >
          <div className="flex w-full max-w-sm gap-2">
            {availableProviders.length > 0 ? (
              <select
                value={providerInput}
                onChange={(e) => {
                  const newProvider = e.target.value
                  setProviderInput(newProvider)
                  setModelInput('')
                  void fetchModelsForProvider(newProvider)
                }}
                className={selectClassName}
              >
                {availableProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}{' '}
                    {p.authenticated ? <EmojiIcon emoji="✓" size={12} /> : null}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={providerInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setProviderInput(e.target.value)
                }
                placeholder="例如：ollama、anthropic、openai-codex"
                className="flex-1"
              />
            )}
          </div>
        </SettingsRow>
        <SettingsRow
          label="模型"
          description="Hermes 用于会话的模型。"
        >
          <div className="flex w-full max-w-sm gap-2">
            {availableModels.length > 0 ? (
              <select
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                className={`${selectClassName} font-mono`}
              >
                {!availableModels.some((m) => m.id === modelInput) &&
                  modelInput && (
                    <option value={modelInput}>{modelInput}（当前）</option>
                  )}
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                    {m.description ? ` — ${m.description}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={modelInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setModelInput(e.target.value)
                }
                placeholder={
                  loadingModels ? '正在加载模型...' : '例如：qwen3.5:35b'
                }
                className="flex-1 font-mono"
              />
            )}
          </div>
        </SettingsRow>
        <SettingsRow
          label="Base URL"
          description="用于本地服务提供方（Ollama、LM Studio、MLX）。云端留空。"
        >
          <div className="flex w-full max-w-sm gap-2">
            <Input
              value={baseUrlInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setBaseUrlInput(e.target.value)
              }
              placeholder="例如：http://localhost:11434/v1"
              className="flex-1 font-mono text-sm"
            />
          </div>
        </SettingsRow>
        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            disabled={saving}
            onClick={() => {
              const configUpdate: Record<string, unknown> = {
                model: modelInput.trim(),
                provider: providerInput.trim(),
                base_url: baseUrlInput.trim() || null,
              }
              void saveConfig({ config: configUpdate })
            }}
          >
            {saving ? '保存中…' : '保存模型'}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="API 密钥"
        description="管理保存在 ~/.hermes/.env 中的服务提供方 API 密钥"
        icon={CloudIcon}
      >
        {data.providers
          .filter((p) => p.envKeys.length > 0)
          .map((provider) => (
            <SettingsRow
              key={provider.id}
              label={provider.name}
              description={
                provider.configured ? (
                  <>
                    <EmojiIcon emoji="✅" size={12} /> 已配置
                  </>
                ) : (
                  <>
                    <EmojiIcon emoji="❌" size={12} /> 未配置
                  </>
                )
              }
            >
              <div className="flex w-full max-w-sm items-center gap-2">
                {provider.envKeys.map((envKey) => (
                  <div key={envKey} className="flex-1">
                    {editingKey === envKey ? (
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          value={keyInput}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setKeyInput(e.target.value)
                          }
                          placeholder={`输入 ${envKey}`}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            void saveConfig({ env: { [envKey]: keyInput } })
                            setEditingKey(null)
                            setKeyInput('')
                          }}
                        >
                          保存
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingKey(null)
                            setKeyInput('')
                          }}
                        >
                          <EmojiIcon emoji="✕" size={14} />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-mono"
                          style={{ color: 'var(--theme-muted)' }}
                        >
                          {provider.maskedKeys[envKey] || '未设置'}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingKey(envKey)
                            setKeyInput('')
                          }}
                        >
                          {provider.configured ? '更改' : '添加'}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SettingsRow>
          ))}
      </SettingsSection>

      <SettingsSection
        title="记忆"
        description="配置 Hermes 智能体的记忆与用户资料。"
        icon={UserIcon}
      >
        <SettingsRow
          label="启用记忆"
          description="跨会话存储与回忆记忆。"
        >
          <Switch
            checked={memoryConfig.memory_enabled !== false}
            onCheckedChange={(checked: boolean) =>
              void saveConfig({
                config: { memory: { memory_enabled: checked } },
              })
            }
          />
        </SettingsRow>
        <SettingsRow
          label="用户资料"
          description="记住用户偏好与上下文。"
        >
          <Switch
            checked={memoryConfig.user_profile_enabled !== false}
            onCheckedChange={(checked: boolean) =>
              void saveConfig({
                config: { memory: { user_profile_enabled: checked } },
              })
            }
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="终端"
        description="Shell 执行设置。"
        icon={SourceCodeSquareIcon}
      >
        <SettingsRow label="后端" description="终端执行后端。">
          <span
            className="text-sm font-mono"
            style={{ color: 'var(--theme-muted)' }}
          >
            {(terminalConfig.backend as string) || 'local'}
          </span>
        </SettingsRow>
        <SettingsRow
          label="超时"
          description="终端命令的最大秒数。"
        >
          <Input
            type="number"
            min={10}
            value={readNumber(terminalConfig.timeout, 180)}
            onChange={(e) =>
              saveNumberField('terminal', 'timeout', e.target.value, 180)
            }
            className="md:w-28"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="自定义服务提供方"
        description="从 config.yaml 读取的只读提供方详情。"
        icon={CloudIcon}
      >
        <div className="space-y-3">
          {customProviders.length === 0 ? (
            <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/40 p-3 text-sm text-[var(--theme-muted)]">
              未配置自定义服务提供方。
            </div>
          ) : (
            customProviders.map((provider, index) => (
              <div
                key={`${String(provider.name || provider.base_url || index)}`}
                className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/40 p-3"
              >
                <div className="grid gap-2 text-sm md:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--theme-muted)]">
                      名称
                    </p>
                    <p className="font-medium text-[var(--theme-text)]">
                      {String(provider.name || '未命名')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--theme-muted)]">
                      Base URL
                    </p>
                    <p className="font-mono text-xs text-[var(--theme-text)] break-all">
                      {String(provider.base_url || '未设置')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--theme-muted)]">
                      类型
                    </p>
                    <p className="text-[var(--theme-text)]">
                      {String(provider.type || provider.auth_type || '未知')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
          <div className="flex flex-col gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/40 p-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-[var(--theme-muted)]">
              出于安全考虑，请在 config.yaml 中编辑自定义服务提供方。
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void navigator.clipboard?.writeText(data.hermesHome)
              }
            >
              复制配置路径
            </Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="关于"
        description="Hermes 智能体运行时信息。"
        icon={Notification03Icon}
      >
        <SettingsRow
          label="配置位置"
          description="Hermes 存储配置的位置。"
        >
          <span
            className="text-xs font-mono"
            style={{ color: 'var(--theme-muted)' }}
          >
            {data.hermesHome}
          </span>
        </SettingsRow>
        <SettingsRow
          label="当前服务提供方"
          description="当前推理服务提供方。"
        >
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--theme-accent)' }}
          >
            {data.providers.find((p) => p.id === data.activeProvider)?.name ||
              data.activeProvider}
          </span>
        </SettingsRow>
      </SettingsSection>
    </>
  )

  const renderAgentBehavior = () => (
    <SettingsSection
      title="智能体行为"
      description="控制智能体的执行限制与工具访问。"
      icon={Settings02Icon}
    >
      <SettingsRow
        label="最大轮数"
        description="每个请求的最大智能体轮数（1-100）。"
      >
        <Input
          type="number"
          min={1}
          max={100}
          value={readNumber(agentConfig.max_turns, 50)}
          onChange={(e) =>
            saveNumberField('agent', 'max_turns', e.target.value, 50)
          }
          className="md:w-28"
        />
      </SettingsRow>
      <SettingsRow
        label="网关超时"
        description="网关判定请求超时前等待的秒数。"
      >
        <Input
          type="number"
          min={10}
          max={600}
          value={readNumber(agentConfig.gateway_timeout, 120)}
          onChange={(e) =>
            saveNumberField('agent', 'gateway_timeout', e.target.value, 120)
          }
          className="md:w-28"
        />
      </SettingsRow>
      <SettingsRow
        label="强制使用工具"
        description="智能体在可用时是否必须使用工具。"
      >
        <select
          value={(agentConfig.tool_use_enforcement as string) || 'auto'}
          onChange={(e) =>
            void saveConfig({
              config: { agent: { tool_use_enforcement: e.target.value } },
            })
          }
          className={selectClassName}
        >
          <option value="auto">自动</option>
          <option value="required">必需</option>
          <option value="none">无</option>
        </select>
      </SettingsRow>
      <SettingsRow
        label="会话重置模式"
        description="何时自动清除会话上下文。"
      >
        <select
          value={(sessionResetConfig.mode as string) || 'both'}
          onChange={(e) =>
            void saveConfig({
              config: { session_reset: { mode: e.target.value } },
            })
          }
          className={selectClassName}
        >
          <option value="none">从不</option>
          <option value="daily">每天（按小时）</option>
          <option value="idle">空闲超时</option>
          <option value="both">两者</option>
        </select>
      </SettingsRow>
      {['daily', 'both'].includes(
        (sessionResetConfig.mode as string) || 'both',
      ) && (
        <SettingsRow
          label="重置时间点"
          description="每日会话重置的小时（0–23，本地时间）。"
        >
          <Input
            type="number"
            min={0}
            max={23}
            value={readNumber(sessionResetConfig.at_hour, 4)}
            onChange={(e) =>
              saveNumberField('session_reset', 'at_hour', e.target.value, 4)
            }
            className="md:w-24"
          />
        </SettingsRow>
      )}
      {['idle', 'both'].includes(
        (sessionResetConfig.mode as string) || 'both',
      ) && (
        <SettingsRow
          label="空闲超时"
          description="会话重置前的空闲分钟数。"
        >
          <Input
            type="number"
            min={1}
            value={readNumber(sessionResetConfig.idle_minutes, 1440)}
            onChange={(e) =>
              saveNumberField(
                'session_reset',
                'idle_minutes',
                e.target.value,
                1440,
              )
            }
            className="md:w-28"
          />
        </SettingsRow>
      )}
    </SettingsSection>
  )

  const renderPermissions = () => {
    const removeToolset = (ts: string) => {
      void saveConfig({ config: { toolsets: toolsets.filter((t) => t !== ts) } })
    }

    const addToolset = () => {
      const trimmed = newToolset.trim()
      if (!trimmed || toolsets.includes(trimmed)) return
      void saveConfig({ config: { toolsets: [...toolsets, trimmed] } })
      setNewToolset('')
    }

    return (
      <>
        <SettingsSection
          title="审批"
          description="控制 Hermes 如何为危险操作请求审批。"
          icon={LockIcon}
        >
          <SettingsRow
            label="审批模式"
            description="manual = 提示用户；auto = 自动批准；off = 跳过审批检查。"
          >
            <select
              value={(approvalsConfig.mode as string) || 'manual'}
              onChange={(e) =>
                void saveConfig({
                  config: { approvals: { mode: e.target.value } },
                })
              }
              className={selectClassName}
            >
              <option value="manual">手动</option>
              <option value="auto">自动</option>
              <option value="off">关闭</option>
            </select>
          </SettingsRow>
          <SettingsRow
            label="审批超时（秒）"
            description="自动拒绝前等待用户响应的秒数。"
          >
            <Input
              type="number"
              min={5}
              max={600}
              value={readNumber(approvalsConfig.timeout, 60)}
              onChange={(e) =>
                saveNumberField('approvals', 'timeout', e.target.value, 60)
              }
              className="md:w-28"
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection
          title="工具集"
          description="智能体可用的工具集合。更改在网关重启后生效。"
          icon={LockIcon}
        >
          <SettingsRow
            label="启用的工具集"
            description="移除工具集以撤销对该工具组的访问权限。"
          >
            <div className="flex w-full flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {toolsets.length === 0 ? (
                  <span className="text-xs text-[var(--theme-muted)]">
                    未配置工具集
                  </span>
                ) : (
                  toolsets.map((ts) => (
                    <span
                      key={ts}
                      className="flex items-center gap-1 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-2.5 py-1 text-xs font-medium text-[var(--theme-text)]"
                    >
                      {ts}
                      <button
                        type="button"
                        onClick={() => removeToolset(ts)}
                        className="ml-0.5 text-[var(--theme-muted)] hover:text-[var(--theme-danger)] transition-colors"
                        aria-label={`移除 ${ts}`}
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={newToolset}
                  onChange={(e) => setNewToolset(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addToolset()
                    }
                  }}
                  placeholder="hermes-web, hermes-memory…"
                  className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)] md:max-w-xs"
                />
                <button
                  type="button"
                  onClick={addToolset}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: 'var(--theme-accent)' }}
                  disabled={!newToolset.trim()}
                >
                  添加
                </button>
              </div>
            </div>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection
          title="安全"
          description="Tirith 安全扫描器与密钥脱敏设置。"
          icon={LockIcon}
        >
          <SettingsRow
            label="脱敏密钥"
            description="自动从智能体记忆和日志中脱敏 API 密钥与令牌。"
          >
            <Switch
              checked={readBoolean(securityConfig.redact_secrets, true)}
              onCheckedChange={(checked) =>
                void saveConfig({
                  config: { security: { redact_secrets: checked } },
                })
              }
            />
          </SettingsRow>
          <SettingsRow
            label="Tirith 安全扫描器"
            description="使用 Tirith 策略引擎阻止危险命令。"
          >
            <Switch
              checked={readBoolean(securityConfig.tirith_enabled, true)}
              onCheckedChange={(checked) =>
                void saveConfig({
                  config: { security: { tirith_enabled: checked } },
                })
              }
            />
          </SettingsRow>
          <SettingsRow
            label="网站阻止列表"
            description="阻止智能体浏览被禁域名。"
          >
            <Switch
              checked={readBoolean(websiteBlocklist.enabled, false)}
              onCheckedChange={(checked) =>
                void saveConfig({
                  config: {
                    security: { website_blocklist: { enabled: checked } },
                  },
                })
              }
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection
          title="代码执行"
          description="应用于沙箱代码与工具执行的限制。"
          icon={LockIcon}
        >
          <SettingsRow
            label="执行超时（秒）"
            description="单个代码执行块的最大秒数。"
          >
            <Input
              type="number"
              min={10}
              max={3600}
              value={readNumber(codeExecConfig.timeout, 300)}
              onChange={(e) =>
                saveNumberField('code_execution', 'timeout', e.target.value, 300)
              }
              className="md:w-28"
            />
          </SettingsRow>
          <SettingsRow
            label="每轮最大工具调用次数"
            description="每轮智能体工具调用的硬性上限。"
          >
            <Input
              type="number"
              min={1}
              max={500}
              value={readNumber(codeExecConfig.max_tool_calls, 50)}
              onChange={(e) =>
                saveNumberField(
                  'code_execution',
                  'max_tool_calls',
                  e.target.value,
                  50,
                )
              }
              className="md:w-28"
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection
          title="智能体推理"
          description="推理强度与详细程度控制。"
          icon={LockIcon}
        >
          <SettingsRow
            label="推理强度"
            description="智能体在回复前用于思考的时间。"
          >
            <select
              value={(agentConfig.reasoning_effort as string) || 'medium'}
              onChange={(e) =>
                void saveConfig({
                  config: { agent: { reasoning_effort: e.target.value } },
                })
              }
              className={selectClassName}
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </SettingsRow>
          <SettingsRow
            label="详细模式"
            description="显示详细的工具输出与智能体内部步骤。"
          >
            <Switch
              checked={readBoolean(agentConfig.verbose, false)}
              onCheckedChange={(checked) =>
                void saveConfig({ config: { agent: { verbose: checked } } })
              }
            />
          </SettingsRow>
        </SettingsSection>

        {/* ── Command Allowlist ──────────────────────────────────── */}
        <SettingsSection
          title="命令白名单"
          description="绕过 Tirith 安全扫描器且永不要求审批的 Shell 命令。"
          icon={LockIcon}
        >
          <SettingsRow
            label="允许的命令"
            description="添加准确的命令名称（例如 git、npm）。不支持通配符。"
          >
            <div className="flex w-full flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {commandAllowlist.length === 0 ? (
                  <span className="text-xs text-[var(--theme-muted)]">尚未添加白名单命令</span>
                ) : (
                  commandAllowlist.map((cmd) => (
                    <span
                      key={cmd}
                      className="flex items-center gap-1 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-2.5 py-1 font-mono text-xs font-medium text-[var(--theme-text)]"
                    >
                      {cmd}
                      <button
                        type="button"
                        onClick={() =>
                          void saveConfig({
                            config: {
                              command_allowlist: commandAllowlist.filter(
                                (c) => c !== cmd,
                              ),
                            },
                          })
                        }
                        className="ml-0.5 text-[var(--theme-muted)] hover:text-[var(--theme-danger)] transition-colors"
                        aria-label={`移除 ${cmd}`}
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={newAllowlistCmd}
                  onChange={(e) => setNewAllowlistCmd(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const trimmed = newAllowlistCmd.trim()
                      if (!trimmed || commandAllowlist.includes(trimmed)) return
                      void saveConfig({
                        config: {
                          command_allowlist: [...commandAllowlist, trimmed],
                        },
                      })
                      setNewAllowlistCmd('')
                    }
                  }}
                  placeholder="git, npm, make…"
                  className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 font-mono text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)] md:max-w-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = newAllowlistCmd.trim()
                    if (!trimmed || commandAllowlist.includes(trimmed)) return
                    void saveConfig({
                      config: {
                        command_allowlist: [...commandAllowlist, trimmed],
                      },
                    })
                    setNewAllowlistCmd('')
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: 'var(--theme-accent)' }}
                  disabled={!newAllowlistCmd.trim()}
                >
                  添加
                </button>
              </div>
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* ── Website Blocklist Domains ──────────────────────────── */}
        {readBoolean(websiteBlocklist.enabled, false) && (
          <SettingsSection
            title="阻止的域名"
            description="智能体无法访问的域名。由于上方已启用网站阻止列表，此功能生效中。"
            icon={LockIcon}
          >
            <SettingsRow
              label="阻止的域名"
              description="每个条目输入一个域名（例如 example.com）。包含子域名。"
            >
              <div className="flex w-full flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {blocklistDomains.length === 0 ? (
                    <span className="text-xs text-[var(--theme-muted)]">
                      尚未阻止任何域名
                    </span>
                  ) : (
                    blocklistDomains.map((domain) => (
                      <span
                        key={domain}
                        className="flex items-center gap-1 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-2.5 py-1 font-mono text-xs font-medium text-[var(--theme-text)]"
                      >
                        {domain}
                        <button
                          type="button"
                          onClick={() =>
                            void saveConfig({
                              config: {
                                security: {
                                  website_blocklist: {
                                    domains: blocklistDomains.filter(
                                      (d) => d !== domain,
                                    ),
                                  },
                                },
                              },
                            })
                          }
                          className="ml-0.5 text-[var(--theme-muted)] hover:text-[var(--theme-danger)] transition-colors"
                          aria-label={`移除 ${domain}`}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newBlocklistDomain}
                    onChange={(e) => setNewBlocklistDomain(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const trimmed = newBlocklistDomain.trim().toLowerCase()
                        if (!trimmed || blocklistDomains.includes(trimmed)) return
                        void saveConfig({
                          config: {
                            security: {
                              website_blocklist: {
                                domains: [...blocklistDomains, trimmed],
                              },
                            },
                          },
                        })
                        setNewBlocklistDomain('')
                      }
                    }}
                    placeholder="example.com"
                    className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 font-mono text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)] md:max-w-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = newBlocklistDomain.trim().toLowerCase()
                      if (!trimmed || blocklistDomains.includes(trimmed)) return
                      void saveConfig({
                        config: {
                          security: {
                            website_blocklist: {
                              domains: [...blocklistDomains, trimmed],
                            },
                          },
                        },
                      })
                      setNewBlocklistDomain('')
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ background: 'var(--theme-accent)' }}
                    disabled={!newBlocklistDomain.trim()}
                  >
                    添加
                  </button>
                </div>
              </div>
            </SettingsRow>
          </SettingsSection>
        )}

        {/* ── Quick Commands ─────────────────────────────────────── */}
        <SettingsSection
          title="快捷命令"
          description="自定义斜杠命令快捷方式。在会话中输入 /key 即可展开为完整内容。"
          icon={LockIcon}
        >
          <SettingsRow
            label="快捷方式"
            description="键：斜杠命令名称（不带斜杠）。值：展开后的文本。"
          >
            <div className="flex w-full flex-col gap-2">
              {Object.keys(quickCommands).length === 0 ? (
                <span className="text-xs text-[var(--theme-muted)]">
                  未配置快捷命令
                </span>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {Object.entries(quickCommands).map(([key, val]) => (
                    <div
                      key={key}
                      className="flex items-start gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-xs"
                    >
                      <span className="shrink-0 font-mono font-semibold text-[var(--theme-accent)]">
                        /{key}
                      </span>
                      <span className="min-w-0 flex-1 break-words text-[var(--theme-text)]">
                        {val}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = { ...quickCommands }
                          delete next[key]
                          void saveConfig({ config: { quick_commands: next } })
                        }}
                        className="shrink-0 text-[var(--theme-muted)] hover:text-[var(--theme-danger)] transition-colors"
                        aria-label={`移除 /${key}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* Add new quick command */}
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex gap-2">
                  <input
                    value={newQcKey}
                    onChange={(e) =>
                      setNewQcKey(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))
                    }
                    placeholder="键名"
                    className="w-28 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 font-mono text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                  />
                  <input
                    value={newQcVal}
                    onChange={(e) => setNewQcVal(e.target.value)}
                    placeholder="展开文本…"
                    className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const k = newQcKey.trim()
                        const v = newQcVal.trim()
                        if (!k || !v) return
                        void saveConfig({
                          config: {
                            quick_commands: { ...quickCommands, [k]: v },
                          },
                        })
                        setNewQcKey('')
                        setNewQcVal('')
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const k = newQcKey.trim()
                      const v = newQcVal.trim()
                      if (!k || !v) return
                      void saveConfig({
                        config: {
                          quick_commands: { ...quickCommands, [k]: v },
                        },
                      })
                      setNewQcKey('')
                      setNewQcVal('')
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ background: 'var(--theme-accent)' }}
                    disabled={!newQcKey.trim() || !newQcVal.trim()}
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>
          </SettingsRow>
        </SettingsSection>
      </>
    )
  }

  const renderSmartRouting = () => (
    <SettingsSection
      title="智能模型路由"
      description="自动将简单查询路由到更便宜的模型。"
      icon={SparklesIcon}
    >
      <SettingsRow
        label="启用智能路由"
        description="自动将简单查询路由到更便宜的模型。"
      >
        <Switch
          checked={readBoolean(smartRouting.enabled, false)}
          onCheckedChange={(checked) =>
            void saveConfig({
              config: { smart_model_routing: { enabled: checked } },
            })
          }
        />
      </SettingsRow>
      <SettingsRow
        label="经济型模型"
        description="用于简单查询的模型。"
      >
        <select
          value={(smartRouting.cheap_model as string) || ''}
          onChange={(e) =>
            void saveConfig({
              config: { smart_model_routing: { cheap_model: e.target.value } },
            })
          }
          className={selectClassName}
        >
          <option value="">选择模型</option>
          {availableModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.id}
            </option>
          ))}
        </select>
      </SettingsRow>
      <SettingsRow
        label="简单查询最大字符数"
        description="短于此长度的消息使用经济型模型。"
      >
        <Input
          type="number"
          min={1}
          value={readNumber(smartRouting.max_simple_chars, 500)}
          onChange={(e) =>
            saveNumberField(
              'smart_model_routing',
              'max_simple_chars',
              e.target.value,
              500,
            )
          }
          className="md:w-32"
        />
      </SettingsRow>
      <SettingsRow
        label="简单查询最大单词数"
        description="单词数更少的消息使用经济型模型。"
      >
        <Input
          type="number"
          min={1}
          value={readNumber(smartRouting.max_simple_words, 80)}
          onChange={(e) =>
            saveNumberField(
              'smart_model_routing',
              'max_simple_words',
              e.target.value,
              80,
            )
          }
          className="md:w-32"
        />
      </SettingsRow>
    </SettingsSection>
  )

  const renderVoice = () => (
    <div className="space-y-4">
      <SettingsSection
        title="文本转语音"
        description="配置智能体回复的语音输出。"
        icon={VolumeHighIcon}
      >
        <SettingsRow
          label="TTS 服务提供方"
          description="使用哪个 TTS 引擎。"
        >
          <select
            value={ttsProvider}
            onChange={(e) =>
              void saveConfig({ config: { tts: { provider: e.target.value } } })
            }
            className={selectClassName}
          >
            <option value="edge">Edge TTS（免费）</option>
            <option value="elevenlabs">ElevenLabs</option>
            <option value="openai">OpenAI TTS</option>
            <option value="neutts">NeuTTS</option>
          </select>
        </SettingsRow>

        {ttsProvider === 'edge' && (
          <SettingsRow label="语音" description="Edge 语音名称。">
            <Input
              value={(ttsEdge.voice as string) || ''}
              onChange={(e) =>
                void saveConfig({
                  config: { tts: { edge: { voice: e.target.value } } },
                })
              }
              placeholder="en-US-AriaNeural"
              className="md:w-64"
            />
          </SettingsRow>
        )}

        {ttsProvider === 'elevenlabs' && (
          <>
            <SettingsRow label="语音 ID" description="ElevenLabs voice_id。">
              <Input
                value={(ttsElevenLabs.voice_id as string) || ''}
                onChange={(e) =>
                  void saveConfig({
                    config: {
                      tts: { elevenlabs: { voice_id: e.target.value } },
                    },
                  })
                }
                className="md:w-64"
              />
            </SettingsRow>
            <SettingsRow label="模型" description="ElevenLabs 模型名称。">
              <Input
                value={(ttsElevenLabs.model as string) || ''}
                onChange={(e) =>
                  void saveConfig({
                    config: { tts: { elevenlabs: { model: e.target.value } } },
                  })
                }
                className="md:w-64"
              />
            </SettingsRow>
          </>
        )}

        {ttsProvider === 'openai' && (
          <>
            <SettingsRow
              label="语音"
              description="alloy, echo, fable, onyx, nova, shimmer"
            >
              <select
                value={(ttsOpenAi.voice as string) || 'alloy'}
                onChange={(e) =>
                  void saveConfig({
                    config: { tts: { openai: { voice: e.target.value } } },
                  })
                }
                className={selectClassName}
              >
                {['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].map(
                  (voice) => (
                    <option key={voice} value={voice}>
                      {voice}
                    </option>
                  ),
                )}
              </select>
            </SettingsRow>
            <SettingsRow label="模型" description="OpenAI TTS 模型。">
              <Input
                value={(ttsOpenAi.model as string) || ''}
                onChange={(e) =>
                  void saveConfig({
                    config: { tts: { openai: { model: e.target.value } } },
                  })
                }
                placeholder="tts-1"
                className="md:w-64"
              />
            </SettingsRow>
          </>
        )}
      </SettingsSection>

      <SettingsSection
        title="语音转文本"
        description="配置语音输入识别。"
        icon={Mic01Icon}
      >
        <SettingsRow label="启用 STT" description="开启语音输入。">
          <Switch
            checked={readBoolean(sttConfig.enabled, false)}
            onCheckedChange={(checked) =>
              void saveConfig({ config: { stt: { enabled: checked } } })
            }
          />
        </SettingsRow>
        <SettingsRow
          label="STT 服务提供方"
          description="使用哪个语音引擎。"
        >
          <select
            value={sttProvider}
            onChange={(e) =>
              void saveConfig({ config: { stt: { provider: e.target.value } } })
            }
            className={selectClassName}
          >
            <option value="local">本地（Whisper）</option>
            <option value="openai">OpenAI Whisper API</option>
          </select>
        </SettingsRow>
        {sttProvider === 'local' && (
          <SettingsRow
            label="模型大小"
            description="tiny, base, small, medium, large"
          >
            <select
              value={(sttLocal.model_size as string) || 'base'}
              onChange={(e) =>
                void saveConfig({
                  config: { stt: { local: { model_size: e.target.value } } },
                })
              }
              className={selectClassName}
            >
              {['tiny', 'base', 'small', 'medium', 'large'].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </SettingsRow>
        )}
      </SettingsSection>
    </div>
  )

  const renderDisplay = () => (
    <SettingsSection
      title="显示"
      description="反映在智能体 UI 中的 CLI 显示偏好。"
      icon={PaintBoardIcon}
    >
      <SettingsRow label="个性" description="智能体回复风格。">
        <select
          value={(displayConfig.personality as string) || 'default'}
          onChange={(e) =>
            void saveConfig({
              config: { display: { personality: e.target.value } },
            })
          }
          className={selectClassName}
        >
          {['default', 'concise', 'verbose', 'creative'].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </SettingsRow>
      <SettingsRow
        label="流式输出"
        description="逐 token 流式输出。"
      >
        <Switch
          checked={readBoolean(displayConfig.streaming, true)}
          onCheckedChange={(checked) =>
            void saveConfig({ config: { display: { streaming: checked } } })
          }
        />
      </SettingsRow>
      <SettingsRow
        label="状态消息"
        description="运行过程中显示自然的中途助手状态消息。"
      >
        <Switch
          checked={readBoolean(displayConfig.interim_assistant_messages, true)}
          onCheckedChange={(checked) =>
            void saveConfig({
              config: { display: { interim_assistant_messages: checked } },
            })
          }
        />
      </SettingsRow>
      <SettingsRow
        label="显示推理"
        description="在 UI 中展示模型推理块。"
      >
        <Switch
          checked={readBoolean(displayConfig.show_reasoning, false)}
          onCheckedChange={(checked) =>
            void saveConfig({
              config: { display: { show_reasoning: checked } },
            })
          }
        />
      </SettingsRow>
      <SettingsRow label="显示费用" description="显示用量费用元数据。">
        <Switch
          checked={readBoolean(displayConfig.show_cost, false)}
          onCheckedChange={(checked) =>
            void saveConfig({ config: { display: { show_cost: checked } } })
          }
        />
      </SettingsRow>
      <SettingsRow label="紧凑模式" description="使用更紧凑的显示布局。">
        <Switch
          checked={readBoolean(displayConfig.compact, false)}
          onCheckedChange={(checked) =>
            void saveConfig({ config: { display: { compact: checked } } })
          }
        />
      </SettingsRow>
      <SettingsRow label="主题皮肤" description="CLI 主题皮肤。">
        <span
          className="text-sm font-mono"
          style={{ color: 'var(--theme-muted)' }}
        >
          {(displayConfig.skin as string) || 'default'}
        </span>
      </SettingsRow>
      <SettingsRow
        label="按平台工具进度"
        description="为特定消息平台覆盖工具进度显示。"
      >
        <div className="flex flex-col gap-2">
          {Object.entries(platformOverrides).map(([platform, overrides]) => (
            <div key={platform} className="flex items-center gap-2">
              <span
                className="w-24 shrink-0 text-xs font-mono text-[var(--theme-text)]"
              >
                {platform}
              </span>
              <select
                value={(overrides.tool_progress) || 'all'}
                onChange={(e) => {
                  const updated = {
                    ...platformOverrides,
                    [platform]: { ...overrides, tool_progress: e.target.value },
                  }
                  void saveConfig({ config: { display: { platforms: updated } } })
                }}
                className={selectClassName}
              >
                <option value="all">全部</option>
                <option value="new">仅新消息</option>
                <option value="verbose">详细</option>
                <option value="off">关闭</option>
              </select>
              <button
                onClick={() => {
                  const updated = { ...platformOverrides }
                  delete updated[platform]
                  void saveConfig({ config: { display: { platforms: updated } } })
                }}
                className="rounded px-2 py-0.5 text-xs transition-colors hover:bg-[var(--theme-hover)]"
                style={{ color: 'var(--theme-danger)' }}
              >
                移除
              </button>
            </div>
          ))}
          <AddPlatformOverride
            existing={Object.keys(platformOverrides)}
            onAdd={(platform) => {
              const updated = {
                ...platformOverrides,
                [platform]: { tool_progress: 'all' },
              }
              void saveConfig({ config: { display: { platforms: updated } } })
            }}
          />
        </div>
      </SettingsRow>
    </SettingsSection>
  )

  const sectionContent = {
    hermes: renderHermesOverview(),
    agent: renderAgentBehavior(),
    permissions: renderPermissions(),
    routing: renderSmartRouting(),
    voice: renderVoice(),
    display: renderDisplay(),
  } as const

  return (
    <>
      {saveMessage && (
        <div
          className="rounded-lg px-3 py-2 text-sm font-medium"
          style={{
            backgroundColor: saveMessage.includes('失败') || saveMessage.includes('Failed')
              ? 'rgba(239,68,68,0.15)'
              : 'rgba(34,197,94,0.15)',
            color: saveMessage.includes('失败') || saveMessage.includes('Failed') ? '#ef4444' : '#22c55e',
          }}
        >
          {saveMessage}
        </div>
      )}
      {sectionContent[activeView]}
    </>
  )
}

// ── Systemd Auto-start ────────────────────────────────────────────────────────

interface SystemdStatus {
  ok: boolean
  available: boolean
  installed: boolean
  active: boolean
  enabled: boolean
  output: string
}

function SystemdAutoStartSection() {
  const [status, setStatus] = useState<SystemdStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null,
  )

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/systemd-status')
      const data = (await res.json()) as SystemdStatus
      setStatus(data)
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  const runAction = useCallback(
    async (action: string) => {
      setBusy(true)
      setMessage(null)
      try {
        const res = await fetch('/api/systemd-control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        })
        const data = (await res.json()) as { ok: boolean; output?: string }
        setMessage({
          text: data.output ?? (data.ok ? '完成。' : '失败。'),
          ok: data.ok,
        })
        await fetchStatus()
      } catch (err: unknown) {
        setMessage({
          text: err instanceof Error ? err.message : '请求失败',
          ok: false,
        })
      } finally {
        setBusy(false)
      }
    },
    [fetchStatus],
  )

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--theme-surface)',
    border: '1px solid var(--theme-border)',
    borderRadius: '0.75rem',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  }

  const headingStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--theme-text)',
    margin: 0,
  }

  const muteStyle: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--theme-muted)',
    lineHeight: 1.5,
  }

  const statusDotStyle = (active: boolean): React.CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
    background: active ? '#22c55e' : 'var(--theme-muted)',
  })

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.8125rem',
    color: 'var(--theme-text)',
  }

  const btnStyle = (variant: 'primary' | 'danger' | 'ghost'): React.CSSProperties => ({
    padding: '0.375rem 0.875rem',
    borderRadius: '0.5rem',
    fontSize: '0.8125rem',
    fontWeight: 500,
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.6 : 1,
    border: '1px solid',
    background:
      variant === 'primary'
        ? 'var(--theme-accent)'
        : variant === 'danger'
          ? 'rgba(239,68,68,0.12)'
          : 'transparent',
    borderColor:
      variant === 'primary'
        ? 'var(--theme-accent)'
        : variant === 'danger'
          ? 'rgba(239,68,68,0.4)'
          : 'var(--theme-border)',
    color:
      variant === 'primary'
        ? 'var(--theme-bg)'
        : variant === 'danger'
          ? '#ef4444'
          : 'var(--theme-text)',
  })

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginTop: '0.25rem',
  }

  if (loading) {
    return (
      <div style={{ color: 'var(--theme-muted)', fontSize: '0.875rem' }}>
        正在检查 systemd 状态…
      </div>
    )
  }

  if (!status?.available) {
    return (
      <div style={sectionStyle}>
        <p style={muteStyle}>
          Systemd 开机自启仅适用于运行 systemd 的 Linux 系统。当前主机不支持。
        </p>
        <div
          style={{
            ...cardStyle,
            background: 'transparent',
            border: '1px dashed var(--theme-border)',
          }}
        >
          <p style={{ ...headingStyle, fontWeight: 400, ...muteStyle }}>
            你仍然可以手动启动 Ti Work：
          </p>
          <pre
            style={{
              background: 'var(--theme-surface)',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              fontSize: '0.8125rem',
              color: 'var(--theme-text)',
              overflowX: 'auto',
              margin: 0,
            }}
          >
            {`cd /path/to/hermes-studio\npnpm build && node server-entry.js`}
          </pre>
        </div>
      </div>
    )
  }

  return (
    <div style={sectionStyle}>
      {/* Status Card */}
      <div style={cardStyle}>
        <h3 style={headingStyle}>服务状态</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={rowStyle}>
            <span style={statusDotStyle(status.installed)} />
            <span>
              {status.installed ? '服务单元已安装' : '服务单元未安装'}
            </span>
          </div>
          {status.installed && (
            <>
              <div style={rowStyle}>
                <span style={statusDotStyle(status.active)} />
                <span>{status.active ? '运行中' : '已停止'}</span>
              </div>
              <div style={rowStyle}>
                <span style={statusDotStyle(status.enabled)} />
                <span>
                  {status.enabled ? '已启用（登录时启动）' : '已禁用'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={cardStyle}>
        <h3 style={headingStyle}>操作</h3>
        <p style={muteStyle}>
          管理位于{' '}
          <code
            style={{
              fontFamily: 'monospace',
              background: 'var(--theme-surface)',
              borderRadius: 4,
              padding: '1px 5px',
            }}
          >
            ~/.config/systemd/user/hermes-studio.service
          </code>
          {' '}的 systemd 用户服务单元。
        </p>
        <div style={actionsStyle}>
          {!status.installed ? (
            <button
              style={btnStyle('primary')}
              disabled={busy}
              onClick={() => runAction('install')}
            >
              安装服务
            </button>
          ) : (
            <>
              {!status.active ? (
                <button
                  style={btnStyle('primary')}
                  disabled={busy}
                  onClick={() => runAction('start')}
                >
                  启动
                </button>
              ) : (
                <button
                  style={btnStyle('ghost')}
                  disabled={busy}
                  onClick={() => runAction('stop')}
                >
                  停止
                </button>
              )}
              {!status.enabled ? (
                <button
                  style={btnStyle('ghost')}
                  disabled={busy}
                  onClick={() => runAction('enable')}
                >
                  启用（登录时启动）
                </button>
              ) : (
                <button
                  style={btnStyle('ghost')}
                  disabled={busy}
                  onClick={() => runAction('disable')}
                >
                  禁用开机自启
                </button>
              )}
              <button
                style={btnStyle('danger')}
                disabled={busy}
                onClick={() => runAction('uninstall')}
              >
                卸载
              </button>
            </>
          )}
          <button
            style={btnStyle('ghost')}
            disabled={busy || loading}
            onClick={() => fetchStatus()}
          >
            刷新
          </button>
        </div>
      </div>

      {/* Output */}
      {message && (
        <div
          style={{
            ...cardStyle,
            background: message.ok
              ? 'rgba(34,197,94,0.08)'
              : 'rgba(239,68,68,0.08)',
            borderColor: message.ok
              ? 'rgba(34,197,94,0.3)'
              : 'rgba(239,68,68,0.3)',
          }}
        >
          <pre
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: message.ok ? '#22c55e' : '#ef4444',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {message.text}
          </pre>
        </div>
      )}

      {/* systemctl status output */}
      {status.installed && status.output && (
        <div style={cardStyle}>
          <h3 style={headingStyle}>systemctl 状态</h3>
          <pre
            style={{
              margin: 0,
              fontSize: '0.75rem',
              color: 'var(--theme-muted)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowX: 'auto',
              maxHeight: '16rem',
            }}
          >
            {status.output}
          </pre>
        </div>
      )}

      {/* Manual script */}
      <div
        style={{
          ...cardStyle,
          background: 'transparent',
          border: '1px dashed var(--theme-border)',
        }}
      >
        <h3 style={headingStyle}>命令行安装</h3>
        <p style={muteStyle}>
          你也可以使用随附的脚本从终端管理该服务：
        </p>
        <pre
          style={{
            background: 'var(--theme-surface)',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            fontSize: '0.8125rem',
            color: 'var(--theme-text)',
            overflowX: 'auto',
            margin: 0,
          }}
        >
          {`scripts/install-systemd.sh install\nscripts/install-systemd.sh enable\nscripts/install-systemd.sh start`}
        </pre>
      </div>
    </div>
  )
}
