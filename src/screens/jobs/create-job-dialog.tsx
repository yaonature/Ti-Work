'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { EmojiIcon } from '@/components/emoji-icon'

const SCHEDULE_PRESETS = [
  { label: '每 15 分钟', value: 'every 15m' },
  { label: '每 30 分钟', value: 'every 30m' },
  { label: '每 1 小时', value: 'every 1h' },
  { label: '每 6 小时', value: 'every 6h' },
  { label: '每天', value: '0 9 * * *' },
  { label: '每周', value: '0 9 * * 1' },
] as const

const DELIVERY_OPTIONS = ['local', 'telegram', 'discord'] as const

type CreateJobDialogProps = {
  open: boolean
  isSubmitting?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: {
    name: string
    schedule: string
    prompt: string
    deliver?: Array<string>
    skills?: Array<string>
    repeat?: number
    pre_run_script?: string
  }) => void | Promise<void>
}

function getInitialState() {
  return {
    name: '',
    schedule: 'every 30m',
    prompt: '',
    skillsInput: '',
    deliver: ['local'] as Array<string>,
    repeatMode: 'unlimited' as 'unlimited' | 'limited',
    repeatCount: '1',
    preRunScript: '',
    showPreRunScript: false,
  }
}

export function CreateJobDialog({
  open,
  isSubmitting = false,
  onOpenChange,
  onSubmit,
}: CreateJobDialogProps) {
  const [form, setForm] = useState(getInitialState)

  useEffect(() => {
    if (!open) {
      setForm(getInitialState())
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onOpenChange])

  function toggleDelivery(target: string) {
    setForm((current) => {
      const nextDeliver = current.deliver.includes(target)
        ? current.deliver.filter((item) => item !== target)
        : [...current.deliver, target]

      return {
        ...current,
        deliver: nextDeliver,
      }
    })
  }

  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const skills = form.skillsInput
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean)

    void onSubmit({
      name: form.name.trim(),
      schedule: form.schedule.trim(),
      prompt: form.prompt.trim(),
      deliver: form.deliver.length > 0 ? form.deliver : undefined,
      skills: skills.length > 0 ? Array.from(new Set(skills)) : undefined,
      repeat:
        form.repeatMode === 'limited'
          ? Math.max(1, Number.parseInt(form.repeatCount, 10) || 1)
          : undefined,
      pre_run_script: form.preRunScript.trim() || undefined,
    })
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="create-job-dialog"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onOpenChange(false)
            }
          }}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => onOpenChange(false)}
          />
          <motion.form
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onSubmit={handleFormSubmit}
            className="relative z-10 flex max-h-[85vh] w-[min(720px,96vw)] flex-col overflow-hidden rounded-[20px] border shadow-[var(--theme-shadow-3)]"
            style={{
              background: 'var(--theme-panel)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text)',
            }}
          >
            <div
              className="flex items-start justify-between gap-4 border-b px-5 py-4"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <div>
                <h2 className="text-lg font-semibold">新建定时任务</h2>
                <p
                  className="mt-1 text-sm"
                  style={{ color: 'var(--theme-muted)' }}
                >
                  使用预设调度选项创建 Hermes 定时任务。
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-lg p-2 transition-colors"
                style={{ color: 'var(--theme-muted)' }}
                aria-label="关闭新建定时任务对话框"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <section className="space-y-2">
                <label className="text-sm font-medium">名称</label>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="例如：每日研究报告"
                  required
                  className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-1"
                  style={{
                    background: 'var(--theme-input)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                    boxShadow: '0 0 0 0 transparent',
                  }}
                />
              </section>

              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium">调度</h3>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: 'var(--theme-muted)' }}
                  >
                    选择一个预设，或在下方输入自定义调度字符串。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SCHEDULE_PRESETS.map((preset) => {
                    const isActive = form.schedule === preset.value
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            schedule: preset.value,
                          }))
                        }
                        className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                        style={{
                          background: isActive
                            ? 'var(--theme-accent)'
                            : 'var(--theme-card)',
                          borderColor: isActive
                            ? 'var(--theme-accent)'
                            : 'var(--theme-border)',
                          color: isActive ? '#fff' : 'var(--theme-text)',
                        }}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">自定义调度</label>
                  <input
                    value={form.schedule}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        schedule: event.target.value,
                      }))
                    }
                    placeholder="例如：every 30m 或 0 9 * * *"
                    required
                    className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-1"
                    style={{
                      background: 'var(--theme-input)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text)',
                    }}
                  />
                  <p
                    className="text-xs"
                    style={{ color: 'var(--theme-muted)' }}
                  >
                    高级用户可直接输入 Cron 表达式。
                  </p>
                </div>
              </section>

              <section className="space-y-2">
                <label className="text-sm font-medium">提示词</label>
                <textarea
                  value={form.prompt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      prompt: event.target.value,
                    }))
                  }
                  placeholder="Hermes 应该做什么？"
                  required
                  rows={5}
                  className="w-full resize-none rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-1"
                  style={{
                    background: 'var(--theme-input)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                />
              </section>

              <section className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium">选项</h3>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: 'var(--theme-muted)' }}
                  >
                    可选的投递与重复控制。
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">技能</label>
                  <input
                    value={form.skillsInput}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        skillsInput: event.target.value,
                      }))
                    }
                    placeholder="例如：research、writing、synthesis"
                    className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-1"
                    style={{
                      background: 'var(--theme-input)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text)',
                    }}
                  />
                  <p
                    className="text-xs"
                    style={{ color: 'var(--theme-muted)' }}
                  >
                    目前使用逗号分隔。
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">投递到</label>
                  <div className="flex flex-wrap gap-2">
                    {DELIVERY_OPTIONS.map((option) => {
                      const isActive = form.deliver.includes(option)
                      const needsGateway =
                        option === 'telegram' || option === 'discord'
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleDelivery(option)}
                          title={
                            needsGateway
                              ? `需要为 ${option} 配置 Hermes 执行引擎（网关）`
                              : undefined
                          }
                          className="rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors"
                          style={{
                            background: isActive
                              ? 'var(--theme-accent)'
                              : 'var(--theme-card)',
                            borderColor: isActive
                              ? 'var(--theme-accent)'
                              : 'var(--theme-border)',
                            color: isActive
                              ? '#fff'
                              : needsGateway
                                ? 'var(--theme-muted)'
                                : 'var(--theme-text)',
                          }}
                        >
                          {option} {needsGateway ? <EmojiIcon emoji="⚡" size={12} /> : null}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">重复</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          repeatMode: 'unlimited',
                        }))
                      }
                      className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                      style={{
                        background:
                          form.repeatMode === 'unlimited'
                            ? 'var(--theme-accent)'
                            : 'var(--theme-card)',
                        borderColor:
                          form.repeatMode === 'unlimited'
                            ? 'var(--theme-accent)'
                            : 'var(--theme-border)',
                        color:
                          form.repeatMode === 'unlimited'
                            ? '#fff'
                            : 'var(--theme-text)',
                      }}
                    >
                      不限次数
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          repeatMode: 'limited',
                        }))
                      }
                      className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                      style={{
                        background:
                          form.repeatMode === 'limited'
                            ? 'var(--theme-accent)'
                            : 'var(--theme-card)',
                        borderColor:
                          form.repeatMode === 'limited'
                            ? 'var(--theme-accent)'
                            : 'var(--theme-border)',
                        color:
                          form.repeatMode === 'limited'
                            ? '#fff'
                            : 'var(--theme-text)',
                      }}
                    >
                      设置次数
                    </button>
                  </div>
                  {form.repeatMode === 'limited' ? (
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={form.repeatCount}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          repeatCount: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-1"
                      style={{
                        background: 'var(--theme-input)',
                        borderColor: 'var(--theme-border)',
                        color: 'var(--theme-text)',
                      }}
                    />
                  ) : null}
                </div>
              </section>

              {/* Pre-run script — advanced */}
              <section className="space-y-3">
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        showPreRunScript: !current.showPreRunScript,
                      }))
                    }
                    className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                    style={{ color: 'var(--theme-muted)' }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        transform: form.showPreRunScript ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.15s',
                      }}
                    >
                      <EmojiIcon emoji="▶" size={14} />
                    </span>
                    Pre-run script (advanced)
                  </button>
                  {form.showPreRunScript && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs" style={{ color: 'var(--theme-muted)' }}>
                        Shell script to run before the agent prompt — useful for change detection or data collection.
                      </p>
                      <textarea
                        value={form.preRunScript}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            preRunScript: event.target.value,
                          }))
                        }
                        rows={4}
                        placeholder="#!/bin/bash&#10;echo 'pre-run data'"
                        className="w-full rounded-xl border px-3 py-2.5 font-mono text-xs focus:outline-none focus:ring-1"
                        style={{
                          background: 'var(--theme-input)',
                          borderColor: 'var(--theme-border)',
                          color: 'var(--theme-text)',
                          resize: 'vertical',
                        }}
                      />
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div
              className="flex items-center justify-end gap-2 border-t px-5 py-4"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl px-4 py-2 text-sm transition-colors"
                style={{
                  background: 'var(--theme-card)',
                  color: 'var(--theme-muted)',
                }}
              >
                取消
              </button>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  !form.name.trim() ||
                  !form.schedule.trim() ||
                  !form.prompt.trim()
                }
                className="rounded-xl px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
                style={{ background: 'var(--theme-accent)' }}
              >
                {isSubmitting ? '创建中…' : '创建'}
              </button>
            </div>
          </motion.form>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
