'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import type { Ref } from 'react'

import { useAutocompleteFilter } from '@/components/ui/autocomplete'
import { Command, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

type SlashCommandDefinition = {
  command: string
  description: string
}

type SlashCommandMenuProps = {
  open: boolean
  query: string
  onSelect: (command: SlashCommandDefinition) => void
}

type SlashCommandMenuHandle = {
  moveSelection: (step: number) => void
  selectActive: () => boolean
}

const SLASH_COMMANDS: Array<SlashCommandDefinition> = [
  { command: '/new', description: '开始新会话' },
  { command: '/clear', description: '清空当前界面并重新开始' },
  { command: '/model', description: '查看或切换当前模型' },
  { command: '/fast', description: '切换快速模式（OpenAI/Anthropic 优先队列）' },
  { command: '/compress', description: '压缩上下文，可选：/compress <关注主题>' },
  { command: '/debug', description: '运行诊断并显示调试信息' },
  { command: '/save', description: '保存当前对话' },
  { command: '/skills', description: '浏览并管理技能' },
  { command: '/skin', description: '切换显示主题' },
  { command: '/help', description: '显示可用命令' },
]

const SlashCommandMenu = forwardRef(function SlashCommandMenu(
  { open, query, onSelect }: SlashCommandMenuProps,
  ref: Ref<SlashCommandMenuHandle>,
) {
  const [activeIndex, setActiveIndex] = useState(0)
  const filter = useAutocompleteFilter({ sensitivity: 'base' })

  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return SLASH_COMMANDS

    return SLASH_COMMANDS.filter((item) =>
      filter.contains(
        item,
        normalizedQuery,
        (target) => `${target.command} ${target.description}`,
      ),
    )
  }, [filter, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [open, query])

  useEffect(() => {
    if (filteredCommands.length === 0) {
      setActiveIndex(0)
      return
    }
    setActiveIndex((previous) =>
      Math.max(0, Math.min(previous, filteredCommands.length - 1)),
    )
  }, [filteredCommands.length])

  useImperativeHandle(
    ref,
    () => ({
      moveSelection(step: number) {
        if (!open || filteredCommands.length === 0) return
        const direction = step >= 0 ? 1 : -1
        setActiveIndex((previous) => {
          const next = previous + direction
          if (next < 0) return filteredCommands.length - 1
          if (next >= filteredCommands.length) return 0
          return next
        })
      },
      selectActive() {
        if (!open || filteredCommands.length === 0) return false
        const selected = filteredCommands[activeIndex]
        if (!selected) return false
        onSelect(selected)
        return true
      },
    }),
    [activeIndex, filteredCommands, onSelect, open],
  )

  if (!open) return null

  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-[calc(100%+0.5rem)] z-[70]">
      <div
        className="pointer-events-auto overflow-hidden rounded-xl border border-primary-200 shadow-lg"
        style={{
          background: 'var(--color-surface, var(--theme-card, #1a1f2e))',
        }}
      >
        <Command
          items={filteredCommands}
          value={query}
          onValueChange={() => {}}
          mode="none"
          autoHighlight={false}
          keepHighlight={false}
        >
          {filteredCommands.length === 0 ? (
            <div className="px-3 py-2 text-sm text-primary-600">
              未找到匹配命令
            </div>
          ) : (
            <CommandList className="max-h-60 min-h-0">
              {filteredCommands.map((item, index) => (
                <CommandItem
                  key={item.command}
                  value={item.command}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => onSelect(item)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-md px-3 py-2',
                    index === activeIndex && 'bg-primary-100 text-primary-900',
                  )}
                >
                  <span className="text-sm font-semibold">{item.command}</span>
                  <span className="text-xs text-primary-600">
                    {item.description}
                  </span>
                </CommandItem>
              ))}
            </CommandList>
          )}
        </Command>
      </div>
    </div>
  )
})

export {
  SlashCommandMenu,
  type SlashCommandDefinition,
  type SlashCommandMenuHandle,
}
