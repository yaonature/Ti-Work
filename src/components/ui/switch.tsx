'use client'

import { Switch as SwitchPrimitive } from '@base-ui/react/switch'

import { cn } from '@/lib/utils'

/**
 * Switch —— 基于 @base-ui/react/switch 的无头开关。
 * 保留原生 role=switch、键盘（空格/回车）与 aria 语义；
 * 视觉使用项目自有 --theme-* 令牌与固定尺寸，追求接近系统原生开关的体验。
 */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'group inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 outline-none transition-colors duration-200',
        'bg-[var(--theme-border-subtle)]',
        'data-checked:bg-[var(--theme-accent)]',
        'focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-bg)]',
        'data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-white shadow-sm transition-transform duration-200',
          'group-data-checked:translate-x-4',
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
