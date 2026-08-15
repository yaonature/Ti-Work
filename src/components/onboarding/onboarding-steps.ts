import {
  CheckmarkCircle02Icon,
  Home01Icon,
  Plug01Icon,
  Settings01Icon,
} from '@hugeicons/core-free-icons'
import {
  ConnectionCheckStep,
  ModelConfigurationStep,
} from './setup-step-content'
import type { HugeiconsIcon } from '@hugeicons/react'
import type * as React from 'react'

type IconType = React.ComponentProps<typeof HugeiconsIcon>['icon']

export type OnboardingStepComponentProps = {
  setCanProceed: (canProceed: boolean) => void
}

export type OnboardingStep = {
  id: string
  title: string
  description: string
  icon: IconType
  iconBg: string
  component?: React.ComponentType<OnboardingStepComponentProps>
  nextLabel?: string
  completeLabel?: string
  canProceedByDefault?: boolean
}

export const ONBOARDING_STEPS: Array<OnboardingStep> = [
  {
    id: 'welcome',
    title: '欢迎使用 Ti Work',
    description: '由 Hermes Agent 驱动的 AI 工作空间',
    icon: Home01Icon,
    iconBg: 'bg-orange-500',
    nextLabel: '开始设置',
  },
  {
    id: 'connection-check',
    title: '连接检查',
    description: '开始之前，先确认 Hermes Agent 已正常运行。',
    icon: Plug01Icon,
    iconBg: 'bg-emerald-500',
    component: ConnectionCheckStep,
    canProceedByDefault: false,
  },
  {
    id: 'model-configuration',
    title: '模型配置',
    description: '检查当前使用的模型提供方与模型设置。',
    icon: Settings01Icon,
    iconBg: 'bg-cyan-500',
    component: ModelConfigurationStep,
  },
  {
    id: 'ready',
    title: '配置完成',
    description:
      '现在就可以开始和 Hermes 协作了。你可以让它帮你写代码、做调研，或处理其他工作任务。',
    icon: CheckmarkCircle02Icon,
    iconBg: 'bg-emerald-500',
    completeLabel: '开始对话',
  },
]

export const STORAGE_KEY = 'hermes-onboarding-complete'
