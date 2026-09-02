import { describe, expect, it } from 'vitest'
import {
  cleanIntentText,
  classifyUserIntent,
  detectIntentAction,
  detectIntentCategory,
} from '@/utils/intent-classification'
import { generateSessionTitle } from '@/utils/generate-session-title'

describe('intent-classification', () => {
  it('detects a coding category from keywords', () => {
    expect(detectIntentCategory('帮我修复这个 React bug，检查报错堆栈')).toBe(
      'coding',
    )
    expect(detectIntentCategory('run the tests and check the lint errors')).toBe(
      'coding',
    )
  })

  it('detects an analysis category from keywords', () => {
    expect(detectIntentCategory('请分析这份性能数据并给出总结')).toBe(
      'analysis',
    )
  })

  it('falls back to chat when no category keyword matches', () => {
    expect(detectIntentCategory('早上好，随便聊聊')).toBe('chat')
    expect(detectIntentCategory('')).toBe('chat')
  })

  it('matches the first action verb in candidate order', () => {
    expect(detectIntentAction(['fix the build error'], 'coding')).toBe('Fix')
    expect(detectIntentAction(['summarize the meeting notes'], 'chat')).toBe(
      'Summarize',
    )
    // 无命中回退到类别默认动作
    expect(detectIntentAction(['随便聊聊'], 'chat')).toBe('Discuss')
    expect(detectIntentAction(['随便聊聊'], 'analysis')).toBe('Analyze')
  })

  it('classifies a user intent into category / action / readable label', () => {
    const intent = classifyUserIntent('帮我整理并分析这份合同的关键条款')
    expect(intent.category).toBe('analysis')
    expect(intent.action).toBe('Analyze')
    expect(intent.label.length).toBeGreaterThan(0)
  })

  it('truncates overlong labels and keeps the readable prefix', () => {
    const longText = '需要处理'.repeat(30)
    const intent = classifyUserIntent(longText, { maxLabelLength: 40 })
    expect(intent.label.length).toBeLessThanOrEqual(40)
  })

  it('produces a fallback label for empty input without throwing', () => {
    const intent = classifyUserIntent('   ')
    expect(intent.category).toBe('chat')
    expect(intent.action).toBe('Discuss')
    expect(intent.label.length).toBeGreaterThan(0)
  })

  it('cleans noise prefixes and markdown from text', () => {
    // 反引号内联代码按清理语义移除（与标题生成的去代码行为一致）。
    expect(cleanIntentText('请帮我 `code` 片段')).toBe('请帮我 片段')
    expect(cleanIntentText('Hey can you fix https://example.com/a now')).toBe(
      'fix now',
    )
  })

  it('keeps generate-session-title working after the shared-module refactor', () => {
    const title = generateSessionTitle([
      { role: 'user', text: 'fix the build error in the react component' },
    ])
    expect(title.length).toBeGreaterThan(0)
    expect(title).toContain('Fix')
  })
})
