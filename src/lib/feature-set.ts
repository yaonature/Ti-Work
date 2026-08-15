/**
 * 商业功能集（featureSet）枚举与授权判断 —— 单机版订阅门禁统一收敛点。
 *
 * 双轨授权（development-guide §6.4 定稿）：
 *  - 免费版：零授权文件，本地全功能裁剪呈现（个人生产力核心）
 *  - 标准版：本地授权文件（Ed25519 验签），解锁 集成/编排/多智能体
 *  - 专业版：企业中枢订阅（浮动席位 + 心跳），企业管控层
 *
 * 门禁公式：功能可用 = 商业授权可用 && 技术能力可用（两类失败分别提示：
 * 技术失败 → "网关未连接"；商业失败 → FeatureLockedCard 升级 CTA）。
 */
export type FeatureId =
  // 本地全功能（单机版匿名/软登录即具备，不设商业门槛）
  | 'chat'
  | 'memory'
  | 'skills'
  | 'terminal'
  | 'approvals'
  | 'model-config'
  | 'mcp'
  | 'multi-agent'
  // 订阅增值（标准版解锁）
  | 'integrations'
  | 'orchestration'
  // 企业管控层（专业版/企业中枢解锁）
  | 'audit'
  | 'team-learning'
  | 'floating-seats'

export type PlanId = 'free' | 'standard' | 'professional'

/** 各功能的最低授权档位 */
export const FEATURE_MIN_PLAN: Record<FeatureId, PlanId> = {
  chat: 'free',
  memory: 'free',
  skills: 'free',
  terminal: 'free',
  approvals: 'free',
  'model-config': 'free',
  mcp: 'free',
  'multi-agent': 'free',
  integrations: 'standard',
  orchestration: 'standard',
  audit: 'professional',
  'team-learning': 'professional',
  'floating-seats': 'professional',
}

/** 计划档位顺序（用于比较高低） */
const PLAN_ORDER: Record<PlanId, number> = {
  free: 0,
  standard: 1,
  professional: 2,
}

export function planRank(plan: PlanId): number {
  return PLAN_ORDER[plan]
}

/** 统一授权判断：plan 是否解锁某功能 */
export function canUsePlan(plan: PlanId, feature: FeatureId): boolean {
  return planRank(plan) >= planRank(FEATURE_MIN_PLAN[feature])
}

/** 商业授权来源：本地默认计划 / 中枢下发 featureSet */
export interface LicenseSnapshot {
  plan: PlanId
  featureSet: Array<FeatureId>
  /** 到期时间戳（null = 永久/免费） */
  expiresAt: number | null
  /** 来源描述：'local'（单机版）| 'hub'（企业中枢）| 'file'（授权文件） */
  source: 'local' | 'hub' | 'file'
}

/** 由中枢 featureSet 数组推导计划档位 */
export function derivePlanFromFeatureSet(
  featureSet: Array<string>,
): PlanId {
  if (featureSet.includes('floating-seats') || featureSet.includes('professional'))
    return 'professional'
  if (featureSet.includes('integrations') || featureSet.includes('standard'))
    return 'standard'
  return 'free'
}

/** 计划展示信息（账号中心 / FeatureLockedCard 复用） */
export interface PlanMeta {
  id: PlanId
  name: string
  tagline: string
  features: Array<FeatureId>
  cta: string
  badge?: string
}

export const PLAN_META: Record<PlanId, PlanMeta> = {
  free: {
    id: 'free',
    name: '免费版',
    tagline: '本地全功能：聊天 / Agent / 记忆 / 技能 / 多智能体',
    features: [
      'chat',
      'memory',
      'skills',
      'terminal',
      'approvals',
      'model-config',
      'mcp',
      'multi-agent',
    ],
    cta: '升级解锁订阅增值',
  },
  standard: {
    id: 'standard',
    name: '标准版',
    tagline: '完整 AI 能力 + 集成 / 编排',
    features: [
      'chat',
      'memory',
      'skills',
      'terminal',
      'approvals',
      'model-config',
      'mcp',
      'multi-agent',
      'integrations',
      'orchestration',
    ],
    cta: '升级专业版（企业管控）',
  },
  professional: {
    id: 'professional',
    name: '专业版',
    tagline: '企业管控层：审计/席位/团队模式库',
    features: [
      'chat',
      'memory',
      'skills',
      'terminal',
      'approvals',
      'model-config',
      'mcp',
      'integrations',
      'orchestration',
      'multi-agent',
      'audit',
      'team-learning',
      'floating-seats',
    ],
    cta: '联系销售',
    badge: '旗舰',
  },
}

export const FEATURE_LABELS: Record<FeatureId, string> = {
  chat: '对话',
  memory: '记忆',
  skills: '技能',
  terminal: '终端',
  approvals: '审批',
  'model-config': '模型与服务商',
  mcp: 'MCP 服务器',
  integrations: '第三方集成',
  orchestration: '智能编排',
  'multi-agent': '多智能体',
  audit: '审计日志',
  'team-learning': '团队模式库',
  'floating-seats': '浮动席位',
}
