import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  AiUserIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Clock01Icon,
  DashboardSquare01Icon,
  File01Icon,
  Moon02Icon,
  Settings01Icon,
  Sun02Icon,
  TimelineIcon,
} from '@hugeicons/core-free-icons'
import { AnimatePresence, motion } from 'motion/react'
import { memo, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { CHAT_OPEN_SETTINGS_EVENT } from '../chat-events'
import { useChatSettings as useSidebarSettings } from '../hooks/use-chat-settings'
import { useDeleteSession } from '../hooks/use-delete-session'
import { useRenameSession } from '../hooks/use-rename-session'
import { ProvidersDialog } from './providers-dialog'
import { SessionRenameDialog } from './sidebar/session-rename-dialog'
import { SessionDeleteDialog } from './sidebar/session-delete-dialog'
import { SidebarSessions } from './sidebar/sidebar-sessions'
import type { ChatOpenSettingsDetail } from '../chat-events'
import type { SessionMeta } from '../types'
import type {SettingsThemeMode} from '@/hooks/use-settings';
import {
  
  applyTheme,
  getStoredThemeMode,
  useSettingsStore
} from '@/hooks/use-settings'
import { SettingsDialog } from '@/components/settings-dialog'
import {
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { StatusIndicator } from '@/components/status-indicator'

type WorkspaceStats = Record<string, unknown>

function ThemeToggleMini() {
  const [mode, setMode] = useState<SettingsThemeMode>(getStoredThemeMode)
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const isLight =
    mode === 'light' ||
    (mode === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: light)').matches)

  function toggleTheme() {
    const next: SettingsThemeMode = isLight ? 'dark' : 'light'
    setMode(next)
    applyTheme(next)
    updateSettings({ theme: next })
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
      style={{ color: 'var(--theme-muted)' }}
      aria-label={isLight ? '切换到深色模式' : '切换到浅色模式'}
      title={isLight ? '切换到深色模式' : '切换到浅色模式'}
    >
      <HugeiconsIcon icon={isLight ? Moon02Icon : Sun02Icon} size={16} strokeWidth={1.5} />
    </button>
  )
}

type ChatSidebarProps = {
  sessions: Array<SessionMeta>
  activeFriendlyId: string
  creatingSession: boolean
  onCreateSession: () => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  onSelectSession?: () => void
  onActiveSessionDelete?: () => void
  sessionsLoading: boolean
  sessionsFetching: boolean
  sessionsError: string | null
  onRetrySessions: () => void
}

// ── Reusable nav item ───────────────────────────────────────────────────

type NavItemDef = {
  kind: 'link' | 'button'
  to?: string
  icon: unknown
  label: string
  testId?: string
  active: boolean
  onClick?: () => void
  disabled?: boolean
  badge?: 'error-dot' | string | number
  dataTour?: string
}

export async function fetchWorkspaceStats(): Promise<WorkspaceStats | null> {
  try {
    const response = await fetch('/api/workspace/stats')
    if (!response.ok) return null
    return (await response.json()) as WorkspaceStats
  } catch {
    return null
  }
}

export async function fetchWorkspaceProjectShortcuts(): Promise<Array<never>> {
  return []
}

function NavItem({
  item,
  isCollapsed,
  transition,
  onSelectSession,
}: {
  item: NavItemDef
  isCollapsed: boolean
  transition: Record<string, unknown>
  onSelectSession?: () => void
}) {
  const cls = cn(
    buttonVariants({ variant: 'ghost', size: 'sm' }),
    'w-full h-auto min-h-11 gap-2.5 py-2 md:min-h-0',
    isCollapsed ? 'justify-center px-0' : 'justify-start px-3',
    item.active
      ? 'bg-accent-500/10 text-accent-500 hover:bg-accent-50 dark:hover:bg-accent-900/300/15'
      : 'text-primary-900 hover:bg-primary-200 dark:hover:bg-primary-800',
  )

  const iconEl =
    item.badge === 'error-dot' ? (
      <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
        <HugeiconsIcon
          icon={item.icon as any}
          size={20}
          strokeWidth={1.5}
          className="size-5 shrink-0"
        />
        <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-red-500" />
      </span>
    ) : (
      <HugeiconsIcon
        icon={item.icon as any}
        size={20}
        strokeWidth={1.5}
        className="size-5 shrink-0"
      />
    )

  const labelEl = (
    <AnimatePresence initial={false} mode="wait">
      {!isCollapsed ? (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
          className="flex min-w-0 items-center gap-2"
        >
          <span className="overflow-hidden whitespace-nowrap">
            {item.label}
          </span>
          {item.badge && item.badge !== 'error-dot' ? (
            <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-full border border-primary-700 bg-primary-900 px-2 py-0.5 text-[10px] font-semibold leading-none text-primary-300">
              {item.badge}
            </span>
          ) : null}
        </motion.span>
      ) : null}
    </AnimatePresence>
  )

  const handleSelect = () => {
    onSelectSession?.()
  }

  if (item.kind === 'link') {
    if (isCollapsed) {
      return (
        <TooltipProvider>
          <TooltipRoot>
            <TooltipTrigger
              render={
                <Link
                  to={item.to}
                  onClick={handleSelect}
                  className={cls}
                  data-tour={item.dataTour}
                  data-testid={item.testId}
                >
                  {iconEl}
                </Link>
              }
            />
            <TooltipContent side="right">{item.label}</TooltipContent>
          </TooltipRoot>
        </TooltipProvider>
      )
    }
    return (
      <Link
        to={item.to}
        onClick={handleSelect}
        className={cls}
        data-tour={item.dataTour}
        data-testid={item.testId}
      >
        {iconEl}
        {labelEl}
      </Link>
    )
  }

  if (isCollapsed) {
    return (
      <TooltipProvider>
        <TooltipRoot>
          <TooltipTrigger
            render={
              <Button
                disabled={item.disabled}
                variant="ghost"
                size="sm"
                onClick={() => {
                  item.onClick?.()
                  handleSelect()
                }}
                className={cls}
                data-tour={item.dataTour}
              >
                {iconEl}
              </Button>
            }
          />
          <TooltipContent side="right">{item.label}</TooltipContent>
        </TooltipRoot>
      </TooltipProvider>
    )
  }

  return (
    <Button
      disabled={item.disabled}
      variant="ghost"
      size="sm"
      onClick={() => {
        item.onClick?.()
        handleSelect()
      }}
      className={cls}
      data-tour={item.dataTour}
    >
      {iconEl}
      {labelEl}
    </Button>
  )
}

// ── New session button ──────────────────────────────────────────────────

function NewSessionButton({
  isCollapsed,
  creatingSession,
  onSelect,
  transition,
}: {
  isCollapsed: boolean
  creatingSession: boolean
  onSelect: () => void
  transition: Record<string, unknown>
}) {
  const cls = cn(
    'w-full h-10 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] text-[var(--theme-text)]',
    'hover:bg-[var(--theme-hover)] transition-colors justify-center gap-2',
    isCollapsed && 'px-0',
    !isCollapsed && 'px-3',
    creatingSession && 'opacity-60 pointer-events-none',
  )

  const iconEl = (
    <span
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full border border-current',
        'text-[var(--theme-muted)]',
      )}
    >
      <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={1.5} />
    </span>
  )

  const labelEl = (
    <AnimatePresence initial={false} mode="wait">
      {!isCollapsed ? (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
          className="text-sm font-medium"
        >
          新会话
        </motion.span>
      ) : null}
    </AnimatePresence>
  )

  if (isCollapsed) {
    return (
      <TooltipProvider>
        <TooltipRoot>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                onClick={onSelect}
                className={cls}
                disabled={creatingSession}
                aria-label="新会话"
              >
                {iconEl}
              </Button>
            }
          />
          <TooltipContent side="right">新会话</TooltipContent>
        </TooltipRoot>
      </TooltipProvider>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onSelect}
      className={cls}
      disabled={creatingSession}
    >
      {iconEl}
      {labelEl}
    </Button>
  )
}

// ── Main component ──────────────────────────────────────────────────────

function ChatSidebarComponent({
  sessions,
  activeFriendlyId,
  creatingSession,
  onCreateSession,
  isCollapsed,
  onToggleCollapse,
  onSelectSession,
  onActiveSessionDelete,
  sessionsLoading,
  sessionsFetching,
  sessionsError,
  onRetrySessions,
}: ChatSidebarProps) {
  const { settingsOpen, settingsSection, setSettingsOpen, handleOpenSettings } =
    useSidebarSettings()
  const { deleteSession } = useDeleteSession()
  const { renameSession } = useRenameSession()
  const pathname = useRouterState({
    select: function selectPathname(state) {
      return state.location.pathname
    },
  })
  const navigate = useNavigate()

  useEffect(() => {
    function handleOpenSettingsEvent(event: Event) {
      const detail = (event as CustomEvent<ChatOpenSettingsDetail>).detail
      handleOpenSettings(
        detail?.section === 'appearance' ? 'appearance' : 'hermes',
      )
    }

    window.addEventListener(CHAT_OPEN_SETTINGS_EVENT, handleOpenSettingsEvent)
    return () => {
      window.removeEventListener(
        CHAT_OPEN_SETTINGS_EVENT,
        handleOpenSettingsEvent,
      )
    }
  }, [handleOpenSettings])

  // Route active states
  const isDashboardActive = pathname === '/dashboard'
  const isAgentsActive = pathname === '/agents'
  const isFilesActive = pathname === '/files'
  const isJobsActive = pathname === '/jobs'
  const isAuditActive = pathname === '/audit'

  const transition = {
    duration: 0.15,
    ease: isCollapsed ? 'easeIn' : 'easeOut',
  } as const

  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renameSessionKey, setRenameSessionKey] = useState<string | null>(null)
  const [renameFriendlyId, setRenameFriendlyId] = useState<string | null>(null)
  const [renameSessionTitle, setRenameSessionTitle] = useState('')

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteSessionKey, setDeleteSessionKey] = useState<string | null>(null)
  const [deleteFriendlyId, setDeleteFriendlyId] = useState<string | null>(null)
  const [deleteSessionTitle, setDeleteSessionTitle] = useState('')
  const [providersOpen, setProvidersOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const sidebarRef = useRef<HTMLElement | null>(null)
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null)

  function handleOpenRename(session: SessionMeta) {
    setRenameSessionKey(session.key)
    setRenameFriendlyId(session.friendlyId)
    setRenameSessionTitle(
      session.label || session.title || session.derivedTitle || '',
    )
    setRenameDialogOpen(true)
  }

  function handleSaveRename(newTitle: string) {
    if (renameSessionKey) {
      void renameSession(renameSessionKey, renameFriendlyId, newTitle)
    }
    setRenameDialogOpen(false)
    setRenameSessionKey(null)
    setRenameFriendlyId(null)
  }

  function handleOpenDelete(session: SessionMeta) {
    setDeleteSessionKey(session.key)
    setDeleteFriendlyId(session.friendlyId)
    setDeleteSessionTitle(
      session.label ||
        session.title ||
        session.derivedTitle ||
        session.friendlyId,
    )
    setDeleteDialogOpen(true)
  }

  function handleConfirmDelete() {
    if (deleteSessionKey && deleteFriendlyId) {
      const isActive = deleteFriendlyId === activeFriendlyId
      if (isActive && onActiveSessionDelete) {
        onActiveSessionDelete()
      }
      void deleteSession(deleteSessionKey, deleteFriendlyId, isActive)
    }
    setDeleteDialogOpen(false)
    setDeleteSessionKey(null)
    setDeleteFriendlyId(null)
  }

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const isVisuallyCollapsed = isCollapsed

  function handleSidebarToggle() {
    onToggleCollapse()
  }

  const asideProps = {
    className: cn(
      'border-r h-full overflow-hidden flex flex-col theme-sidebar theme-border',
      isMobile && 'fixed inset-y-0 left-0 z-50 shadow-2xl',
      isMobile && isCollapsed && 'pointer-events-none',
    ),
  }

  useEffect(() => {
    if (!isMobile || isCollapsed) return
    const node = sidebarRef.current
    if (!node) return

    const SWIPE_CLOSE_PX = 64
    const MAX_VERTICAL_DRIFT_PX = 72

    function handleTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1) return
      const touch = event.touches[0]
      swipeStartRef.current = { x: touch.clientX, y: touch.clientY }
    }

    function handleTouchEnd(event: TouchEvent) {
      const start = swipeStartRef.current
      swipeStartRef.current = null
      if (!start || event.changedTouches.length !== 1) return
      const touch = event.changedTouches[0]
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      if (Math.abs(dy) > MAX_VERTICAL_DRIFT_PX) return
      if (dx <= -SWIPE_CLOSE_PX) {
        onToggleCollapse()
      }
    }

    node.addEventListener('touchstart', handleTouchStart, { passive: true })
    node.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      node.removeEventListener('touchstart', handleTouchStart)
      node.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isCollapsed, isMobile, onToggleCollapse])

// ── Nav definitions ─────────────────────────────────────────────────
  const mainNavItems: Array<NavItemDef> = [
    {
      kind: 'link',
      to: '/dashboard',
      icon: DashboardSquare01Icon,
      label: '工作台',
      testId: 'desktop_nav_dashboard',
      active: isDashboardActive,
    },
    {
      kind: 'link',
      to: '/agents',
      icon: AiUserIcon,
      label: '数字员工',
      testId: 'desktop_nav_agents',
      active: isAgentsActive,
    },
    {
      kind: 'link',
      to: '/files',
      icon: File01Icon,
      label: '执行中心',
      testId: 'desktop_nav_files',
      active: isFilesActive,
    },
    {
      kind: 'link',
      to: '/jobs',
      icon: Clock01Icon,
      label: '定时任务',
      testId: 'desktop_nav_jobs',
      active: isJobsActive,
    },
  ]

  const bottomNavItems: Array<NavItemDef> = [
    {
      kind: 'link',
      to: '/audit',
      icon: TimelineIcon,
      label: '权限与安全',
      testId: 'desktop_nav_audit',
      active: isAuditActive,
    },
  ]

  return (
    <motion.aside
      ref={(node) => {
        sidebarRef.current = node
      }}
      initial={false}
      animate={{
        width: isVisuallyCollapsed
          ? isMobile
            ? 0
            : 48
          : isMobile
            ? '85vw'
            : 300,
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        asideProps.className,
        isMobile && isCollapsed && 'pointer-events-none overflow-hidden',
      )}
      data-tour="sidebar-container"
      style={isMobile ? { maxWidth: 360 } : undefined}
      aria-hidden={isMobile && isCollapsed ? true : undefined}
      {...(isMobile && isCollapsed ? { inert: '' as unknown as boolean } : {})}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <motion.div
        layout
        transition={{ layout: transition }}
        className="relative flex h-12 items-center px-2"
      >
        <AnimatePresence initial={false}>
          {!isVisuallyCollapsed ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
            >
              <Link
                to="/dashboard"
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'w-full pl-1.5 justify-start gap-2',
                )}
              >
                <img
                  src="/ti-work-logo.svg"
                  alt="Ti Work"
                  className="size-6 rounded-lg"
                />
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="text-sm font-semibold tracking-tight"
                    style={{ color: 'var(--theme-text)' }}
                  >
                    Ti Work
                  </span>
                  <StatusIndicator inline />
                </span>
              </Link>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <TooltipProvider>
          <TooltipRoot>
            <TooltipTrigger
              onClick={handleSidebarToggle}
              render={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={
                    isVisuallyCollapsed ? '展开侧栏' : '收起侧栏'
                  }
                  className="absolute right-2 top-1/2 shrink-0 -translate-y-1/2 opacity-80 hover:opacity-100"
                  data-tour="sidebar-collapse-toggle"
                >
                  {isVisuallyCollapsed ? (
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      size={18}
                      strokeWidth={1.75}
                    />
                  ) : (
                    <HugeiconsIcon
                      icon={ArrowLeft01Icon}
                      size={18}
                      strokeWidth={1.75}
                    />
                  )}
                </Button>
              }
            />
            <TooltipContent side="right">
              {isVisuallyCollapsed ? '展开侧栏' : '收起侧栏'}
            </TooltipContent>
          </TooltipRoot>
        </TooltipProvider>
      </motion.div>

      {/* ── Scrollable body: nav + sessions ─────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin flex flex-col">
        {/* Navigation sections */}
        <div className={cn('shrink-0 space-y-0.5 px-2', isMobile && 'order-2')}>
          {/* 常驻新会话入口：位于所有菜单上方，折叠时保留为图标 */}
          <NewSessionButton
            isCollapsed={isVisuallyCollapsed}
            creatingSession={creatingSession}
            onSelect={onCreateSession}
            transition={transition}
          />

          <div className="space-y-0.5" data-testid="desktop_nav_main_menu">
            {mainNavItems.map((item) => (
              <motion.div
                key={item.label}
                layout
                transition={{ layout: transition }}
                className="w-full"
              >
                <NavItem
                  item={item}
                  isCollapsed={isVisuallyCollapsed}
                  transition={transition}
                  onSelectSession={onSelectSession}
                />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Sessions list */}
        <div className={cn('shrink-0 mt-1', isMobile && 'order-1')}>
          <AnimatePresence initial={false}>
            {!isVisuallyCollapsed && (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transition}
                className="flex flex-col w-full min-h-0 h-full"
              >
                <div className="flex-1 min-h-0">
                  <SidebarSessions
                    sessions={sessions}
                    activeFriendlyId={activeFriendlyId}
                    onSelect={onSelectSession}
                    onRename={handleOpenRename}
                    onDelete={handleOpenDelete}
                    loading={sessionsLoading}
                    fetching={sessionsFetching}
                    error={sessionsError}
                    onRetry={onRetrySessions}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {/* end scrollable body */}

      {/* ── Footer with User Menu ─────────────────────────────────── */}
      <div
        className="px-2 py-2.5 border-t shrink-0 theme-border theme-panel"
        data-testid="desktop_nav_bottom_menu"
      >
        {/* 权限与安全（常驻右下，置于设置上方） */}
        <div className={cn('flex flex-col', isVisuallyCollapsed ? 'py-0.5' : 'pb-1')}>
          {bottomNavItems.map((item) => (
            <NavItem
              key={item.label}
              item={item}
              isCollapsed={isVisuallyCollapsed}
              transition={transition}
              onSelectSession={onSelectSession}
            />
          ))}
        </div>
        {/* User card + actions */}
        <div
          className={cn(
            'flex items-center rounded-lg transition-colors',
            isVisuallyCollapsed ? 'flex-col gap-2 py-2' : 'gap-2.5 px-2 py-1.5',
          )}
        >
          {/* 设置入口（常驻左下角，替代原头像/名称） */}
          <button
            type="button"
            data-tour="settings"
            data-testid="desktop_nav_settings"
            onClick={function onOpenSettings() {
              navigate({ to: '/settings' })
            }}
            className={cn(
              'flex items-center gap-2.5 rounded-lg py-1 transition-colors hover:bg-primary-200 dark:hover:bg-neutral-800 flex-1 min-w-0',
              isVisuallyCollapsed ? 'justify-center px-0' : 'px-1.5',
            )}
          >
            <HugeiconsIcon icon={Settings01Icon} size={20} strokeWidth={1.5} />
            <AnimatePresence initial={false} mode="wait">
              {!isVisuallyCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                  className="flex-1 min-w-0 flex items-center gap-1.5"
                >
                  <span className="block truncate text-sm font-medium text-primary-900 dark:text-neutral-100">
                    设置
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          {/* Theme toggle */}
          {!isVisuallyCollapsed && (
            <div className="flex items-center">
              <ThemeToggleMini />
            </div>
          )}
        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialSection={settingsSection}
      />

      <ProvidersDialog open={providersOpen} onOpenChange={setProvidersOpen} />

      <SessionRenameDialog
        open={renameDialogOpen}
        onOpenChange={(open) => {
          setRenameDialogOpen(open)
          if (!open) {
            setRenameSessionKey(null)
            setRenameFriendlyId(null)
            setRenameSessionTitle('')
          }
        }}
        sessionTitle={renameSessionTitle}
        onSave={handleSaveRename}
        onCancel={() => {
          setRenameDialogOpen(false)
          setRenameSessionKey(null)
          setRenameFriendlyId(null)
          setRenameSessionTitle('')
        }}
      />

      <SessionDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        sessionTitle={deleteSessionTitle}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </motion.aside>
  )
}

function areSessionsEqual(
  prevSessions: Array<SessionMeta>,
  nextSessions: Array<SessionMeta>,
): boolean {
  if (prevSessions === nextSessions) return true
  if (prevSessions.length !== nextSessions.length) return false
  for (let i = 0; i < prevSessions.length; i += 1) {
    const prev = prevSessions[i]
    const next = nextSessions[i]
    if (prev.key !== next.key) return false
    if (prev.friendlyId !== next.friendlyId) return false
    if (prev.label !== next.label) return false
    if (prev.title !== next.title) return false
    if (prev.derivedTitle !== next.derivedTitle) return false
    if (prev.updatedAt !== next.updatedAt) return false
    if (prev.titleStatus !== next.titleStatus) return false
    if (prev.titleSource !== next.titleSource) return false
    if (prev.titleError !== next.titleError) return false
  }
  return true
}

function areSidebarPropsEqual(
  prevProps: ChatSidebarProps,
  nextProps: ChatSidebarProps,
): boolean {
  if (prevProps.activeFriendlyId !== nextProps.activeFriendlyId) return false
  if (prevProps.creatingSession !== nextProps.creatingSession) return false
  if (prevProps.isCollapsed !== nextProps.isCollapsed) return false
  if (prevProps.sessionsLoading !== nextProps.sessionsLoading) return false
  if (prevProps.sessionsFetching !== nextProps.sessionsFetching) return false
  if (prevProps.sessionsError !== nextProps.sessionsError) return false
  if (prevProps.onRetrySessions !== nextProps.onRetrySessions) return false
  if (!areSessionsEqual(prevProps.sessions, nextProps.sessions)) return false
  return true
}

const MemoizedChatSidebar = memo(ChatSidebarComponent, areSidebarPropsEqual)

export { MemoizedChatSidebar as ChatSidebar }
