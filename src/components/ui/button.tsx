'use client'

import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 select-none duration-150',
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
          'bg-accent-500 text-white hover:bg-accent-600 shadow-sm outline outline-accent-500/20 shadow-2xs',
        secondary:
          'bg-accent-50 text-accent-700 hover:bg-accent-100 outline outline-accent-500/10 shadow-2xs',
        outline:
          'border-accent-200 bg-transparent text-accent-800 hover:bg-accent-50 shadow-2xs outline outline-accent-500/10',
        ghost: 'text-primary-900 hover:bg-primary-200 hover:text-primary-950',
        destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
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
