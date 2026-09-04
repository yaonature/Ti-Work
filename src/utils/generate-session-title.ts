// 意图分类（类别 / 动作动词 / 文本清理）已收敛至共享模块 intent-classification.ts，
// 供标题生成与行为序列沉淀（P1-A）两侧复用，杜绝双份维护。
import {
  CATEGORY_SUBJECT_FALLBACK,
  cleanIntentText,
  detectIntentAction,
  detectIntentCategory,
} from './intent-classification'
import type { IntentCategory } from './intent-classification'

const DEFAULT_MAX_LENGTH = 40
const DEFAULT_MAX_WORDS = 6

// 与共享意图分类模块类型保持一致（历史导出名）。
type SessionCategory = IntentCategory

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'if',
  'then',
  'else',
  'for',
  'to',
  'of',
  'in',
  'on',
  'at',
  'with',
  'from',
  'by',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'i',
  'me',
  'my',
  'we',
  'our',
  'you',
  'your',
  'he',
  'she',
  'they',
  'them',
  'can',
  'could',
  'would',
  'should',
  'will',
  'do',
  'does',
  'did',
  'just',
  'also',
  'please',
  'need',
  'want',
  'some',
  'any',
  'very',
  'really',
  'so',
  'too',
])

const UPPERCASE_TOKENS = new Set([
  'api',
  'ci',
  'css',
  'html',
  'json',
  'sdk',
  'sql',
  'ui',
  'ux',
])

const TOKEN_OVERRIDES: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  nextjs: 'Next.js',
  react: 'React',
  tailwind: 'Tailwind',
}

export type SessionTitleSnippet = Array<{ role: string; text: string }>

// 文本清理复用共享意图分类模块实现，保持单份维护。
const cleanText = cleanIntentText

function normalizeToken(rawToken: string): string {
  return rawToken
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+/gu, '')
    .replace(/[^\p{L}\p{N}]+$/gu, '')
    .replace(/-/g, '')
    .trim()
}

function tokenizeMeaningful(text: string): Array<string> {
  return text
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length > 1 && !/^\d+$/.test(token))
    .filter((token) => !STOP_WORDS.has(token))
}

function truncateToLength(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  const clipped = text.slice(0, maxLength)
  const lastSpace = clipped.lastIndexOf(' ')
  if (lastSpace > 0) {
    return clipped.slice(0, lastSpace).trim()
  }
  return clipped.trim()
}

function formatToken(token: string): string {
  if (TOKEN_OVERRIDES[token]) return TOKEN_OVERRIDES[token]
  if (UPPERCASE_TOKENS.has(token)) return token.toUpperCase()
  return `${token.charAt(0).toUpperCase()}${token.slice(1)}`
}

function detectCategory(snippet: SessionTitleSnippet): SessionCategory {
  const combined = snippet.map((message) => message.text).join(' ')
  return detectIntentCategory(combined)
}

function primaryCandidate(snippet: SessionTitleSnippet): string {
  const firstUser = snippet.find((message) => message.role === 'user')
  if (firstUser?.text) return cleanText(firstUser.text)
  const firstAssistant = snippet.find((message) => message.role === 'assistant')
  if (firstAssistant?.text) return cleanText(firstAssistant.text)
  return ''
}

function scoreContextTokens(snippet: SessionTitleSnippet): Array<string> {
  const scores = new Map<string, number>()
  for (const message of snippet) {
    if (message.role !== 'user' && message.role !== 'assistant') continue
    const cleaned = cleanText(message.text)
    if (!cleaned) continue
    const tokens = tokenizeMeaningful(cleaned)
    const roleWeight = message.role === 'user' ? 3 : 2
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index]
      const earlyBonus = index < 5 ? 1 : 0
      const score = (scores.get(token) ?? 0) + roleWeight + earlyBonus
      scores.set(token, score)
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([token]) => token)
}

function detectAction(
  snippet: SessionTitleSnippet,
  category: SessionCategory,
): string {
  const firstUser = snippet.find((message) => message.role === 'user')
  const userMessages = snippet.filter((message) => message.role === 'user')
  const userTexts = userMessages.length > 0
    ? userMessages.map((message) => message.text)
    : []
  const firstUserText = firstUser ? firstUser.text : ''
  const allText = snippet.map((message) => message.text).join(' ')
  const candidates = [
    firstUserText,
    ...userTexts,
    allText,
  ].filter((text) => Boolean(text.trim()))

  return detectIntentAction(candidates, category)
}

function selectFocusTokens(
  primaryTokens: Array<string>,
  contextTokens: Array<string>,
  maxTokens: number,
): Array<string> {
  const selected: Array<string> = []
  const combined = [...primaryTokens, ...contextTokens]
  for (const token of combined) {
    if (selected.length >= maxTokens) break
    if (selected.includes(token)) continue
    // Keep action tokens if they're from primaryTokens (the user's actual words)
    selected.push(token)
  }
  return selected
}

type GenerateSessionTitleOptions = {
  maxLength?: number
  maxWords?: number
}

export function generateSessionTitle(
  snippet: SessionTitleSnippet,
  options: GenerateSessionTitleOptions = {},
): string {
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH
  const maxWords = options.maxWords ?? DEFAULT_MAX_WORDS

  const category = detectCategory(snippet)
  const primary = primaryCandidate(snippet)
  const titleTokens = tokenizeMeaningful(primary)
  const contextTokens = scoreContextTokens(snippet)
  const action = detectAction(snippet, category)
  const maxFocusTokens = Math.max(1, maxWords - 1)
  const focusTokens = selectFocusTokens(
    titleTokens,
    contextTokens,
    maxFocusTokens,
  )
  const subjectTokens =
    focusTokens.length > 0
      ? focusTokens
      : [normalizeToken(CATEGORY_SUBJECT_FALLBACK[category])]
  const coreTokens = [action, ...subjectTokens]
  const truncatedCoreTokens = coreTokens.slice(0, maxWords)
  const title = truncatedCoreTokens.map(formatToken).join(' ')
  return truncateToLength(title, maxLength)
}
