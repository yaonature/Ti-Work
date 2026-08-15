/**
 * Agent Personas — Named agents with specific roles for visual identity.
 * When agents are spawned, they get assigned a persona based on their task type.
 */

export type AgentPersona = {
  name: string
  role: string
  emoji: string
  color: string // Tailwind color class
  specialties: Array<string>
}

/** Default persona pool — assigned round-robin or by task matching */
export const AGENT_PERSONAS: Array<AgentPersona> = [
  {
    name: '罗杰',
    role: '前端开发',
    emoji: '🎨',
    color: 'text-blue-400',
    specialties: [
      'react',
      'css',
      'tailwind',
      'ui',
      'ux',
      'component',
      'layout',
      'style',
      'design',
      'frontend',
      'page',
      'landing',
    ],
  },
  {
    name: '莎莉',
    role: '后端架构',
    emoji: '🏗️',
    color: 'text-purple-400',
    specialties: [
      'api',
      'server',
      'database',
      'backend',
      'node',
      'express',
      'route',
      'endpoint',
      'schema',
      'migration',
      'sql',
      'rpc',
    ],
  },
  {
    name: '比尔',
    role: '营销专家',
    emoji: '📣',
    color: 'text-orange-400',
    specialties: [
      'marketing',
      'seo',
      'content',
      'copy',
      'brand',
      'social',
      'campaign',
      'analytics',
      'growth',
    ],
  },
  {
    name: '艾达',
    role: '质量保障工程师',
    emoji: '🔍',
    color: 'text-emerald-400',
    specialties: [
      'test',
      'qa',
      'bug',
      'fix',
      'error',
      'debug',
      'lint',
      'type',
      'typescript',
      'validate',
      'audit',
    ],
  },
  {
    name: '麦克斯',
    role: '运维专家',
    emoji: '⚙️',
    color: 'text-amber-400',
    specialties: [
      'deploy',
      'docker',
      'ci',
      'cd',
      'build',
      'config',
      'infra',
      'server',
      'monitor',
      'log',
      'performance',
    ],
  },
  {
    name: '露娜',
    role: '研究分析师',
    emoji: '🔬',
    color: 'text-cyan-400',
    specialties: [
      'research',
      'analyze',
      'compare',
      'report',
      'data',
      'insight',
      'strategy',
      'plan',
      'review',
      'audit',
    ],
  },
  {
    name: '凯',
    role: '全栈工程师',
    emoji: '⚡',
    color: 'text-yellow-400',
    specialties: [
      'fullstack',
      'feature',
      'implement',
      'build',
      'create',
      'scaffold',
      'refactor',
      'update',
      'upgrade',
    ],
  },
  {
    name: '星枢',
    role: '安全专家',
    emoji: '🛡️',
    color: 'text-red-400',
    specialties: [
      'security',
      'auth',
      'permission',
      'encrypt',
      'vulnerability',
      'scan',
      'protect',
      'firewall',
      'token',
    ],
  },
]

/**
 * Deterministic hash from session key → stable persona index.
 * This survives HMR and ensures the same session always gets the same persona.
 */
function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    hash = ((hash << 5) - hash + ch) | 0
  }
  return Math.abs(hash)
}

/** Global registry: tracks active session → persona assignments */
const assignedPersonas = new Map<string, AgentPersona>()

/**
 * Assign a persona to a session. Uses keyword matching first (skipping taken names),
 * then falls back to a deterministic hash of the session key for stable assignment.
 * Each active session gets a unique persona (up to 8 agents).
 */
export function assignPersona(
  sessionKey: string,
  taskText?: string,
): AgentPersona {
  // Return existing assignment
  const existing = assignedPersonas.get(sessionKey)
  if (existing) return existing

  // Track which persona names are already taken
  const takenNames = new Set<string>()
  for (const p of assignedPersonas.values()) {
    takenNames.add(p.name)
  }

  const available = AGENT_PERSONAS.filter((p) => !takenNames.has(p.name))

  // Try keyword matching among available personas
  let bestMatch: AgentPersona | null = null
  let bestScore = 0

  if (taskText && available.length > 0) {
    const lower = taskText.toLowerCase()
    for (const persona of available) {
      const score = persona.specialties.reduce((sum, keyword) => {
        return sum + (lower.includes(keyword) ? 1 : 0)
      }, 0)
      if (score > bestScore) {
        bestScore = score
        bestMatch = persona
      }
    }
  }

  let persona: AgentPersona
  if (bestMatch && bestScore > 0) {
    persona = bestMatch
  } else if (available.length > 0) {
    // Deterministic pick from available based on session key hash
    persona = available[hashCode(sessionKey) % available.length]
  } else {
    // All 8 taken — hash into the full pool (allows duplicates beyond 8)
    persona = AGENT_PERSONAS[hashCode(sessionKey) % AGENT_PERSONAS.length]
  }

  assignedPersonas.set(sessionKey, persona)
  return persona
}

/** Remove a session's persona assignment (call when sessions disappear) */
export function releasePersona(sessionKey: string): void {
  assignedPersonas.delete(sessionKey)
}

/** Clear all assignments */
export function clearAllPersonas(): void {
  assignedPersonas.clear()
}

/** Get persona for a session (without assigning) */
export function getPersona(sessionKey: string): AgentPersona | undefined {
  return assignedPersonas.get(sessionKey)
}

/** Get display name for an agent session */
export function getAgentDisplayName(
  sessionKey: string,
  taskText?: string,
): string {
  const persona = assignPersona(sessionKey, taskText)
  return `${persona.emoji} ${persona.name}`
}

/** Get role label for an agent session */
export function getAgentRoleLabel(
  sessionKey: string,
  taskText?: string,
): string {
  const persona = assignPersona(sessionKey, taskText)
  return persona.role
}
