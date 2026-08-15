'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  BrainIcon,
  Chat01Icon,
  CommandLineIcon,
  File01Icon,
  PuzzleIcon,
  Settings01Icon,
} from '@hugeicons/core-free-icons'
import type React from 'react'
import type { SessionMeta } from '@/screens/chat/types'
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
} from '@/components/ui/command'
import {
  CHAT_OPEN_SETTINGS_EVENT,
  CHAT_PENDING_COMMAND_STORAGE_KEY,
  CHAT_RUN_COMMAND_EVENT,
} from '@/screens/chat/chat-events'
import { cn } from '@/lib/utils'

type CommandPaletteProps = {
  pathname: string
  sessions: Array<SessionMeta>
}

type CommandAction = {
  id: string
  group: '页面' | '最近会话' | '斜杠命令'
  label: string
  keywords: string
  shortcut?: string
  icon: React.ComponentProps<
    typeof import('@hugeicons/react').HugeiconsIcon
  >['icon']
  onSelect: () => void
}

type ScoredAction = CommandAction & {
  score: number
}

const SCREEN_GROUP_ORDER = [
  '页面',
  '最近会话',
  '斜杠命令',
] as const

function getSessionLabel(session: SessionMeta) {
  return (
    session.label ||
    session.title ||
    session.derivedTitle ||
    session.friendlyId ||
    session.key
  )
}

function scoreCommandAction(action: CommandAction, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return 1

  const haystack = `${action.label} ${action.keywords}`.toLowerCase()
  const directIndex = haystack.indexOf(normalizedQuery)
  if (directIndex >= 0) {
    return (
      400 - directIndex - Math.max(0, haystack.length - normalizedQuery.length)
    )
  }

  let queryIndex = 0
  let gaps = 0
  let lastMatch = -1

  for (
    let i = 0;
    i < haystack.length && queryIndex < normalizedQuery.length;
    i += 1
  ) {
    if (haystack[i] !== normalizedQuery[queryIndex]) continue
    if (lastMatch >= 0) gaps += Math.max(0, i - lastMatch - 1)
    lastMatch = i
    queryIndex += 1
  }

  if (queryIndex !== normalizedQuery.length) return 0
  return 180 - gaps - Math.max(0, haystack.length - normalizedQuery.length)
}

export function CommandPalette({ pathname, sessions }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(min-width: 768px)').matches
  })
  const isMacPlatform = useMemo(() => {
    if (typeof navigator === 'undefined') return true
    return navigator.platform.toLowerCase().includes('mac')
  }, [])

  const runSlashCommand = (command: string) => {
    if (command === '/new') {
      void navigate({ to: '/chat' })
      return
    }

    if (command === '/skills') {
      void navigate({ to: '/skills' })
      return
    }

    if (command === '/model' || command === '/skin') {
      const section = command === '/skin' ? 'appearance' : 'hermes'
      if (pathname.startsWith('/chat') || pathname === '/') {
        window.dispatchEvent(
          new CustomEvent(CHAT_OPEN_SETTINGS_EVENT, {
            detail: { section },
          }),
        )
        return
      }

      window.sessionStorage.setItem(CHAT_PENDING_COMMAND_STORAGE_KEY, command)
      void navigate({ to: '/chat' })
      return
    }

    if (pathname.startsWith('/chat') || pathname === '/') {
      window.dispatchEvent(
        new CustomEvent(CHAT_RUN_COMMAND_EVENT, {
          detail: { command },
        }),
      )
      return
    }

    window.sessionStorage.setItem(CHAT_PENDING_COMMAND_STORAGE_KEY, command)
    void navigate({ to: '/chat' })
  }

  const screenActions = useMemo<Array<CommandAction>>(
    () => [
      {
        id: 'screen-chat',
        group: '页面',
        label: '会话',
        keywords: 'conversation new session home chat',
        shortcut: '前往',
        icon: Chat01Icon,
        onSelect: () => void navigate({ to: '/chat' }),
      },
      {
        id: 'screen-files',
        group: '页面',
        label: '文件',
        keywords: 'workspace editor browser files',
        shortcut: '前往',
        icon: File01Icon,
        onSelect: () => void navigate({ to: '/files' }),
      },
      {
        id: 'screen-terminal',
        group: '页面',
        label: '终端',
        keywords: 'console shell command line terminal',
        shortcut: '前往',
        icon: CommandLineIcon,
        onSelect: () => void navigate({ to: '/terminal' }),
      },
      {
        id: 'screen-memory',
        group: '页面',
        label: '记忆',
        keywords: 'knowledge durable memory notes memory',
        shortcut: '前往',
        icon: BrainIcon,
        onSelect: () => void navigate({ to: '/memory' }),
      },
      {
        id: 'screen-skills',
        group: '页面',
        label: '技能',
        keywords: 'install tools capabilities skills',
        shortcut: '前往',
        icon: PuzzleIcon,
        onSelect: () => void navigate({ to: '/skills' }),
      },
      {
        id: 'screen-settings',
        group: '页面',
        label: '设置',
        keywords: 'preferences configuration settings',
        shortcut: '前往',
        icon: Settings01Icon,
        onSelect: () => void navigate({ to: '/settings' }),
      },
    ],
    [navigate],
  )

  const recentSessionActions = useMemo<Array<CommandAction>>(
    () =>
      [...sessions]
        .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
        .slice(0, 5)
        .map((session) => ({
          id: `session-${session.key}`,
          group: '最近会话',
          label: getSessionLabel(session),
          keywords: `${session.key} ${session.friendlyId} ${session.title ?? ''} ${session.derivedTitle ?? ''}`,
          shortcut: '打开',
          icon: Chat01Icon,
          onSelect: () =>
            void navigate({
              to: '/chat/$sessionKey',
              params: { sessionKey: session.key },
            }),
        })),
    [navigate, sessions],
  )

  const slashCommandActions = useMemo<Array<CommandAction>>(
    () => [
      {
        id: 'slash-new',
        group: '斜杠命令',
        label: '/new',
        keywords: 'start new session conversation',
          shortcut: '运行',
        icon: CommandLineIcon,
        onSelect: () => runSlashCommand('/new'),
      },
      {
        id: 'slash-clear',
        group: '斜杠命令',
        label: '/clear',
        keywords: 'clear current chat history conversation',
        shortcut: '运行',
        icon: CommandLineIcon,
        onSelect: () => runSlashCommand('/clear'),
      },
      {
        id: 'slash-model',
        group: '斜杠命令',
        label: '/model',
        keywords: 'open model picker settings hermes provider',
        shortcut: '运行',
        icon: CommandLineIcon,
        onSelect: () => runSlashCommand('/model'),
      },
      {
        id: 'slash-skills',
        group: '斜杠命令',
        label: '/skills',
        keywords: 'browse manage skills page',
        shortcut: '运行',
        icon: CommandLineIcon,
        onSelect: () => runSlashCommand('/skills'),
      },
      {
        id: 'slash-skin',
        group: '斜杠命令',
        label: '/skin',
        keywords: 'open appearance settings theme',
        shortcut: '运行',
        icon: CommandLineIcon,
        onSelect: () => runSlashCommand('/skin'),
      },
      {
        id: 'slash-save',
        group: '斜杠命令',
        label: '/save',
        keywords: 'export current conversation transcript',
        shortcut: '运行',
        icon: CommandLineIcon,
        onSelect: () => runSlashCommand('/save'),
      },
    ],
    [pathname],
  )

  const actions = useMemo(
    () => [...screenActions, ...recentSessionActions, ...slashCommandActions],
    [recentSessionActions, screenActions, slashCommandActions],
  )

  const filteredActions = useMemo<Array<ScoredAction>>(() => {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) {
      return actions.map((action) => ({ ...action, score: 1 }))
    }

    return actions
      .map((action) => ({
        ...action,
        score: scoreCommandAction(action, normalizedQuery),
      }))
      .filter((action) => action.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score || left.label.localeCompare(right.label),
      )
  }, [actions, query])

  const groupedActions = useMemo(
    () =>
      SCREEN_GROUP_ORDER.map((group) => ({
        group,
        items: filteredActions.filter((action) => action.group === group),
      })).filter((group) => group.items.length > 0),
    [filteredActions],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(min-width: 768px)')
    const updateDesktop = () => setIsDesktop(media.matches)
    updateDesktop()
    media.addEventListener('change', updateDesktop)
    return () => media.removeEventListener('change', updateDesktop)
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query, open])

  useEffect(() => {
    if (selectedIndex < filteredActions.length) return
    setSelectedIndex(Math.max(0, filteredActions.length - 1))
  }, [filteredActions.length, selectedIndex])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || !isDesktop) return
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) {
        return
      }
      if (event.key.toLowerCase() !== 'k') return

      event.preventDefault()
      setOpen((current) => !current)
    }

    window.addEventListener('keydown', handleShortcut, true)
    return () => window.removeEventListener('keydown', handleShortcut, true)
  }, [isDesktop])

  useEffect(() => {
    if (!open) return

    function handleOpenKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return

      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (filteredActions.length === 0) return
        setSelectedIndex((current) => (current + 1) % filteredActions.length)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (filteredActions.length === 0) return
        setSelectedIndex(
          (current) =>
            (current - 1 + filteredActions.length) % filteredActions.length,
        )
        return
      }

      if (event.key === 'Enter') {
        if (filteredActions.length === 0) return
        event.preventDefault()
        filteredActions[selectedIndex]?.onSelect()
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleOpenKey, true)
    return () => window.removeEventListener('keydown', handleOpenKey, true)
  }, [filteredActions, open, selectedIndex])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
  }, [open])

  if (!isDesktop) return null

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandDialogPopup className="mx-auto self-start">
        <Command
          items={filteredActions}
          value={query}
          onValueChange={setQuery}
          mode="none"
        >
          <CommandInput placeholder="搜索页面、会话和命令" />
          <CommandPanel className="flex min-h-0 flex-1 flex-col">
            {groupedActions.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-primary-600">
                没有找到“{query.trim()}”相关结果。
              </div>
            ) : (
              <CommandList className="h-72 min-h-0">
                {groupedActions.map((group, groupIndex) => (
                  <Fragment key={group.group}>
                    <CommandGroup items={group.items}>
                      <CommandGroupLabel>{group.group}</CommandGroupLabel>
                      {group.items.map((action) => {
                        const actionIndex = filteredActions.findIndex(
                          (item) => item.id === action.id,
                        )
                        const isSelected = actionIndex === selectedIndex
                        return (
                          <CommandItem
                            key={action.id}
                            value={action.label}
                            onMouseMove={() => setSelectedIndex(actionIndex)}
                            onClick={() => {
                              action.onSelect()
                              setOpen(false)
                            }}
                            className={cn(
                              'gap-3 rounded-lg px-3 py-2',
                              isSelected && 'bg-primary-100 text-primary-900',
                            )}
                          >
                            <HugeiconsIcon
                              icon={action.icon}
                              size={18}
                              strokeWidth={1.6}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">
                                {action.label}
                              </div>
                            </div>
                            {action.shortcut ? (
                              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary-500">
                                {action.shortcut}
                              </span>
                            ) : null}
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                    {groupIndex < groupedActions.length - 1 ? (
                      <CommandSeparator />
                    ) : null}
                  </Fragment>
                ))}
              </CommandList>
            )}
          </CommandPanel>
          <CommandFooter>
            <div className="flex items-center gap-4 text-primary-700">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-primary-200 bg-surface px-2 py-1 text-[11px] font-medium text-primary-700">
                  <HugeiconsIcon
                    icon={ArrowUp01Icon}
                    size={14}
                    strokeWidth={1.5}
                  />
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    size={14}
                    strokeWidth={1.5}
                  />
                </span>
                <span>导航</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-primary-200 bg-surface px-2 py-1 text-[11px] font-medium text-primary-700">
                  Enter
                </span>
                <span>选择</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-primary-700">
              <span className="rounded-md border border-primary-200 bg-surface px-2 py-1 text-[11px] font-medium text-primary-700">
                {isMacPlatform ? '⌘K' : 'Ctrl K'}
              </span>
              <span>切换</span>
            </div>
          </CommandFooter>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  )
}
