'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { writeTextToClipboard } from '@/lib/clipboard'

const STORAGE_KEY_SEEN = 'hermes-mobile-setup-seen'

interface MobileSetupModalProps {
  isOpen: boolean
  onClose: () => void
}

function TailscaleIcon() {
  return (
    <svg viewBox="0 0 100 100" className="size-5">
      <circle cx="50" cy="10" r="10" fill="#fff" opacity="0.9" />
      <circle cx="50" cy="50" r="10" fill="#fff" />
      <circle cx="50" cy="90" r="10" fill="#fff" opacity="0.9" />
      <circle cx="10" cy="30" r="10" fill="#fff" opacity="0.6" />
      <circle cx="90" cy="30" r="10" fill="#fff" opacity="0.6" />
      <circle cx="10" cy="70" r="10" fill="#fff" opacity="0.6" />
      <circle cx="90" cy="70" r="10" fill="#fff" opacity="0.6" />
      <circle cx="10" cy="50" r="10" fill="#fff" opacity="0.3" />
      <circle cx="90" cy="50" r="10" fill="#fff" opacity="0.3" />
    </svg>
  )
}

export function MobileSetupModal({ isOpen, onClose }: MobileSetupModalProps) {
  const [step, setStep] = useState(0)
  const [networkUrl, setNetworkUrl] = useState<{
    url: string
    source: 'tailscale' | 'lan' | 'localhost'
  } | null>(null)

  useEffect(() => {
    fetch(`/api/network-url?port=${window.location.port || 3000}`)
      .then(
        (r) =>
          r.json() as Promise<{
            url: string
            source: 'tailscale' | 'lan' | 'localhost'
          }>,
      )
      .then((data) => setNetworkUrl(data))
      .catch(() =>
        setNetworkUrl({ url: window.location.origin, source: 'localhost' }),
      )
  }, [])

  useEffect(() => {
    if (isOpen) setStep(0)
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const steps = [
    {
      title: '在桌面端安装 Tailscale',
      body: '请先在运行 Ti Work 的设备上安装 Tailscale，并完成登录。',
      showTailscaleIcon: true,
      action: (
        <a
          href="https://tailscale.com/download"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-400"
        >
          打开 Tailscale 下载页
        </a>
      ),
    },
    {
      title: '确保后端可访问',
      body: 'Ti Work 在移动端同样可以连接任意 OpenAI 兼容后端。请确保工作区和后端都能通过 Tailscale 或局域网访问。',
      showTailscaleIcon: false,
      action: (
        <div className="rounded-lg border border-primary-700 bg-primary-950 px-4 py-3 text-sm text-primary-200">
          Hermes 网关增强 API 不是必须项。如果桌面端核心会话已经可用，移动端能否访问主要取决于网络可达性。
        </div>
      ),
    },
    {
      title: '在手机上安装 Tailscale',
      body: '请在 iOS 或 Android 设备上安装 Tailscale，并使用同一账号登录。',
      showTailscaleIcon: true,
      action: (
        <div className="flex gap-2">
          <a
            href="https://apps.apple.com/app/apple-store/id425072860"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-primary-700 bg-primary-950 px-3 py-2 text-xs font-medium text-primary-100 transition-colors hover:bg-primary-800"
          >
            iOS 应用
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.tailscale.ipn"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-primary-700 bg-primary-950 px-3 py-2 text-xs font-medium text-primary-100 transition-colors hover:bg-primary-800"
          >
            Android 应用
          </a>
        </div>
      ),
    },
    {
      title: '在手机上打开 Ti Work',
      body:
        networkUrl?.source === 'tailscale'
          ? '这是你的 Tailscale 地址。请在手机浏览器中打开它，以访问同一个工作区。'
          : networkUrl?.source === 'lan'
            ? '这是你的局域网地址。请确保手机连接到同一 Wi-Fi。'
            : '如果你希望在 localhost 之外分享访问地址，请先在这台设备上启动 Tailscale。',
      showTailscaleIcon: networkUrl?.source === 'tailscale',
      action: (
        <button
          type="button"
          onClick={() =>
            networkUrl && writeTextToClipboard(networkUrl.url).catch(() => {})
          }
          className="group flex w-full items-center justify-between rounded-lg border border-primary-700 bg-primary-950 px-4 py-3 transition-colors hover:border-accent-500/50"
        >
          <span className="break-all font-mono text-sm text-accent-300">
            {networkUrl?.url ?? '…'}
          </span>
          <span className="ml-3 shrink-0 text-primary-500 group-hover:text-accent-400">
            {networkUrl?.source === 'tailscale' && (
              <svg viewBox="0 0 100 100" className="size-4 opacity-60">
                <circle
                  cx="50"
                  cy="10"
                  r="10"
                  fill="currentColor"
                  opacity="0.9"
                />
                <circle cx="50" cy="50" r="10" fill="currentColor" />
                <circle
                  cx="50"
                  cy="90"
                  r="10"
                  fill="currentColor"
                  opacity="0.9"
                />
                <circle
                  cx="10"
                  cy="30"
                  r="10"
                  fill="currentColor"
                  opacity="0.6"
                />
                <circle
                  cx="90"
                  cy="30"
                  r="10"
                  fill="currentColor"
                  opacity="0.6"
                />
                <circle
                  cx="10"
                  cy="70"
                  r="10"
                  fill="currentColor"
                  opacity="0.6"
                />
                <circle
                  cx="90"
                  cy="70"
                  r="10"
                  fill="currentColor"
                  opacity="0.6"
                />
              </svg>
            )}
          </span>
        </button>
      ),
    },
  ]

  const currentStep = steps[step]
  const isLastStep = step === steps.length - 1

  const handleNext = () => {
    if (!isLastStep) {
      setStep((prev) => prev + 1)
      return
    }

    localStorage.setItem(STORAGE_KEY_SEEN, 'true')
    onClose()
  }

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 0))
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="relative w-full max-w-md rounded-2xl border border-primary-800/60 bg-primary-950 p-5 text-white shadow-2xl shadow-black/40"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-primary-400 transition-colors hover:bg-primary-900 hover:text-primary-200"
          aria-label="关闭移动端设置"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2} />
        </button>

        <div className="mb-4 flex items-center gap-3 pr-10">
          <img
            src="/ti-work-logo.svg"
            alt="Ti Work"
            className="size-9 rounded-xl"
          />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">移动端设置</h2>
            <div className="mt-1 flex items-center gap-1.5">
              {steps.map((_, index) => (
                <span
                  key={`step-indicator-${index}`}
                  className={`h-2 w-6 rounded-full transition-colors ${
                    index === step ? 'bg-accent-500' : 'bg-primary-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-primary-900 p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-2 flex items-center gap-2">
                {currentStep.showTailscaleIcon ? <TailscaleIcon /> : null}
                <h3 className="text-sm font-semibold text-primary-100">
                  {currentStep.title}
                </h3>
              </div>
              <p className="mb-4 text-sm text-primary-300">
                {currentStep.body}
              </p>
              <div>{currentStep.action}</div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 0}
            className="rounded-lg px-3 py-2 text-sm text-primary-400 transition-colors hover:text-primary-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            上一步
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-primary-400 transition-colors hover:text-primary-200"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-400"
            >
              {isLastStep ? '完成' : '下一步'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
