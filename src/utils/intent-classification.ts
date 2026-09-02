/**
 * 意图分类共享模块（P1 行为资产沉淀 — 对话意图提取）。
 *
 * 原逻辑沉淀自 generate-session-title.ts 的标题意图检测（detectCategory /
 * detectAction），此前为仓库内无调用点的死代码。P1-A 将「动作 + 对话意图」
 * 沉淀为行为资产后，本模块成为会话任务序列意图标签的唯一来源：
 *  - 标题生成侧（generate-session-title.ts）引用本模块，杜绝双份维护；
 *  - 行为序列沉淀侧（send-stream / habit-sequences）经 classifyUserIntent 提取标签。
 *
 * 纯函数、无 Node / DOM 依赖，前后端可共用。
 * 语义边界：只产出意图标签，不沉淀对话原文。
 */

export type IntentCategory =
  | 'coding'
  | 'research'
  | 'config'
  | 'creative'
  | 'analysis'
  | 'chat'

export const INTENT_CATEGORIES: ReadonlyArray<
  Exclude<IntentCategory, 'chat'>
> = ['coding', 'research', 'config', 'analysis', 'creative']

export const CATEGORY_KEYWORDS: Record<
  Exclude<IntentCategory, 'chat'>,
  Array<string>
> = {
  coding: [
    'code',
    'coding',
    'debug',
    'bug',
    'error',
    'stack trace',
    'typescript',
    'javascript',
    'react',
    'test',
    'build',
    'lint',
    'function',
    'api',
    'query',
    '代码',
    '编程',
    '开发',
    '接口',
    '脚本',
    '数据库',
    '组件',
    '报错',
  ],
  research: [
    'research',
    'source',
    'citation',
    'paper',
    'study',
    'docs',
    'documentation',
    'compare',
    'find',
    'search',
    'look up',
    'latest',
    'news',
    '查找',
    '搜索',
    '调研',
    '资料',
    '文献',
    '论文',
    '行情',
    '竞品',
  ],
  config: [
    'config',
    'configuration',
    'setting',
    'settings',
    'setup',
    'install',
    'environment',
    '.env',
    'deploy',
    'docker',
    'pipeline',
    'ci',
    'workflow',
    'permission',
    '配置',
    '设置',
    '安装',
    '部署',
    '环境',
    '初始化',
    '权限',
    '服务器',
  ],
  creative: [
    'creative',
    'brainstorm',
    'idea',
    'name',
    'naming',
    'story',
    'poem',
    'script',
    'copy',
    'rewrite',
    'draft',
    '起草',
    '构思',
    '文案',
    '命名',
    '润色',
    '改写',
    '海报',
  ],
  analysis: [
    'analyze',
    'analysis',
    'evaluate',
    'tradeoff',
    'trade-off',
    'pros',
    'cons',
    'performance',
    'metrics',
    'data',
    'summary',
    'summarize',
    'report',
    '分析',
    '整理',
    '汇总',
    '总结',
    '评估',
    '统计',
    '报告',
    '审阅',
    '归纳',
    '摘要',
  ],
}

const NOISE_PREFIXES =
  /^(?:hey|hi|hello|ok(?:ay)?|so|well|please|kindly|um|uh|can you|could you|would you|will you|i want(?: to)?|i need(?: to)?|help me(?: with)?|let'?s|lets|also|just)\b[\s,:-]*/i

export const ACTION_PATTERNS: Array<{ pattern: RegExp; verb: string }> = [
  {
    pattern:
      /\b(?:fix|fixing|fixed|bug|bugs|error|errors|resolve|resolved|resolving)\b/,
    verb: 'Fix',
  },
  {
    pattern: /\b(?:debug|debugging|debugged|diagnose|diagnosing|diagnosed)\b/,
    verb: 'Debug',
  },
  {
    pattern: /\b(?:refactor|refactoring|refactored|cleanup|cleaning|cleaned)\b/,
    verb: 'Refactor',
  },
  {
    pattern:
      /\b(?:optimize|optimizing|optimized|optimise|optimising|performance)\b/,
    verb: 'Optimize',
  },
  {
    pattern:
      /\b(?:implement|implementing|implemented|build|building|create|creating|add|adding|write|writing)\b/,
    verb: 'Build',
  },
  {
    pattern: /\b(?:update|updating|updated|upgrade|upgrading|upgraded)\b/,
    verb: 'Update',
  },
  {
    pattern:
      /\b(?:test|testing|tested|verify|verifying|validate|validating|validated)\b/,
    verb: 'Test',
  },
  {
    pattern:
      /\b(?:analyze|analyzing|analyzed|analyse|analysing|analysis|evaluate|evaluating|investigate|investigating|review|reviewing)\b/,
    verb: 'Analyze',
  },
  { pattern: /\b(?:compare|comparing|comparison)\b/, verb: 'Compare' },
  {
    pattern:
      /\b(?:research|researching|search|searching|find|finding|lookup|look up)\b/,
    verb: 'Research',
  },
  {
    pattern:
      /\b(?:configure|config|configuration|setup|set up|install|deploy|deploying|deployed)\b/,
    verb: 'Configure',
  },
  {
    pattern:
      /\b(?:summarize|summarizing|summarized|summarise|summarising|summarised|summary)\b/,
    verb: 'Summarize',
  },
  {
    pattern:
      /\b(?:draft|drafting|drafted|brainstorm|brainstorming|rewrite|rewriting|name|naming)\b/,
    verb: 'Draft',
  },
  { pattern: /\b(?:explain|explaining|walkthrough)\b/, verb: 'Explain' },
  // 中文动作词：采用子串匹配（CJK 无 \b 语义），词义选择高置信、歧义低。
  { pattern: /修复|修一下|解决报错/, verb: 'Fix' },
  { pattern: /调试|排查/, verb: 'Debug' },
  { pattern: /重构|拆分代码/, verb: 'Refactor' },
  { pattern: /优化/, verb: 'Optimize' },
  { pattern: /实现|新建|创建|生成|写一个脚本|脚本/, verb: 'Build' },
  { pattern: /更新|升级/, verb: 'Update' },
  { pattern: /测试|验证/, verb: 'Test' },
  { pattern: /分析|评估|审阅/, verb: 'Analyze' },
  { pattern: /对比|比较/, verb: 'Compare' },
  { pattern: /调研|检索|查询/, verb: 'Research' },
  { pattern: /配置|部署|搭建|安装/, verb: 'Configure' },
  { pattern: /总结|汇总|归纳/, verb: 'Summarize' },
  { pattern: /起草|撰写|构思|改写/, verb: 'Draft' },
  { pattern: /解释|说明/, verb: 'Explain' },
]

export const CATEGORY_DEFAULT_ACTION: Record<IntentCategory, string> = {
  coding: 'Fix',
  research: 'Research',
  config: 'Configure',
  creative: 'Draft',
  analysis: 'Analyze',
  chat: 'Discuss',
}

export const CATEGORY_SUBJECT_FALLBACK: Record<IntentCategory, string> = {
  coding: 'Issue',
  research: 'Topic',
  config: 'Setup',
  creative: 'Idea',
  analysis: 'Results',
  chat: 'Chat',
}

function stripNoisePrefixes(text: string): string {
  let stripped = text.trim()
  let previous = ''
  while (stripped && stripped !== previous) {
    previous = stripped
    stripped = stripped.replace(NOISE_PREFIXES, '').trim()
  }
  return stripped
}

/** 清理对话文本：去代码块/链接/标点噪音，供意图分类与标签生成使用。 */
export function cleanIntentText(raw: string): string {
  let text = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#*`_~[\]()]/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  text = stripNoisePrefixes(text)
  return text
}

/**
 * 识别一段文本的意图类别。无命中回退 'chat'。
 * 与旧 generate-session-title 内部 detectCategory 逐字等价。
 */
export function detectIntentCategory(text: string): IntentCategory {
  const combined = cleanIntentText(text).toLowerCase()
  if (!combined) return 'chat'

  let bestCategory: IntentCategory = 'chat'
  let bestScore = 0

  for (const category of INTENT_CATEGORIES) {
    const keywords = CATEGORY_KEYWORDS[category]
    let score = 0
    for (const keyword of keywords) {
      if (combined.includes(keyword)) score += 1
    }
    if (score > bestScore) {
      bestScore = score
      bestCategory = category
    }
  }

  return bestScore > 0 ? bestCategory : 'chat'
}

/**
 * 按候选文本顺序匹配动作动词。texts 由调用方控制优先级
 * （如用户首条 > 全部用户消息 > 用户+助手全文），与旧 detectAction 语义一致。
 */
export function detectIntentAction(
  texts: Array<string>,
  category: IntentCategory,
): string {
  const candidates = texts
    .map((text) => cleanIntentText(text).toLowerCase())
    .filter(Boolean)

  for (const text of candidates) {
    for (const actionPattern of ACTION_PATTERNS) {
      if (actionPattern.pattern.test(text)) {
        return actionPattern.verb
      }
    }
  }

  return CATEGORY_DEFAULT_ACTION[category]
}

export interface ClassifiedIntent {
  /** 意图类别（可泛化要素，英文枚举）。 */
  category: IntentCategory
  /** 动作动词（可泛化要素，英文枚举）。 */
  action: string
  /** 意图标签（个人措辞，仅本地留存，上云剥离）。 */
  label: string
}

const DEFAULT_MAX_LABEL_LENGTH = 80

/**
 * 从用户请求原文产出会话任务意图标签，供行为序列沉淀使用。
 *
 * 只做规则分类，不请求任何远端服务；输入为空时回退 chat/Discuss。
 */
export function classifyUserIntent(
  rawText: string,
  options?: { maxLabelLength?: number },
): ClassifiedIntent {
  const maxLabelLength = options?.maxLabelLength ?? DEFAULT_MAX_LABEL_LENGTH
  const cleaned = cleanIntentText(rawText)
  const category = detectIntentCategory(cleaned)
  const action = detectIntentAction([cleaned], category)

  let label = cleaned
  if (!label) {
    const fallback = CATEGORY_SUBJECT_FALLBACK[category]
    label = `${action} ${fallback}`
  }
  if (label.length > maxLabelLength) {
    label = label.slice(0, maxLabelLength).trim()
  }

  return { category, action, label }
}
