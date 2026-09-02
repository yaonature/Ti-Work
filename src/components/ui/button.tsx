'use client'

import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-bg)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 select-none duration-150',
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 px-3',
        lg: 'h-10 px-5',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-md': 'size-10',
        'icon-xl': 'size-11 [&_svg]:size-5',
      },
      variant: {
        default:
          'bg-[var(--theme-accent)] text-white hover:bg-[var(--theme-accent-secondary)] active:bg-[var(--theme-accent-secondary)] shadow-2xs outline outline-[var(--theme-accent)]/20',
        secondary:
          'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/20 active:bg-[var(--theme-accent)]/20 shadow-2xs outline outline-[var(--theme-accent)]/10',
        outline:
          'border-[var(--theme-border)] bg-transparent text-[var(--theme-text)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/10 shadow-2xs outline outline-transparent',
        ghost:
          'text-[var(--theme-text)] hover:bg-[var(--theme-hover)] active:bg-[var(--theme-hover)]',
        destructive:
          'bg-[var(--theme-danger)] text-white hover:bg-[color-mix(in_srgb,var(--theme-danger)_85%,#000)] active:bg-[color-mix(in_srgb,var(--theme-danger)_85%,#000)] shadow-2xs',
      },
    },
  },
)

interface ButtonProps extends useRender.ComponentProps<'button'> {
  variant?: VariantProps<typeof buttonVariants>['variant']
  size?: VariantProps<typeof buttonVariants>['size']
}

function Button({ className, variant, size, render, ...props }: ButtonProps) {
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>['type'] =
    render ? undefined : 'button'

  const defaultProps = {
    className: cn(buttonVariants({ className, size, variant })),
    'data-slot': 'button',
    type: typeValue,
  }

  return useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(defaultProps, props),
    render,
  })
}

export { Button, buttonVariants }
