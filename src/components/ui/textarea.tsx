'use client'

import type * as React from 'react'

import { cn } from '@/lib/utils'

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  unstyled?: boolean
  ref?: React.Ref<HTMLTextAreaElement>
}

function Textarea({
  className,
  unstyled = false,
  'aria-invalid': ariaInvalid,
  ref,
  ...props
}: TextareaProps) {
  if (unstyled) {
    return (
      <textarea ref={ref} className={className} aria-invalid={ariaInvalid} {...props} />
    )
  }

  return (
    <span
      className={cn(
        'relative flex w-full rounded-lg border border-[var(--theme-border)] bg-surface bg-clip-padding text-base text-[var(--theme-text)] shadow-xs/5 ring-[var(--theme-accent)]/25 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-has-disabled:not-has-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-ink/6%)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-[var(--theme-accent)] has-autofill:bg-primary-100 has-disabled:opacity-50 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] has-disabled:cursor-not-allowed sm:text-sm',
        className,
      )}
      data-slot="textarea-control"
    >
      <textarea
        ref={ref}
        className={cn(
          'min-h-8.5 w-full resize-y bg-transparent px-[calc(--spacing(3)-1px)] py-2 text-[var(--theme-text)] leading-6 outline-none placeholder:text-[var(--theme-muted)]/70 [transition:background-color_5000000s_ease-in-out_0s] sm:min-h-8',
          props.rows === undefined && 'min-h-8.5 sm:min-h-8',
        )}
        data-slot="textarea"
        aria-invalid={ariaInvalid}
        {...props}
      />
    </span>
  )
}

export { Textarea, type TextareaProps }
