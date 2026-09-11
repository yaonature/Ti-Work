import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
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
import type {PlanId} from '@/lib/feature-set';
import { usePageTitle } from '@/hooks/use-page-title'
import { Button } from '@/components/ui/button'
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog'
import { Switch } from '@/components/ui/switch'
import { getStoredThemeMode, useSettings } from '@/hooks/use-settings'
import { ThemeToggle } from '@/components/theme-toggle'
import { THEMES, getTheme, setTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import {
  FEATURE_LABELS,
  PLAN_META,
  
  derivePlanFromFeatureSet
} from '@/lib/feature-set'
import { EmojiIcon, LobsterIcon } from '@/components/emoji-icon'
import { toast } from '@/components/ui/toast'
import {
  getChatProfileDisplayName,
  useChatSettingsStore,
} from '@/hooks/use-chat-settings'
import { UserAvatar } from '@/components/avatars'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectItem,
  SelectList,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { LogoLoader } from '@/components/logo-loader'
import { BrailleSpinner } from '@/components/ui/braille-spinner'
import { ThreeDotsSpinner } from '@/components/ui/three-dots-spinner'
// useWorkspaceStore removed — hamburger eliminated on mobile

export const Route = createFileRoute('/settings/')({
  component: SettingsRoute,
})

// ── 目录授权：辅助类型与工具 ──────────────────────────────────────────

type DirectoryLevel = 'full' | 'readonly' | 'blocked'

const DIRECTORY_LEVEL_OPTIONS: Array<{ value: DirectoryLevel; label: string }> = [
  { value: 'full', label: '可读写' },
  { value: 'readonly', label: '只读' },
  { value: 'blocked', label: '禁止' },
]

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

/**
 * 目录授权级别的三段式选择控件：点选即得，无需下拉思考。
 * testIdPrefix 用于区分「规则行」与「新增区」，避免同一 testid 在页面重复。
 */
function DirectoryLevelSegment({
  value,
  onChange,
  disabled = false,
  compact = false,
  testIdPrefix = 'permissions_directory_level',
}: {
  value: DirectoryLevel
  onChange: (level: DirectoryLevel) => void
  disabled?: boolean
  compact?: boolean
  testIdPrefix?: string
}) {
  const itemClass = compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-0.5">
      {DIRECTORY_LEVEL_OPTIONS.map((lvl) => {
        const active = value === lvl.value
        return (
          <button
            key={lvl.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(lvl.value)}
            aria-pressed={active}
            className={cn(
              'rounded-md font-medium transition-colors',
              itemClass,
              active
                ? 'bg-[var(--theme-accent)] text-white'
                : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
              disabled && 'cursor-not-allowed opacity-50',
            )}
            data-testid={`${testIdPrefix}_${lvl.value}`}
          >
            {lvl.label}
          </button>
        )
      })}
    </div>
  )
}

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
  /** 锚点 id：供「权限与安全」总览“去配置”跳转定位到具体区块。 */
  anchorId?: string
}

function SettingsSection({ title, description, icon, children, anchorId }: SectionProps) {
  return (
    <section
      id={anchorId}
      className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-4 shadow-sm backdrop-blur-xl md:p-5"
    >
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

// ── 高频 / 低频分层 ────────────────────────────────────────────────────
// 高频项默认在侧边栏直接展示；低频项收进「更多设置」折叠区，降低小白用户的认知负载。
const MORE_SETTINGS_IDS = new Set<SettingsNavItem['id']>([
  'permissions',
  'agent',
  'routing',
  'display',
  'integrations',
  'identity',
  'account',
  'autostart',
  'hub',
  'users',
  'mcp',
])

function isPrimarySettingItem(id: SettingsNavItem['id']): boolean {
  return !MORE_SETTINGS_IDS.has(id)
}

// ── 安全能力收口 ──────────────────────────────────────────────────────────
// 「权限与工具集 / 账号中心 / 企业中枢」已由 /audit 安全中心统一承载。
// 从 /settings 导航中隐藏，但保留在 SETTINGS_NAV_ITEMS 里以支持升级引导深链
// （?section=account|hub 经 openUpgradeGuide / openUpgradeGuideToHub 定位）。
const HIDDEN_FROM_NAV_IDS = new Set<SettingsNavItem['id']>([
  'permissions',
  'account',
  'hub',
])

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
  const search: { section?: string } = useSearch({ strict: false })
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
  const [moreExpanded, setMoreExpanded] = useState(false)

  useEffect(() => {
    if (typeof requestedSection !== 'string') return
    const matchedNavItem = SETTINGS_NAV_ITEMS.find(
      (item) => item.id === requestedSection,
    )
    if (matchedNavItem) {
      setActiveSection(matchedNavItem.id as SettingsSectionId)
      // 深链命中低频项时自动展开「更多设置」，避免定位后被折叠遮挡
      if (!isPrimarySettingItem(matchedNavItem.id)) setMoreExpanded(true)
    }
  }, [requestedSection])

  function renderNavItem(item: SettingsNavItem, variant: 'sidebar' | 'pill') {
    const isSidebar = variant === 'sidebar'
    if (item.to) {
      return (
        <Link
          key={item.id}
          to={item.to}
          className={cn(
            isSidebar
              ? 'rounded-lg px-3 py-2 text-left text-sm text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-panel)] hover:text-[var(--theme-text)]'
              : 'shrink-0 rounded-full bg-[var(--theme-panel)] px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] transition-colors',
          )}
        >
          {item.label}
        </Link>
      )
    }
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => setActiveSection(item.id as SettingsSectionId)}
        className={cn(
          isSidebar
            ? 'rounded-lg px-3 py-2 text-left text-sm transition-colors'
            : 'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
          activeSection === item.id
            ? isSidebar
              ? 'bg-[var(--theme-accent)]/10 text-accent-600 font-medium'
              : 'bg-[var(--theme-accent)] text-white'
            : isSidebar
              ? 'text-[var(--theme-muted)] hover:bg-[var(--theme-panel)] hover:text-[var(--theme-text)]'
              : 'bg-[var(--theme-panel)] text-[var(--theme-muted)]',
        )}
      >
        {item.label}
      </button>
    )
  }

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
              {SETTINGS_NAV_ITEMS.filter(
                (item) =>
                  isPrimarySettingItem(item.id) &&
                  !HIDDEN_FROM_NAV_IDS.has(item.id),
              ).map((item) => renderNavItem(item, 'sidebar'))}

              <button
                type="button"
                onClick={() => setMoreExpanded((v) => !v)}
                aria-expanded={moreExpanded}
                className="mt-1 flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-panel)] hover:text-[var(--theme-text)]"
              >
                更多设置
                <HugeiconsIcon
                  icon={moreExpanded ? ArrowUp01Icon : ArrowDown01Icon}
                  size={16}
                  strokeWidth={1.5}
                />
              </button>

              {moreExpanded &&
                SETTINGS_NAV_ITEMS.filter(
                  (item) =>
                    !isPrimarySettingItem(item.id) &&
                    !HIDDEN_FROM_NAV_IDS.has(item.id),
                ).map((item) => renderNavItem(item, 'sidebar'))}
            </div>
          </div>
        </nav>

        {/* Mobile header — intentionally omitted; MobilePageHeader above shows "Settings" */}

        {/* Mobile section pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none md:hidden">
          {SETTINGS_NAV_ITEMS.filter(
            (item) =>
              isPrimarySettingItem(item.id) &&
              !HIDDEN_FROM_NAV_IDS.has(item.id),
          ).map((item) => renderNavItem(item, 'pill'))}

          <button
            type="button"
            onClick={() => setMoreExpanded((v) => !v)}
            aria-expanded={moreExpanded}
            className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] transition-colors"
          >
            更多设置
            <HugeiconsIcon
              icon={moreExpanded ? ArrowUp01Icon : ArrowDown01Icon}
              size={14}
              strokeWidth={1.5}
            />
          </button>

          {moreExpanded &&
            SETTINGS_NAV_ITEMS.filter(
              (item) =>
                !isPrimarySettingItem(item.id) &&
                !HIDDEN_FROM_NAV_IDS.has(item.id),
            ).map((item) => renderNavItem(item, 'pill'))}
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
                description="界面明暗与主题。"
                icon={PaintBoardIcon}
              >
                <SettingsRow
                  label="明暗模式"
                  description="浅色 / 深色 / 跟随系统。"
                >
                  <ThemeToggle />
                </SettingsRow>
                <SettingsRow
                  label="主题"
                  description="浅色与深色，其余为深色设计。"
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
              description="工作区中的 Monaco 默认设置。"
              icon={SourceCodeSquareIcon}
            >
              <SettingsRow
                label="字号"
                description="12 到 20 之间调整。"
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
                    className="w-full accent-[var(--theme-accent)]"
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
                description="在编辑器中自动换行。"
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
                description="显示代码缩略图。"
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
                description="提醒通知与用量阈值。"
                icon={Notification03Icon}
              >
                <SettingsRow
                  label="启用提醒"
                  description="显示用量与系统提醒。"
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
                  description="50% 到 100% 之间触发。"
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
                      className="w-full accent-[var(--theme-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
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
                description="主动建议模型，优化成本与质量。"
                icon={Settings02Icon}
              >
                <SettingsRow
                  label="启用智能建议"
                  description="简单任务推荐便宜模型，复杂工作推荐更好模型。"
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
                  description="更便宜建议的默认模型。"
                >
                  <Select
                    value={settings.preferredBudgetModel || null}
                    onValueChange={(value) =>
                      updateSettings({ preferredBudgetModel: value || '' })
                    }
                    aria-label="首选经济型模型"
                  >
                    <SelectTrigger className="md:max-w-xs">
                      <SelectValue placeholder="自动检测" />
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectList>
                        <SelectItem value={null}>自动检测</SelectItem>
                        {modelsError && (
                          <SelectItem value="__error__" disabled>
                            加载模型失败
                          </SelectItem>
                        )}
                        {availableModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectList>
                    </SelectPopup>
                  </Select>
                </SettingsRow>
                <SettingsRow
                  label="首选高端模型"
                  description="升级建议的默认模型。"
                >
                  <Select
                    value={settings.preferredPremiumModel || null}
                    onValueChange={(value) =>
                      updateSettings({ preferredPremiumModel: value || '' })
                    }
                    aria-label="首选高端模型"
                  >
                    <SelectTrigger className="md:max-w-xs">
                      <SelectValue placeholder="自动检测" />
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectList>
                        <SelectItem value={null}>自动检测</SelectItem>
                        {modelsError && (
                          <SelectItem value="__error__" disabled>
                            加载模型失败
                          </SelectItem>
                        )}
                        {availableModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectList>
                    </SelectPopup>
                  </Select>
                </SettingsRow>
                <SettingsRow
                  label="仅建议更便宜的模型"
                  description="只建议更便宜方案。"
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
                更改自动保存。
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
      '定义智能体的人格与语气。每条消息都会重新加载，修改后无需重启 Ti Work 即可生效。',
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
  const [pendingSelectedPath, setPendingSelectedPath] =
    useState<IdentityFilePath | null>(null)
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

  const handleSelectFile = (path: IdentityFilePath) => {
    if (path === selectedPath) return
    if (isDirty) {
      setPendingSelectedPath(path)
      return
    }
    setSelectedPath(path)
  }

  return (
    <SettingsSection
      title="身份文件"
      description="编辑人格、启动行为与编码规范的文件。保存到 ~/.hermes。"
      icon={UserIcon}
    >
      {/* File picker */}
      <div className="flex flex-wrap gap-2 mb-4">
        {IDENTITY_FILES.map((f) => (
          <button
            key={f.path}
            type="button"
            onClick={() => handleSelectFile(f.path)}
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
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          rows={18}
          placeholder={`# ${selectedPath}\n\n开始编写…`}
          className="font-mono"
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
      <ConfirmActionDialog
        open={pendingSelectedPath !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSelectedPath(null)
        }}
        title="放弃未保存的更改"
        description={
          pendingSelectedPath ? (
            <>
              当前文件还有未保存的内容。确定要放弃本次修改，并切换到{' '}
              <strong>
                {IDENTITY_FILES.find((item) => item.path === pendingSelectedPath)?.label}
              </strong>{' '}
              吗？
            </>
          ) : (
            '当前文件还有未保存的内容，确定要放弃本次修改吗？'
          )
        }
        confirmLabel="放弃并切换"
        onConfirm={() => {
          if (!pendingSelectedPath) return
          setContent(originalContent)
          setMessage(null)
          setSelectedPath(pendingSelectedPath)
          setPendingSelectedPath(null)
        }}
      />
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

export function HubSection() {
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
        description="登录/席位/有效期受中枢控制，血缘与审计事件自动上报。"
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
            尚未接入。输入中枢地址与账号即可接入。
          </p>
        )}
      </SettingsSection>

      {!status?.configured && (
        <SettingsSection
          title="连接中枢"
          description="使用中枢账号接入，凭证仅用于本次登录。"
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
export function AccountCenterSection() {
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
    <div className="flex flex-col gap-4">
      <SettingsSection
        title="账号中心"
        description="可选登录：不登录也可使用全部本地功能。"
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
        description="登录后跨设备同步会话与设置。"
        icon={CloudIcon}
      >
        <SettingsRow
          label="开启云同步"
          description="登录后自动备份会话与偏好。"
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
        description="匿名上报崩溃与使用情况，不含对话内容。"
        icon={Notification03Icon}
      >
        <SettingsRow
          label="开启遥测"
          description="启动耗时/崩溃/版本等匿名数据。"
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
    </div>
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
      description="依赖的外部服务。"
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

      {/* Feishu self-built app authorization → /api/integrations/feishu */}
      <div className="flex flex-col gap-1 border-t border-[var(--theme-border)] pt-4">
        <p className="text-sm font-medium text-[var(--theme-text)]">
          飞书自建应用授权
        </p>
        <p className="mb-3 text-xs text-[var(--theme-muted)]">
          将 Agent 接入飞书开放平台生态，用于在飞书中调用机器人 / 连接器能力。
        </p>
        <FeishuAuthCard />
      </div>

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

/** 飞书自建应用授权状态 —— 对应后端 FeishuAppState（见 server/integrations.ts） */
type FeishuAppState = {
  configured: boolean
  verified: boolean
  appId: string
  appSecretSet: boolean
  appSecretMasked: string
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

// ── Feishu self-built app authorization card ─────────────────────────────────

const FEISHU_GUIDE_STEPS = [
  {
    title: '创建自建应用',
    text: '前往飞书开放平台 open.feishu.cn，创建企业自建应用。',
  },
  {
    title: '复制 App ID / App Secret',
    text: '在应用「凭证与基础信息」页复制这两项凭据。',
  },
  {
    title: '填写并连接',
    text: '把凭据粘到下方，点击「连接并验证」，系统会校验并保存授权。',
  },
] as const

function FeishuAuthCard() {
  const [state, setState] = useState<FeishuAppState | null>(null)
  const [appId, setAppId] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [editing, setEditing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [showGuide, setShowGuide] = useState(true)
  const [msg, setMsg] = useState<{
    kind: 'ok' | 'err' | 'info'
    text: string
  } | null>(null)

  const connected = Boolean(state?.configured)

  useEffect(() => {
    let alive = true
    fetch('/api/integrations/feishu')
      .then((r) => r.json())
      .then((d: { state?: FeishuAppState }) => {
        if (!alive) return
        const s = d.state ?? null
        setState(s)
        setShowGuide(!s?.configured)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  function startReconnect() {
    setAppId(state?.appId ?? '')
    setAppSecret('')
    setEditing(true)
    setShowGuide(true)
    setMsg(null)
  }

  function cancelEdit() {
    setEditing(false)
    setMsg(null)
  }

  async function connect() {
    const id = appId.trim()
    const secret = appSecret.trim()
    if (!id || !secret) {
      setMsg({ kind: 'err', text: '请填写 App ID 和 App Secret。' })
      return
    }
    setConnecting(true)
    setMsg(null)
    try {
      const res = await fetch('/api/integrations/feishu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: id, appSecret: secret }),
      })
      const d = (await res.json()) as {
        ok?: boolean
        message?: string
        code?: number
        state?: FeishuAppState
      }
      if (!res.ok || !d.ok) {
        setMsg({
          kind: 'err',
          text: d.message || (d.code ? `飞书返回错误码 ${d.code}` : '连接失败'),
        })
        return
      }
      if (d.state) setState(d.state)
      setEditing(false)
      setShowGuide(false)
      setAppSecret('')
      setMsg({ kind: 'ok', text: d.message || '连接成功，授权已保存。' })
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : '连接失败',
      })
    } finally {
      setConnecting(false)
    }
  }

  async function remove() {
    setRemoving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/integrations/feishu', { method: 'DELETE' })
      const d = (await res.json()) as { ok?: boolean; state?: FeishuAppState }
      if (!res.ok || !d.ok) throw new Error('移除失败')
      setState(d.state ?? null)
      setAppId('')
      setAppSecret('')
      setEditing(false)
      setShowGuide(true)
      setMsg({ kind: 'info', text: '已移除授权。' })
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : '移除失败',
      })
    } finally {
      setRemoving(false)
    }
  }

  const inputCls =
    'flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 font-mono text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'

  const showForm = !connected || editing

  return (
    <div className="flex flex-col gap-3">
      {showGuide && (
        <ol className="flex flex-col gap-2 rounded-lg border border-dashed border-[var(--theme-border)] bg-[var(--theme-panel)]/40 p-3">
          {FEISHU_GUIDE_STEPS.map((step, i) => (
            <li key={step.title} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--theme-accent)] text-[10px] font-semibold text-[var(--theme-bg)]">
                {i + 1}
              </span>
              <span className="text-[var(--theme-text)]">
                <span className="font-medium">{step.title}</span>
                <span className="text-[var(--theme-muted)]"> —— {step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {connected && !editing && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-panel)]/60 px-3 py-1.5">
            <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--theme-muted)]">
              App ID
            </span>
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--theme-text)]">
              {state?.appId}
            </code>
            {state?.verified && (
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={16}
                className="shrink-0 text-green-600"
              />
            )}
          </div>
          {state?.appSecretSet && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-panel)]/60 px-3 py-1.5">
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--theme-muted)]">
                App Secret
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--theme-text)]">
                {state?.appSecretMasked}
              </code>
            </div>
          )}
          <div className="mt-1 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={startReconnect}>
              重新连接
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowGuide((v) => !v)}
            >
              {showGuide ? '收起指南' : '查看指南'}
            </Button>
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              disabled={removing}
              className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              {removing ? '移除中…' : '移除'}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--theme-text)]">
              App ID
            </label>
            <input
              type="text"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="cli_xxxxxxxxxxxxxxxx"
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--theme-text)]">
              App Secret
            </label>
            <input
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder="xxxxxxxxxxxxxxxx"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void connect()
              }}
              className={inputCls}
            />
            <p className="text-[11px] text-[var(--theme-muted)]">
              {connected
                ? '重新连接将替换现有凭据。'
                : '凭据仅保存在本地 ~/.hermes/config.yaml。'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => void connect()}
              disabled={connecting || !appId.trim() || !appSecret.trim()}
            >
              {connecting ? '连接中…' : connected ? '重新连接' : '连接并验证'}
            </Button>
            {!connected && (
              <Button size="sm" variant="outline" onClick={() => setShowGuide((v) => !v)}>
                {showGuide ? '收起指南' : '查看指南'}
              </Button>
            )}
            {connected && editing && (
              <Button size="sm" variant="outline" onClick={cancelEdit}>
                取消
              </Button>
            )}
          </div>
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

      <ConfirmActionDialog
        open={confirmRemove}
        onOpenChange={(open) => {
          if (!open) setConfirmRemove(false)
        }}
        title="移除飞书授权"
        description={
          <>
            确定要移除飞书自建应用授权吗？App ID / App Secret 将被清除，
            其它飞书配置（如 Webhook）不受影响。
          </>
        }
        confirmLabel="移除"
        onConfirm={() => {
          setConfirmRemove(false)
          void remove()
        }}
      />
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
      description="令牌保存到 ~/.hermes/.env，重启网关后生效。"
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
      description="会话中使用的昵称与头像。"
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
        description="会话消息显示内容。"
        icon={MessageMultiple01Icon}
      >
        <SettingsRow
          label="显示工具消息"
          description="显示工具调用详情。"
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
          description="展示模型思考过程。"
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
  { value: 'braille-hermes', label: 'Ti Work' },
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
      description="流式输出时的动画样式。"
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
      <Select
        value={selected || null}
        onValueChange={(value) => setSelected(value || '')}
        aria-label="添加平台"
      >
        <SelectTrigger className="text-xs">
          <SelectValue placeholder="添加平台…" />
        </SelectTrigger>
        <SelectPopup>
          <SelectList>
            <SelectItem value={null}>添加平台…</SelectItem>
            {available.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectList>
        </SelectPopup>
      </Select>
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

export function HermesConfigSection({
  activeView = 'hermes',
}: {
  activeView?: 'hermes' | 'agent' | 'permissions' | 'routing' | 'voice' | 'display'
}) {
  const [data, setData] = useState<HermesConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [testingEnvKey, setTestingEnvKey] = useState<string | null>(null)
  const [keyTestResults, setKeyTestResults] = useState<
    Record<string, { state: 'success' | 'error'; message: string }>
  >({})
  const [modelInput, setModelInput] = useState('')
  const [providerInput, setProviderInput] = useState('')
  const [baseUrlInput, setBaseUrlInput] = useState('')
  const [newToolset, setNewToolset] = useState('')
  const [newAllowlistCmd, setNewAllowlistCmd] = useState('')
  const [newBlocklistDomain, setNewBlocklistDomain] = useState('')
  const [newAllowedDomain, setNewAllowedDomain] = useState('')
  const [newBlockedDomain, setNewBlockedDomain] = useState('')
  const [newDirectoryPath, setNewDirectoryPath] = useState('')
  const [newDirectoryLevel, setNewDirectoryLevel] = useState<'full' | 'readonly' | 'blocked'>('full')
  const [securityTab, setSecurityTab] = useState<'directory' | 'website' | 'risk' | 'tools'>('directory')
  const [securityStep, setSecurityStep] = useState<'directory' | 'preset' | 'done'>('directory')
  const [pendPreset, setPendPreset] = useState<'standard' | 'strict' | 'loose' | null>(null)
  const [showSecurityAdvanced, setShowSecurityAdvanced] = useState(false)
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

  // 从「权限与安全」总览的“去配置”跳转时，切换到对应授权子页签并定位。
  // 同时监听 hashchange，便于已在授权配置页时再次跳转定位。
  const SECURITY_HASH_TAB: Record<
    string,
    'directory' | 'website' | 'risk'
  > = {
    'security-directory': 'directory',
    'security-website': 'website',
    'security-risk': 'risk',
  }
  useEffect(() => {
    const handleHash = () => {
      if (activeView !== 'permissions') return
      const match = window.location.hash.match(
        /^#(security-directory|security-website|security-risk)$/,
      )
      if (!match) return
      setSecurityTab(SECURITY_HASH_TAB[match[1]] ?? 'directory')
      setShowSecurityAdvanced(true)
      // 定位到授权配置面板顶部
      window.setTimeout(() => {
        const target = document.getElementById('security-config-scroll')
        if (!target) return
        target.style.scrollMarginTop = '16px'
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 120)
    }
    handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [data, activeView])

  const saveConfig = async (updates: {
    config?: Record<string, unknown>
    env?: Record<string, string>
  }) => {
    setSaving(true)
    try {
      const res = await fetch('/api/hermes-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const result = (await res.json()) as { message?: string }
      const message = result.message || '已保存'
      const failed = res.ok === false || /失败|Failed/.test(message)
      toast(message, { type: failed ? 'error' : 'success' })
      const refreshData = await fetchConfig()
      if (refreshData.activeProvider) {
        void fetchModelsForProvider(refreshData.activeProvider)
      }
    } catch {
      toast('保存失败', { type: 'error' })
    }
    setSaving(false)
  }

  const handleTestKey = async (providerId: string, envKey: string) => {
    setTestingEnvKey(envKey)
    setKeyTestResults((prev) => {
      const next = { ...prev }
      delete next[envKey]
      return next
    })
    try {
      const res = await fetch('/api/hermes-key-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
      })
      const result = (await res.json()) as {
        ok: boolean
        source?: 'request' | 'env'
        status?: number
        modelCount?: number
        error?: string
      }
      if (res.ok && result.ok) {
        setKeyTestResults((prev) => ({
          ...prev,
          [envKey]: {
            state: 'success',
            message:
              typeof result.modelCount === 'number'
                ? `连接正常，获取到 ${result.modelCount} 个模型`
                : '连接正常',
          },
        }))
      } else {
        setKeyTestResults((prev) => ({
          ...prev,
          [envKey]: {
            state: 'error',
            message: result.error || '测通失败，请检查 API 密钥。',
          },
        }))
      }
    } catch {
      setKeyTestResults((prev) => ({
        ...prev,
        [envKey]: { state: 'error', message: '网络错误，无法测通。' },
      }))
    }
    setTestingEnvKey(null)
  }

  const handleDeleteKey = (envKey: string) => {
    void saveConfig({ env: { [envKey]: '' } })
    setKeyTestResults((prev) => {
      const next = { ...prev }
      delete next[envKey]
      return next
    })
  }

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

  const readStringArray = (
    value: unknown,
    options?: { lowercase?: boolean },
  ) => {
    const items = Array.isArray(value) ? value : []
    const normalized = items
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .map((item) => (options?.lowercase ? item.toLowerCase() : item))
    return Array.from(new Set(normalized))
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
        title="Ti Work 智能体"
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
        title="Ti Work 智能体"
        description="无法加载 Ti Work 配置。"
        icon={Settings02Icon}
      >
        <p className="text-sm" style={{ color: 'var(--theme-muted)' }}>
          请确保 Ti Work 智能体运行在 localhost:8642
        </p>
      </SettingsSection>
    )
  }

  const memoryConfig = (data.config.memory as Record<string, unknown>) || {}
  const terminalConfig = (data.config.terminal as Record<string, unknown>) || {}
  const displayConfig = (data.config.display as Record<string, unknown>) || {}
  const agentConfig = (data.config.agent as Record<string, unknown>) || {}
  const compressionConfig =
    (data.config.compression as Record<string, unknown>) || {}
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
        description="配置默认 AI 模型。"
        icon={SourceCodeSquareIcon}
      >
        <SettingsRow
          label="服务提供方"
          description="提供方。"
        >
          <div className="flex w-full max-w-sm gap-2">
            {availableProviders.length > 0 ? (
              <Select
                value={providerInput}
                onValueChange={(value) => {
                  const newProvider = value || ''
                  setProviderInput(newProvider)
                  setModelInput('')
                  void fetchModelsForProvider(newProvider)
                }}
                aria-label="服务提供方"
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择服务提供方" />
                </SelectTrigger>
                <SelectPopup>
                  <SelectList>
                    {availableProviders.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}{' '}
                        {p.authenticated ? (
                          <EmojiIcon emoji="✓" size={12} />
                        ) : null}
                      </SelectItem>
                    ))}
                  </SelectList>
                </SelectPopup>
              </Select>
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
          description="会话所用模型。"
        >
          <div className="flex w-full max-w-sm gap-2">
            {availableModels.length > 0 ? (
              <Select
                value={modelInput}
                onValueChange={(value) => setModelInput(value || '')}
                aria-label="模型"
              >
                <SelectTrigger className="font-mono">
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectPopup>
                  <SelectList>
                    {!availableModels.some((m) => m.id === modelInput) &&
                      modelInput && (
                        <SelectItem className="font-mono" value={modelInput}>
                          {modelInput}（当前）
                        </SelectItem>
                      )}
                    {availableModels.map((m) => (
                      <SelectItem className="font-mono" key={m.id} value={m.id}>
                        {m.id}
                        {m.description ? ` — ${m.description}` : ''}
                      </SelectItem>
                    ))}
                  </SelectList>
                </SelectPopup>
              </Select>
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
          description="本地提供方（Ollama、LM Studio、MLX）。云端留空。"
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
        description="管理 ~/.hermes/.env 中的 API 密钥。"
        icon={CloudIcon}
      >
        {data.providers
          .filter((p) => p.envKeys.length > 0)
          .map((provider) => (
            <SettingsRow
              key={provider.id}
              label={provider.name}
              description={
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: provider.configured
                        ? 'var(--theme-success)'
                        : 'var(--theme-muted)',
                    }}
                  />
                  {provider.configured ? '已配置' : '未配置'}
                </span>
              }
            >
              <div className="flex w-full max-w-sm flex-col gap-2">
                {provider.envKeys.map((envKey) => {
                  const result = keyTestResults[envKey]
                  const isTesting = testingEnvKey === envKey
                  const masked = provider.maskedKeys[envKey]
                  return (
                    <div key={envKey} className="flex flex-col gap-1">
                      <div className="flex w-full flex-wrap items-center gap-2">
                        {editingKey === envKey ? (
                          <>
                            <Input
                              type="password"
                              value={keyInput}
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>,
                              ) => setKeyInput(e.target.value)}
                              placeholder={`输入 ${envKey}`}
                              className="min-w-0 flex-1"
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
                          </>
                        ) : (
                          <>
                            <span
                              className="min-w-0 flex-1 truncate text-xs font-mono"
                              style={{ color: 'var(--theme-muted)' }}
                            >
                              {masked || '未设置'}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingKey(envKey)
                                setKeyInput('')
                              }}
                            >
                              {masked ? '更改' : '添加'}
                            </Button>
                          </>
                        )}
                        {masked && editingKey !== envKey && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isTesting}
                              onClick={() =>
                                void handleTestKey(provider.id, envKey)
                              }
                            >
                              {isTesting ? '测通…' : '测通'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isTesting}
                              onClick={() => handleDeleteKey(envKey)}
                            >
                              删除
                            </Button>
                          </>
                        )}
                      </div>
                      {result && (
                        <div
                          className="text-xs"
                          style={{
                            color:
                              result.state === 'success'
                                ? 'var(--theme-success)'
                                : 'var(--theme-danger)',
                          }}
                        >
                          {result.message}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </SettingsRow>
          ))}
      </SettingsSection>

      <SettingsSection
        title="记忆"
        description="记忆与用户资料。"
        icon={UserIcon}
      >
        <SettingsRow
          label="启用记忆"
          description="跨会话存储记忆。"
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
          description="记住偏好与上下文。"
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
        description="config.yaml 只读详情。"
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
        description="智能体运行时信息。"
        icon={Notification03Icon}
      >
        <SettingsRow
          label="配置位置"
          description="配置存储位置。"
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
          description="当前提供方。"
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
      description="执行限制与工具访问。"
      icon={Settings02Icon}
    >
      <SettingsRow
        label="最大轮数"
        description="最大轮数（1-100）。"
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
        description="请求超时前等待秒数。"
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
        description="可用时是否强制使用工具。"
      >
        <Select
          value={(agentConfig.tool_use_enforcement as string) || 'auto'}
          onValueChange={(value) =>
            void saveConfig({
              config: { agent: { tool_use_enforcement: value || 'auto' } },
            })
          }
          aria-label="强制使用工具"
        >
          <SelectTrigger className="md:max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            <SelectList>
              <SelectItem value="auto">自动</SelectItem>
              <SelectItem value="required">必需</SelectItem>
              <SelectItem value="none">无</SelectItem>
            </SelectList>
          </SelectPopup>
        </Select>
      </SettingsRow>
      <SettingsRow
        label="会话重置模式"
        description="何时自动清除会话上下文。"
      >
        <Select
          value={(sessionResetConfig.mode as string) || 'both'}
          onValueChange={(value) =>
            void saveConfig({
              config: { session_reset: { mode: value || 'both' } },
            })
          }
          aria-label="会话重置模式"
        >
          <SelectTrigger className="md:max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            <SelectList>
              <SelectItem value="none">从不</SelectItem>
              <SelectItem value="daily">每天（按小时）</SelectItem>
              <SelectItem value="idle">空闲超时</SelectItem>
              <SelectItem value="both">两者</SelectItem>
            </SelectList>
          </SelectPopup>
        </Select>
      </SettingsRow>
      {['daily', 'both'].includes(
        (sessionResetConfig.mode as string) || 'both',
      ) && (
        <SettingsRow
          label="重置时间点"
          description="每日重置小时（0–23，本地）。"
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
          description="重置前空闲分钟数。"
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
      <SettingsRow
        label="自动压缩"
        description="接近上下文上限时自动总结较早消息，释放上下文空间。"
      >
        <Switch
          checked={readBoolean(compressionConfig.enabled, true)}
          onCheckedChange={(checked) =>
            void saveConfig({
              config: { compression: { enabled: checked } },
            })
          }
        />
      </SettingsRow>
    </SettingsSection>
  )

  const renderPermissions = () => {
    const directoryAccessConfig =
      (securityConfig.directory_access as Record<string, unknown>) || {}
    const websiteAccessConfig =
      (securityConfig.website_access as Record<string, unknown>) || {}
    const riskControlsConfig =
      (securityConfig.risk_controls as Record<string, unknown>) || {}
    const confirmationRules =
      (riskControlsConfig.require_confirmation as Record<string, unknown>) || {}
    const approvalRules =
      (riskControlsConfig.require_approval as Record<string, unknown>) || {}
    // 安全档位：根据当前配置的目录/网站模式推断所属档位用于高亮选中态。
    // strict 的唯一标志是网站模式 ask；loose 唯一标志是目录模式 observe；否则归为标准。
    const activeSecurityPreset: 'standard' | 'strict' | 'loose' | null =
      (websiteAccessConfig.mode as string) === 'ask'
        ? 'strict'
        : (directoryAccessConfig.mode as string) === 'observe'
          ? 'loose'
          : (directoryAccessConfig.mode as string) === 'scoped' &&
              (websiteAccessConfig.mode as string) === 'balanced'
            ? 'standard'
            : null
    const fullDirectories = readStringArray(directoryAccessConfig.allowed_paths)
    const readonlyDirectories = readStringArray(directoryAccessConfig.readonly_paths)
    const blockedDirectories = readStringArray(directoryAccessConfig.blocked_paths)
    const allowedDomains = readStringArray(websiteAccessConfig.allowed_domains, {
      lowercase: true,
    })
    const blockedDomains = Array.from(
      new Set([
        ...readStringArray(websiteAccessConfig.blocked_domains, {
          lowercase: true,
        }),
        ...blocklistDomains.map((domain) => domain.toLowerCase()),
      ]),
    )
    // 目录授权规则：完全操控 / 只读 / 禁止访问 三类统一为一条规则列表。
    const directoryRules: Array<{
      path: string
      level: 'full' | 'readonly' | 'blocked'
    }> = [
      ...fullDirectories.map((p) => ({ path: p, level: 'full' as const })),
      ...readonlyDirectories.map((p) => ({ path: p, level: 'readonly' as const })),
      ...blockedDirectories.map((p) => ({ path: p, level: 'blocked' as const })),
    ]
    const dangerActions = [
      {
        key: 'delete',
        label: '删除文件',
        description: '删除、清空回收站或批量移除文件。',
      },
      {
        key: 'overwrite',
        label: '覆盖写入',
        description: '覆盖原文件、批量重命名或替换内容。',
      },
      {
        key: 'move',
        label: '批量移动',
        description: '跨目录搬运、归档或批量整理操作。',
      },
      {
        key: 'external_send',
        label: '对外发送',
        description: '发送邮件、消息、工单或其他外部系统提交。',
      },
      {
        key: 'upload',
        label: '上传文件',
        description: '向网页或第三方系统上传本地文件。',
      },
      {
        key: 'download',
        label: '下载文件',
        description: '从网页或外部系统下载到本机。',
      },
      {
        key: 'execute_shell',
        label: '执行终端命令',
        description: '调用终端、脚本或其他本地执行器。',
      },
    ] as const

    const securityTabs = [
      { id: 'directory', label: '目录' },
      { id: 'website', label: '网站' },
      { id: 'risk', label: '风险动作' },
      { id: 'tools', label: '安全与工具' },
    ] as const

    // 三步式向导：授权预设卡片的展示文案（选择+预览共用）。
    const presetCards = [
      {
        id: 'standard',
        name: '标准',
        desc: '推荐 · 适合多数场景',
        bullets: [
          '目录：仅允许在已登记的受控工作区内执行',
          '网站：平衡模式，常用站点自动沉淀',
          '动作：删除、覆盖、移动、上传等操作执行前确认',
          '审批：默认手动，不强制审批',
        ],
      },
      {
        id: 'strict',
        name: '严格',
        desc: '最高安全 · 站点每次询问',
        bullets: [
          '目录：仅允许在已登记的受控工作区内执行',
          '网站：访问新站点每次先确认',
          '动作：删除、覆盖、上传、终端等高风险操作需确认',
          '审批：删除、上传、对外发送、终端需上级审批',
        ],
      },
      {
        id: 'loose',
        name: '宽松',
        desc: '最低打扰 · 目录仅提醒',
        bullets: [
          '目录：仅在已登记目录内提醒，不拦截',
          '网站：平衡模式，常用站点自动沉淀',
          '动作：删除、对外发送、终端等少数操作需确认',
          '审批：默认手动，不强制审批',
        ],
      },
    ] as const

    // 向导中当前期待的档位：优先取用户点选，其次取已生效档位。
    const workingPreset: 'standard' | 'strict' | 'loose' | null =
      pendPreset ?? activeSecurityPreset

    const persistDirectoryRules = (
      rules: Array<{ path: string; level: 'full' | 'readonly' | 'blocked' }>,
    ) => {
      void saveConfig({
        config: {
          security: {
            directory_access: {
              allowed_paths: rules
                .filter((r) => r.level === 'full')
                .map((r) => r.path),
              readonly_paths: rules
                .filter((r) => r.level === 'readonly')
                .map((r) => r.path),
              blocked_paths: rules
                .filter((r) => r.level === 'blocked')
                .map((r) => r.path),
            },
          },
        },
      })
    }

    const upsertDirectoryRule = (
      targetPath: string,
      level: 'full' | 'readonly' | 'blocked',
    ) => {
      persistDirectoryRules([
        ...directoryRules.filter((r) => r.path !== targetPath),
        { path: targetPath, level },
      ])
    }

    const addDirectoryRule = (
      level: 'full' | 'readonly' | 'blocked',
      rawValue: string,
    ) => {
      const trimmed = rawValue.trim()
      if (!trimmed || directoryRules.some((r) => r.path === trimmed)) return
      upsertDirectoryRule(trimmed, level)
      setNewDirectoryPath('')
    }

    const removeDirectoryRule = (targetPath: string) => {
      persistDirectoryRules(directoryRules.filter((r) => r.path !== targetPath))
    }

    // 工作区根目录：通过系统对话框选择，回显选中路径，无需手动输入。
    const pickWorkspaceRoot = async () => {
      const picked = await pickLocalDirectory()
      if (!picked) return
      void saveConfig({
        config: {
          security: { directory_access: { workspace_root: picked } },
        },
      })
    }

    // 新增目录规则：可通过系统对话框选择路径并回填输入框。
    const pickNewDirectory = async () => {
      const picked = await pickLocalDirectory()
      if (picked) setNewDirectoryPath(picked)
    }

    // 目录授权核心：工作区根目录 + 规则列表 + 新增规则。
    // 三步式向导第一步与高级设置「目录」分页共用，避免两处维护同一份逻辑。
    const renderDirectoryCore = () => (
      <>
        <SettingsRow
          label="工作区根目录"
          description="工作区与中间结果的默认落点。"
        >
          <div className="flex w-full items-center gap-2 md:max-w-xl">
            <Input
              value={(directoryAccessConfig.workspace_root as string) || ''}
              readOnly
              placeholder="尚未选择目录"
              className="flex-1"
              data-testid="permissions_directory_workspace_root"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void pickWorkspaceRoot()}
              data-testid="permissions_directory_workspace_pick"
            >
              选择目录
            </Button>
          </div>
        </SettingsRow>
        {/* 目录规则列表：可读写 / 只读 / 禁止 */}
        <div
          className="flex flex-col gap-2"
          data-testid="permissions_directory_rules"
        >
          {directoryRules.length === 0 ? (
            <span className="text-xs text-[var(--theme-muted)]">
              尚未添加目录规则
            </span>
          ) : (
            directoryRules.map((rule, index) => (
              <div
                key={rule.path}
                className="flex items-center gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/50 px-3 py-2"
                data-testid={`permissions_directory_rule_${index}`}
              >
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--theme-text)]">
                  {rule.path}
                </span>
                <DirectoryLevelSegment
                  compact
                  value={rule.level}
                  onChange={(level) => upsertDirectoryRule(rule.path, level)}
                  testIdPrefix={`permissions_directory_rule_${index}_level`}
                />
                <button
                  type="button"
                  onClick={() => removeDirectoryRule(rule.path)}
                  className="shrink-0 text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-danger)]"
                  aria-label={`移除目录规则 ${rule.path}`}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
        {/* 新增目录规则 */}
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          data-testid="permissions_directory_add"
        >
          <Input
            value={newDirectoryPath}
            onChange={(e) => setNewDirectoryPath(e.target.value)}
            placeholder="输入或选择目录路径"
            className="flex-1"
            data-testid="permissions_directory_add_path"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => void pickNewDirectory()}
            data-testid="permissions_directory_add_pick"
          >
            选择
          </Button>
          <DirectoryLevelSegment
            value={newDirectoryLevel}
            onChange={setNewDirectoryLevel}
            testIdPrefix="permissions_directory_add_level"
          />
          <Button
            size="sm"
            onClick={() =>
              addDirectoryRule(newDirectoryLevel, newDirectoryPath)
            }
            disabled={!newDirectoryPath.trim()}
            data-testid="permissions_directory_add_btn"
          >
            添加
          </Button>
        </div>
      </>
    )

    const applySecurityPreset = (
      preset: 'standard' | 'strict' | 'loose',
    ) => {
      const confirmBase = {
        delete: true,
        overwrite: true,
        move: true,
        external_send: true,
        upload: true,
        download: false,
        execute_shell: true,
      }
      const approvalBase = {
        delete: false,
        overwrite: false,
        move: false,
        external_send: false,
        upload: false,
        download: false,
        execute_shell: false,
      }
      const presets = {
        standard: {
          directoryMode: 'scoped',
          websiteMode: 'balanced',
          confirm: confirmBase,
          approval: approvalBase,
          approvalsMode: 'manual',
        },
        strict: {
          directoryMode: 'scoped',
          websiteMode: 'ask',
          confirm: { ...confirmBase, download: true },
          approval: {
            ...approvalBase,
            delete: true,
            overwrite: true,
            external_send: true,
            upload: true,
            execute_shell: true,
          },
          approvalsMode: 'manual',
        },
        loose: {
          directoryMode: 'observe',
          websiteMode: 'balanced',
          confirm: { ...confirmBase, overwrite: false, move: false, upload: false },
          approval: approvalBase,
          approvalsMode: 'manual',
        },
      }[preset]
      void saveConfig({
        config: {
          security: {
            directory_access: { enabled: true, mode: presets.directoryMode },
            website_access: { enabled: true, mode: presets.websiteMode },
            risk_controls: {
              require_confirmation: presets.confirm,
              require_approval: presets.approval,
            },
          },
          approvals: { mode: presets.approvalsMode },
        },
      })
    }

    const addWebsiteRule = (
      listKey: 'allowed_domains' | 'blocked_domains',
      rawValue: string,
      setter: React.Dispatch<React.SetStateAction<string>>,
    ) => {
      const trimmed = rawValue.trim().toLowerCase()
      if (!trimmed) return
      const currentItems =
        listKey === 'allowed_domains' ? allowedDomains : blockedDomains
      if (currentItems.includes(trimmed)) return
      const nextItems = [...currentItems, trimmed]
      void saveConfig({
        config: {
          security: {
            website_access: {
              [listKey]: nextItems,
            },
            ...(listKey === 'blocked_domains'
              ? {
                  website_blocklist: {
                    enabled:
                      readBoolean(websiteAccessConfig.enabled, true) ||
                      readBoolean(websiteBlocklist.enabled, false),
                    domains: nextItems,
                  },
                }
              : {}),
          },
        },
      })
      setter('')
    }

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
        {/* 权限与安全：三步式向导 + 高级设置折叠 */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--theme-text)]">
              权限与安全
            </h3>
            <p className="mt-1 text-xs text-[var(--theme-muted)]">
              选一个安全档位，轻松三步完成；想要细调随时进高级设置。
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSecurityAdvanced((v) => !v)}
            data-testid="security_advanced_toggle"
          >
            {showSecurityAdvanced ? '返回向导' : '高级设置'}
          </Button>
        </div>

        {showSecurityAdvanced ? null : securityStep === 'directory' ? (
          <SettingsSection
            title="第一步 · 定义目录授权"
            description="告诉桌面应用哪些目录允许操作。可完全操控、只读或禁止访问，后期随时可在高级设置调整。"
            icon={LockIcon}
          >
            {renderDirectoryCore()}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                onClick={() => setSecurityStep('preset')}
                data-testid="security_wizard_next"
              >
                下一步
              </Button>
              {directoryRules.length === 0 && (
                <span className="text-xs text-[var(--theme-muted)]">
                  建议至少登记一个工作目录，才能启用「受控工作区」。
                </span>
              )}
            </div>
          </SettingsSection>
        ) : securityStep === 'preset' ? (
          <SettingsSection
            title="第二步 · 选择安全档位"
            description="选定后决定网站访问与风险操作的确认程度，一键生效。"
            icon={LockIcon}
          >
            <div role="radiogroup" className="flex flex-wrap gap-3">
              {presetCards.map((preset) => {
                const selected = workingPreset === preset.id
                const current = activeSecurityPreset === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPendPreset(preset.id)}
                    className={cn(
                      'flex min-w-[200px] flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition-all',
                      selected
                        ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/5 ring-1 ring-[var(--theme-accent)]/40'
                        : 'border-[var(--theme-border)] bg-[var(--theme-panel)]/60 hover:border-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/5',
                    )}
                    data-testid={`security_preset_${preset.id}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--theme-text)]">
                        {preset.name}
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                          selected
                            ? 'border-[var(--theme-accent)]'
                            : 'border-[var(--theme-border)]',
                        )}
                      >
                        {selected && (
                          <span className="h-2 w-2 rounded-full bg-[var(--theme-accent)]" />
                        )}
                      </span>
                    </span>
                    <span className="text-xs text-[var(--theme-muted)]">
                      {preset.desc}
                    </span>
                    {current && (
                      <span className="text-[10px] font-medium text-[var(--theme-accent)]">
                        当前使用中
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {workingPreset && (
              <ul className="mt-4 flex flex-col gap-2 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/50 p-4">
                {presetCards
                  .find((p) => p.id === workingPreset)
                  ?.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-2 text-sm text-[var(--theme-text)]"
                    >
                      <HugeiconsIcon
                        icon={CheckmarkCircle02Icon}
                        size={16}
                        className="mt-0.5 shrink-0 text-[var(--theme-accent)]"
                      />
                      {bullet}
                    </li>
                  ))}
              </ul>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                onClick={() => {
                  if (!workingPreset) return
                  applySecurityPreset(workingPreset)
                  setPendPreset(workingPreset)
                  setSecurityStep('done')
                }}
                data-testid="security_wizard_apply"
              >
                完成配置
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSecurityStep('directory')}
                data-testid="security_wizard_back"
              >
                上一步
              </Button>
            </div>
          </SettingsSection>
        ) : (
          <SettingsSection
            title="配置完成"
            description="安全策略已生效，可继续使用，也随时可进高级设置微调。"
            icon={LockIcon}
          >
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/50 p-4">
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={24}
                className="shrink-0 text-[var(--theme-accent)]"
              />
              <div>
                <p className="text-sm font-semibold text-[var(--theme-text)]">
                  已应用「{workingPreset ? presetCards.find((p) => p.id === workingPreset)?.name : ''}」安全档位
                </p>
                <p className="mt-0.5 text-xs text-[var(--theme-muted)]">
                  已登记 {directoryRules.length} 个目录，当前为「{workingPreset ? presetCards.find((p) => p.id === workingPreset)?.name : ''}」档位。
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                onClick={() => setShowSecurityAdvanced(true)}
                data-testid="security_enter_advanced"
              >
                进入高级设置
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSecurityStep('directory')}
                data-testid="security_wizard_reselect"
              >
                重新配置
              </Button>
            </div>
          </SettingsSection>
        )}

        {showSecurityAdvanced && (
          <div id="security-config-scroll" className="scroll-mt-4">
            <div className="mb-4 flex flex-wrap gap-1.5 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-1">
              {securityTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSecurityTab(tab.id)}
                  className={cn(
                    'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                    securityTab === tab.id
                      ? 'bg-[var(--theme-accent)] text-white'
                      : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                  )}
                  data-testid={`permissions_tab_${tab.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

          {securityTab === 'directory' && (
            <>
              <SettingsSection
                title="目录授权"
                description="每个目录单独指定授权级别。"
                icon={LockIcon}
                anchorId="security-directory"
              >
          <SettingsRow
            label="目录治理开关"
            description="关闭后只保留已配置规则。"
          >
            <Switch
              checked={readBoolean(directoryAccessConfig.enabled, true)}
              onCheckedChange={(checked) =>
                void saveConfig({
                  config: {
                    security: { directory_access: { enabled: checked } },
                  },
                })
              }
            />
          </SettingsRow>
          <SettingsRow
            label="默认策略"
            description="推荐“受控工作区”，仅允许在已登记目录内执行。"
          >
            <Select
              value={(directoryAccessConfig.mode as string) || 'scoped'}
              onValueChange={(value) =>
                void saveConfig({
                  config: {
                    security: { directory_access: { mode: value || 'scoped' } },
                  },
                })
              }
              aria-label="默认策略"
            >
              <SelectTrigger
                className="md:max-w-sm"
                data-testid="permissions_directory_mode"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                <SelectList>
                  <SelectItem value="scoped">受控工作区</SelectItem>
                  <SelectItem value="allowlist">仅允许白名单</SelectItem>
                  <SelectItem value="observe">仅提醒不拦截</SelectItem>
                </SelectList>
              </SelectPopup>
            </Select>
          </SettingsRow>
          {renderDirectoryCore()}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--theme-text)]">
                    写入前确认
                  </h4>
                  <p className="mt-1 text-xs text-[var(--theme-muted)]">
                    对目录内文件新增、覆盖或批量改写时先让用户确认。
                  </p>
                </div>
                <Switch
                  checked={readBoolean(
                    directoryAccessConfig.require_confirmation_for_write,
                    true,
                  )}
                  onCheckedChange={(checked) =>
                    void saveConfig({
                      config: {
                        security: {
                          directory_access: {
                            require_confirmation_for_write: checked,
                          },
                        },
                      },
                    })
                  }
                />
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--theme-text)]">
                    删除前确认
                  </h4>
                  <p className="mt-1 text-xs text-[var(--theme-muted)]">
                    删除、清空或不可恢复操作前必须二次确认。
                  </p>
                </div>
                <Switch
                  checked={readBoolean(
                    directoryAccessConfig.require_confirmation_for_delete,
                    true,
                  )}
                  onCheckedChange={(checked) =>
                    void saveConfig({
                      config: {
                        security: {
                          directory_access: {
                            require_confirmation_for_delete: checked,
                          },
                        },
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>
        </SettingsSection>
            </>
          )}

          {securityTab === 'website' && (
            <>
              <SettingsSection
                title="网站权限"
                description="仅需登记允许与禁止的站点。"
                icon={LockIcon}
                anchorId="security-website"
              >
          <SettingsRow
            label="站点治理开关"
            description="关闭后只保留已配置策略。"
          >
            <Switch
              checked={readBoolean(websiteAccessConfig.enabled, true)}
              onCheckedChange={(checked) =>
                void saveConfig({
                  config: {
                    security: {
                      website_access: { enabled: checked },
                      website_blocklist: { enabled: checked },
                    },
                  },
                })
              }
            />
          </SettingsRow>
          <SettingsRow
            label="默认策略"
            description="推荐“平衡模式”，逐步沉淀常用站点。"
          >
            <Select
              value={(websiteAccessConfig.mode as string) || 'balanced'}
              onValueChange={(value) =>
                void saveConfig({
                  config: {
                    security: { website_access: { mode: value || 'balanced' } },
                  },
                })
              }
              aria-label="默认策略"
            >
              <SelectTrigger
                className="md:max-w-sm"
                data-testid="permissions_website_mode"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                <SelectList>
                  <SelectItem value="balanced">平衡模式</SelectItem>
                  <SelectItem value="allowlist">仅允许已登记站点</SelectItem>
                  <SelectItem value="ask">每次访问先确认</SelectItem>
                </SelectList>
              </SelectPopup>
            </Select>
          </SettingsRow>
          <div className="grid gap-4 xl:grid-cols-2">
            <div
              className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/50 p-4"
              data-testid="permissions_website_allowlist_panel"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--theme-text)]">
                    允许站点
                  </h3>
                  <p className="mt-1 text-xs text-[var(--theme-muted)]">
                    这些站点可由智能体执行检索、读取或约定范围内的自动化操作。
                  </p>
                </div>
                <span className="rounded-full bg-[var(--theme-panel)] px-2.5 py-1 text-xs text-[var(--theme-muted)]">
                  {allowedDomains.length} 项
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {allowedDomains.length === 0 ? (
                  <span className="text-xs text-[var(--theme-muted)]">
                    尚未添加允许站点
                  </span>
                ) : (
                  allowedDomains.map((item) => (
                    <span
                      key={item}
                      className="flex items-center gap-1 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-2.5 py-1 font-mono text-xs font-medium text-[var(--theme-text)]"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() =>
                          void saveConfig({
                            config: {
                              security: {
                                website_access: {
                                  allowed_domains: allowedDomains.filter(
                                    (domain) => domain !== item,
                                  ),
                                },
                              },
                            },
                          })
                        }
                        className="text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-danger)]"
                        aria-label={`移除允许站点 ${item}`}
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Input
                  value={newAllowedDomain}
                  onChange={(e) => setNewAllowedDomain(e.target.value)}
                  placeholder="例如：oa.lawfirm.com"
                  data-testid="permissions_website_allowlist_input"
                />
                <Button
                  size="sm"
                  onClick={() =>
                    addWebsiteRule(
                      'allowed_domains',
                      newAllowedDomain,
                      setNewAllowedDomain,
                    )
                  }
                  disabled={!newAllowedDomain.trim()}
                  data-testid="permissions_website_allowlist_add"
                >
                  添加
                </Button>
              </div>
            </div>

            <div
              className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/50 p-4"
              data-testid="permissions_website_blocklist_panel"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--theme-text)]">
                    禁止站点
                  </h3>
                  <p className="mt-1 text-xs text-[var(--theme-muted)]">
                    这些站点不能被自动读取、点击、上传、下载或提交。
                  </p>
                </div>
                <span className="rounded-full bg-[var(--theme-panel)] px-2.5 py-1 text-xs text-[var(--theme-muted)]">
                  {blockedDomains.length} 项
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {blockedDomains.length === 0 ? (
                  <span className="text-xs text-[var(--theme-muted)]">
                    尚未添加禁止站点
                  </span>
                ) : (
                  blockedDomains.map((item) => (
                    <span
                      key={item}
                      className="flex items-center gap-1 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-2.5 py-1 font-mono text-xs font-medium text-[var(--theme-text)]"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => {
                          const nextBlocked = blockedDomains.filter(
                            (domain) => domain !== item,
                          )
                          void saveConfig({
                            config: {
                              security: {
                                website_access: {
                                  blocked_domains: nextBlocked,
                                },
                                website_blocklist: {
                                  domains: nextBlocked,
                                },
                              },
                            },
                          })
                        }}
                        className="text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-danger)]"
                        aria-label={`移除禁止站点 ${item}`}
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Input
                  value={newBlockedDomain}
                  onChange={(e) => setNewBlockedDomain(e.target.value)}
                  placeholder="例如：mail.qq.com"
                  data-testid="permissions_website_blocklist_input"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    addWebsiteRule(
                      'blocked_domains',
                      newBlockedDomain,
                      setNewBlockedDomain,
                    )
                  }
                  disabled={!newBlockedDomain.trim()}
                  data-testid="permissions_website_blocklist_add"
                >
                  添加
                </Button>
              </div>
            </div>
          </div>
        </SettingsSection>
            </>
          )}

          {securityTab === 'risk' && (
            <>
              <SettingsSection
                title="高风险动作"
                description="危险动作执行前是否需确认。"
                icon={LockIcon}
                anchorId="security-risk"
              >
          <div
            className="space-y-3"
            data-testid="permissions_danger_actions_panel"
          >
            {dangerActions.map((item) => (
              <div
                key={item.key}
                className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/50 p-4"
                data-testid={`permissions_danger_action_${item.key}`}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="max-w-2xl">
                    <h3 className="text-sm font-semibold text-[var(--theme-text)]">
                      {item.label}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--theme-muted)]">
                      {item.description}
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:min-w-[360px]">
                    <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[var(--theme-text)]">
                            执行前确认
                          </p>
                          <p className="mt-1 text-xs text-[var(--theme-muted)]">
                            触发时先弹确认层。
                          </p>
                        </div>
                        <Switch
                          checked={readBoolean(
                            confirmationRules[item.key],
                            item.key !== 'download',
                          )}
                          onCheckedChange={(checked) =>
                            void saveConfig({
                              config: {
                                security: {
                                  risk_controls: {
                                    require_confirmation: {
                                      [item.key]: checked,
                                    },
                                  },
                                },
                              },
                            })
                          }
                          data-testid={`permissions_danger_action_${item.key}_confirm`}
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[var(--theme-text)]">
                            强制审批
                          </p>
                          <p className="mt-1 text-xs text-[var(--theme-muted)]">
                            交由管理员或审批流处理。
                          </p>
                        </div>
                        <Switch
                          checked={readBoolean(approvalRules[item.key], false)}
                          onCheckedChange={(checked) =>
                            void saveConfig({
                              config: {
                                security: {
                                  risk_controls: {
                                    require_approval: {
                                      [item.key]: checked,
                                    },
                                  },
                                },
                              },
                            })
                          }
                          data-testid={`permissions_danger_action_${item.key}_approval`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          title="审批机制"
          description="为需人工把关的动作统一审批与超时。"
          icon={LockIcon}
        >
          <SettingsRow
            label="审批模式"
            description="手动需确认；自动放行；关闭跳过。"
          >
            <Select
              value={(approvalsConfig.mode as string) || 'manual'}
              onValueChange={(value) =>
                void saveConfig({
                  config: { approvals: { mode: value || 'manual' } },
                })
              }
              aria-label="审批模式"
            >
              <SelectTrigger
                className="md:max-w-sm"
                data-testid="permissions_approval_mode"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                <SelectList>
                  <SelectItem value="manual">手动确认</SelectItem>
                  <SelectItem value="auto">自动批准</SelectItem>
                  <SelectItem value="off">关闭审批</SelectItem>
                </SelectList>
              </SelectPopup>
            </Select>
          </SettingsRow>
          <SettingsRow
            label="审批超时（秒）"
            description="超时后自动拒绝。"
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
              data-testid="permissions_approval_timeout"
            />
          </SettingsRow>
        </SettingsSection>
            </>
          )}

          {securityTab === 'tools' && (
            <>
              <SettingsSection
                title="安全基线"
                description="建议保持开启。"
                icon={LockIcon}
              >
                <SettingsRow
            label="脱敏密钥"
            description="在日志与界面回显中遮罩密钥。"
          >
            <Switch
              checked={readBoolean(securityConfig.redact_secrets, true)}
              onCheckedChange={(checked) =>
                void saveConfig({
                  config: { security: { redact_secrets: checked } },
                })
              }
              data-testid="permissions_security_redact_secrets"
            />
          </SettingsRow>
          <SettingsRow
            label="命令安全扫描"
            description="用规则阻止危险的终端与脚本行为。"
          >
            <Switch
              checked={readBoolean(securityConfig.tirith_enabled, true)}
              onCheckedChange={(checked) =>
                void saveConfig({
                  config: { security: { tirith_enabled: checked } },
                })
              }
              data-testid="permissions_security_tirith_enabled"
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection
          title="工具集"
          description="默认开放给智能体的工具范围。"
          icon={LockIcon}
        >
          <SettingsRow
            label="启用的工具集"
            description="移除以撤销该组访问权限。"
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
          title="代码执行"
          description="沙箱代码与工具执行限制。"
          icon={LockIcon}
        >
          <SettingsRow
            label="执行超时（秒）"
            description="单块代码最大秒数。"
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
            description="每轮工具调用上限。"
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
          description="推理强度与详细程度。"
          icon={LockIcon}
        >
          <SettingsRow
            label="推理强度"
            description="回复前思考时间。"
          >
            <Select
              value={(agentConfig.reasoning_effort as string) || 'medium'}
              onValueChange={(value) =>
                void saveConfig({
                  config: { agent: { reasoning_effort: value || 'medium' } },
                })
              }
              aria-label="推理强度"
            >
              <SelectTrigger className="md:max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                <SelectList>
                  <SelectItem value="low">低</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                </SelectList>
              </SelectPopup>
            </Select>
          </SettingsRow>
          <SettingsRow
            label="详细模式"
            description="显示工具输出与内部步骤。"
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
          description="绕过安全扫描且永不要求审批的命令。"
          icon={LockIcon}
        >
          <SettingsRow
            label="允许的命令"
            description="准确命令名，如 git、npm。不支持通配符。"
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

        {/* ── Quick Commands ─────────────────────────────────────── */}
        <SettingsSection
          title="快捷命令"
          description="输入 /key 展开为完整内容。"
          icon={LockIcon}
        >
          <SettingsRow
            label="快捷方式"
            description="键为命令名（不带斜杠），值为展开文本。"
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
          )}
          </div>
        )}
      </>
    )
  }

  const renderSmartRouting = () => (
    <SettingsSection
      title="智能模型路由"
      description="简单查询走更便宜模型。"
      icon={SparklesIcon}
    >
      <SettingsRow
        label="启用智能路由"
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
        <Select
          value={(smartRouting.cheap_model as string) || null}
          onValueChange={(value) =>
            void saveConfig({
              config: { smart_model_routing: { cheap_model: value || '' } },
            })
          }
          aria-label="经济型模型"
        >
          <SelectTrigger className="md:max-w-sm">
            <SelectValue placeholder="选择模型" />
          </SelectTrigger>
          <SelectPopup>
            <SelectList>
              <SelectItem value={null}>选择模型</SelectItem>
              {availableModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.id}
                </SelectItem>
              ))}
            </SelectList>
          </SelectPopup>
        </Select>
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
        description="智能体语音输出。"
        icon={VolumeHighIcon}
      >
        <SettingsRow
          label="TTS 服务提供方"
          description="TTS 引擎。"
        >
          <Select
            value={ttsProvider}
            onValueChange={(value) =>
              void saveConfig({
                config: { tts: { provider: value || 'edge' } },
              })
            }
            aria-label="TTS 服务提供方"
          >
            <SelectTrigger className="md:max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectList>
                <SelectItem value="edge">Edge TTS（免费）</SelectItem>
                <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                <SelectItem value="openai">OpenAI TTS</SelectItem>
                <SelectItem value="neutts">NeuTTS</SelectItem>
              </SelectList>
            </SelectPopup>
          </Select>
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
              <Select
                value={(ttsOpenAi.voice as string) || 'alloy'}
                onValueChange={(value) =>
                  void saveConfig({
                    config: { tts: { openai: { voice: value || 'alloy' } } },
                  })
                }
                aria-label="OpenAI TTS 语音"
              >
                <SelectTrigger className="md:max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  <SelectList>
                    {['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].map(
                      (voice) => (
                        <SelectItem key={voice} value={voice}>
                          {voice}
                        </SelectItem>
                      ),
                    )}
                  </SelectList>
                </SelectPopup>
              </Select>
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
        description="语音输入识别。"
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
          description="语音引擎。"
        >
          <Select
            value={sttProvider}
            onValueChange={(value) =>
              void saveConfig({
                config: { stt: { provider: value || 'local' } },
              })
            }
            aria-label="STT 服务提供方"
          >
            <SelectTrigger className="md:max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectList>
                <SelectItem value="local">本地（Whisper）</SelectItem>
                <SelectItem value="openai">OpenAI Whisper API</SelectItem>
              </SelectList>
            </SelectPopup>
          </Select>
        </SettingsRow>
        {sttProvider === 'local' && (
          <SettingsRow
            label="模型大小"
            description="tiny, base, small, medium, large"
          >
            <Select
              value={(sttLocal.model_size as string) || 'base'}
              onValueChange={(value) =>
                void saveConfig({
                  config: { stt: { local: { model_size: value || 'base' } } },
                })
              }
              aria-label="模型大小"
            >
              <SelectTrigger className="md:max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                <SelectList>
                  {['tiny', 'base', 'small', 'medium', 'large'].map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectList>
              </SelectPopup>
            </Select>
          </SettingsRow>
        )}
      </SettingsSection>
    </div>
  )

  const renderDisplay = () => (
    <SettingsSection
      title="显示"
      description="CLI 显示偏好。"
      icon={PaintBoardIcon}
    >
      <SettingsRow label="个性" description="回复风格。">
        <Select
          value={(displayConfig.personality as string) || 'default'}
          onValueChange={(value) =>
            void saveConfig({
              config: { display: { personality: value || 'default' } },
            })
          }
          aria-label="个性"
        >
          <SelectTrigger className="md:max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            <SelectList>
              {['default', 'concise', 'verbose', 'creative'].map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectList>
          </SelectPopup>
        </Select>
      </SettingsRow>
      <SettingsRow
        label="流式输出"
        description="逐 token 输出。"
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
        description="显示中途状态消息。"
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
        description="展示模型推理块。"
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
      <SettingsRow label="显示费用" description="显示费用元数据。">
        <Switch
          checked={readBoolean(displayConfig.show_cost, false)}
          onCheckedChange={(checked) =>
            void saveConfig({ config: { display: { show_cost: checked } } })
          }
        />
      </SettingsRow>
      <SettingsRow label="紧凑模式" description="更紧凑的布局。">
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
        description="按平台覆盖工具进度显示。"
      >
        <div className="flex flex-col gap-2">
          {Object.entries(platformOverrides).map(([platform, overrides]) => (
            <div key={platform} className="flex items-center gap-2">
              <span
                className="w-24 shrink-0 text-xs font-mono text-[var(--theme-text)]"
              >
                {platform}
              </span>
              <Select
                value={(overrides.tool_progress) || 'all'}
                onValueChange={(value) => {
                  const updated = {
                    ...platformOverrides,
                    [platform]: {
                      ...overrides,
                      tool_progress: value || 'all',
                    },
                  }
                  void saveConfig({ config: { display: { platforms: updated } } })
                }}
                aria-label={`${platform} 工具进度`}
              >
                <SelectTrigger className="md:max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  <SelectList>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="new">仅新消息</SelectItem>
                    <SelectItem value="verbose">详细</SelectItem>
                    <SelectItem value="off">关闭</SelectItem>
                  </SelectList>
                </SelectPopup>
              </Select>
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
