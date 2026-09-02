'use client'

import {   isValidElement, useMemo } from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowUpDownIcon,
  CheckmarkCircle02Icon,
} from '@hugeicons/core-free-icons'
import type {ReactElement, ReactNode} from 'react';

import { cn } from '@/lib/utils'
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from '@/components/ui/scroll-area'

/**
 * 从 Select 的 JSX 子元素里递归提取 { value, label }，供 base-ui 的
 * Select.Root.items 使用。base-ui 的 <Select.Value /> 默认渲染原始 value，
 * 只有传入 items 时才会按 value 匹配 label 显示（否则权限页会显示 scoped、
 * 语音页会显示 local 等英文配置值）。这里统一派生，避免逐个调用点传 items。
 */
function collectSelectItems(
  node: ReactNode,
  acc: Array<{ value: unknown; label: string }> = [],
): Array<{ value: unknown; label: string }> {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return acc
  }
  if (Array.isArray(node)) {
    for (const child of node) collectSelectItems(child, acc)
    return acc
  }
  if (isValidElement(node)) {
    const el = node as ReactElement<{ value?: unknown; children?: ReactNode }>
    if (el.type === SelectItem) {
      const value = el.props.value
      const label = extractItemText(el.props.children)?.trim()
      if (label) acc.push({ value, label })
    }
    if (el.props.children !== undefined) {
      collectSelectItems(el.props.children, acc)
    }
  }
  return acc
}

function extractItemText(children: ReactNode): string | undefined {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children)
  }
  if (Array.isArray(children)) {
    const text = children.map(extractItemText).filter(Boolean).join('')
    return text || undefined
  }
  if (isValidElement(children)) {
    // 标签内嵌元素（如 <span>、<EmojiIcon/> 包裹文字）递归取文本
    return extractItemText(
      (children as ReactElement<{ children?: ReactNode }>).props.children,
    )
  }
  return undefined
}

function Select<Value, Multiple extends boolean | undefined = false>({
  children,
  items,
  ...props
}: SelectPrimitive.Root.Props<Value, Multiple>) {
  // 自动从 JSX 子元素派生 items；若调用方显式传了 items 则优先使用。
  const derivedItems = useMemo(
    () => items ?? collectSelectItems(children),
    [items, children],
  )
  return (
    <SelectPrimitive.Root<Value, Multiple> items={derivedItems} {...props}>
      {children}
    </SelectPrimitive.Root>
  )
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: 'sm' | 'default' | 'lg'
}) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'flex h-8.5 w-full min-w-0 select-none items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-surface px-[calc(--spacing(3)-1px)] text-sm text-[var(--theme-text)] shadow-xs/5 outline-none transition-colors [transition:background-color_5000000s_ease-in-out_0s] has-focus-visible:ring-[3px] has-focus-visible:border-[var(--theme-accent)] has-focus-visible:ring-[var(--theme-accent)]/25 data-open:border-[var(--theme-accent)] disabled:cursor-not-allowed disabled:opacity-50 sm:h-7.5 sm:text-sm',
        size === 'sm' && 'h-7.5 px-[calc(--spacing(2.5)-1px)] sm:h-6.5',
        size === 'lg' && 'h-9.5 px-[calc(--spacing(3)-1px)] sm:h-8.5',
        className,
      )}
      data-slot="select-trigger"
      {...props}
    >
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      <SelectIcon />
    </SelectPrimitive.Trigger>
  )
}

function SelectValue({
  className,
  placeholder,
  ...props
}: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      className={cn(
        'truncate text-left data-placeholder:text-[var(--theme-muted)]/70',
        className,
      )}
      data-slot="select-value"
      placeholder={placeholder}
      {...props}
    />
  )
}

function SelectIcon({ className, ...props }: SelectPrimitive.Icon.Props) {
  return (
    <SelectPrimitive.Icon
      className={cn(
        'pointer-events-none shrink-0 opacity-80 transition-transform data-open:rotate-180',
        className,
      )}
      data-slot="select-icon"
      {...props}
    >
      <HugeiconsIcon icon={ArrowUpDownIcon} size={16} strokeWidth={1.5} />
    </SelectPrimitive.Icon>
  )
}

function SelectPopup({
  className,
  children,
  side = 'bottom',
  sideOffset = 4,
  alignOffset,
  align = 'start',
  ...props
}: SelectPrimitive.Popup.Props & {
  align?: SelectPrimitive.Positioner.Props['align']
  sideOffset?: SelectPrimitive.Positioner.Props['sideOffset']
  alignOffset?: SelectPrimitive.Positioner.Props['alignOffset']
  side?: SelectPrimitive.Positioner.Props['side']
}) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        className="z-50 select-none"
        data-slot="select-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <span
          className={cn(
            'relative flex max-h-full min-w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) rounded-lg transition-[opacity]',
            className,
          )}
          style={{
            background: 'var(--theme-card)',
            color: 'var(--theme-text)',
            border: '1px solid var(--theme-border)',
            boxShadow: 'var(--theme-shadow-2)',
          }}
        >
          <SelectPrimitive.Popup
            className="flex max-h-[min(var(--available-height),23rem)] flex-1 flex-col"
            data-slot="select-popup"
            {...props}
          >
            {children}
          </SelectPrimitive.Popup>
        </span>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectList({ className, ...props }: SelectPrimitive.List.Props) {
  return (
    <ScrollAreaRoot>
      <ScrollAreaViewport>
        <SelectPrimitive.List
          className={cn(
            'not-empty:scroll-py-1 not-empty:p-1 in-data-has-overflow-y:pe-3',
            className,
          )}
          data-slot="select-list"
          {...props}
        />
      </ScrollAreaViewport>
      <ScrollAreaScrollbar orientation="vertical">
        <ScrollAreaThumb />
      </ScrollAreaScrollbar>
    </ScrollAreaRoot>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'flex min-h-8 cursor-default select-none items-center justify-between gap-2 rounded-sm px-2 py-1 text-sm outline-none data-highlighted:bg-[var(--theme-card2)] data-disabled:pointer-events-none data-disabled:opacity-64 sm:min-h-7',
        className,
      )}
      data-slot="select-item"
      style={{ color: 'var(--theme-text)' }}
      {...props}
    >
      <SelectPrimitive.ItemText className="min-w-0 flex-1 truncate">
        {children}
      </SelectPrimitive.ItemText>
      <SelectItemIndicator />
    </SelectPrimitive.Item>
  )
}

function SelectItemIndicator({
  className,
  ...props
}: SelectPrimitive.ItemIndicator.Props) {
  return (
    <SelectPrimitive.ItemIndicator
      className={cn('shrink-0 text-[var(--theme-accent)]', className)}
      data-slot="select-item-indicator"
      {...props}
    >
      <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} strokeWidth={1.5} />
    </SelectPrimitive.ItemIndicator>
  )
}

function SelectSeparator({ className, ...props }: { className?: string }) {
  return (
    <div
      className={cn('mx-2 my-1 h-px bg-[var(--theme-border)]', className)}
      data-slot="select-separator"
      {...props}
    />
  )
}

function SelectGroup({
  className,
  ...props
}: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      className={cn('[[role=group]+&]:mt-1.5', className)}
      data-slot="select-group"
      {...props}
    />
  )
}

function SelectGroupLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      className={cn('px-2 py-1.5 font-medium text-xs', className)}
      data-slot="select-group-label"
      style={{ color: 'var(--theme-muted)' }}
      {...props}
    />
  )
}

function SelectLabel({ className, ...props }: SelectPrimitive.Label.Props) {
  return (
    <SelectPrimitive.Label
      className={cn('px-2 py-1.5 text-xs font-medium', className)}
      data-slot="select-label"
      style={{ color: 'var(--theme-muted)' }}
      {...props}
    />
  )
}

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectPopup,
  SelectList,
  SelectItem,
  SelectItemIndicator,
  SelectSeparator,
  SelectGroup,
  SelectGroupLabel,
  SelectLabel,
}
