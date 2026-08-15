import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from '@/components/ui/scroll-area'
import { Markdown } from '@/components/prompt-kit/markdown'
import { cn } from '@/lib/utils'
import { EmojiIcon } from '@/components/emoji-icon'
import { writeTextToClipboard } from '@/lib/clipboard'
import { toast } from '@/components/ui/toast'

type SkillsTab = 'installed' | 'marketplace' | 'featured'
type SkillsSort = 'name' | 'category'

type SecurityRisk = {
  level: 'safe' | 'low' | 'medium' | 'high'
  flags: Array<string>
  score: number
}

type SkillSummary = {
  id: string
  slug: string
  name: string
  description: string
  author: string
  triggers: Array<string>
  tags: Array<string>
  homepage: string | null
  category: string
  icon: string
  content: string
  fileCount: number
  sourcePath: string
  installed: boolean
  enabled: boolean
  featuredGroup?: string
  security?: SecurityRisk
}

type SkillsApiResponse = {
  skills: Array<SkillSummary>
  total: number
  page: number
  categories: Array<string>
}

type SkillSearchTier = 0 | 1 | 2 | 3

type HubSkill = {
  id: string
  name: string
  description: string
  author: string
  category: string
  tags: Array<string>
  downloads?: number
  stars?: number
  source: 'skillsmp' | 'skills-sh' | 'official' | 'github' | 'installed-fallback'
  installCommand?: string
  homepage?: string
  installed: boolean
  /** GitHub tree URL used by install handler to download skill files */
  githubUrl?: string
}

type HubSearchResponse = {
  results: Array<HubSkill>
  source: string
  error?: string
}

const PAGE_LIMIT = 30

const DEFAULT_CATEGORIES = [
  'All',
  'Web & Frontend',
  'Coding Agents',
  'Git & GitHub',
  'DevOps & Cloud',
  'Browser & Automation',
  'Image & Video',
  'Search & Research',
  'AI & LLMs',
  'Productivity',
  'Marketing & Sales',
  'Communication',
  'Data & Analytics',
  'Finance & Crypto',
]

const CATEGORY_LABELS: Record<string, string> = {
  'All': '全部',
  'Web & Frontend': 'Web 与前端',
  'Coding Agents': '编码智能体',
  'Git & GitHub': 'Git 与 GitHub',
  'DevOps & Cloud': 'DevOps 与云',
  'Browser & Automation': '浏览器与自动化',
  'Image & Video': '图像与视频',
  'Search & Research': '搜索与研究',
  'AI & LLMs': 'AI 与 LLM',
  'Productivity': '效率工具',
  'Marketing & Sales': '营销与销售',
  'Communication': '沟通协作',
  'Data & Analytics': '数据与分析',
  'Finance & Crypto': '金融与加密',
}

function resolveSkillSearchTier(
  skill: SkillSummary,
  query: string,
): SkillSearchTier {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return 0

  if (skill.name.toLowerCase().includes(normalizedQuery)) return 0

  const tagText = skill.tags.join(' ').toLowerCase()
  const triggerText = skill.triggers.join(' ').toLowerCase()
  if (
    tagText.includes(normalizedQuery) ||
    triggerText.includes(normalizedQuery)
  ) {
    return 1
  }

  if (skill.description.toLowerCase().includes(normalizedQuery)) return 2
  return 3
}

export function SkillsScreen() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<SkillsTab>('installed')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedMarketplaceSearch, setDebouncedMarketplaceSearch] =
    useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState<SkillsSort>('name')
  const [page, setPage] = useState(1)
  const [actionSkillId, setActionSkillId] = useState<string | null>(null)
  const [actionType, setActionType] = useState<'install' | 'uninstall' | 'toggle' | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<SkillSummary | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // clawhubHint removed — not applicable in Hermes Studio local deployment

  useEffect(() => {
    if (tab !== 'marketplace') return

    const timeout = window.setTimeout(() => {
      setDebouncedMarketplaceSearch(searchInput)
    }, 250)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [searchInput, tab])

  const skillsQuery = useQuery({
    queryKey: ['skills-browser', tab, searchInput, category, page, sort],
    queryFn: async function fetchSkills(): Promise<SkillsApiResponse> {
      const params = new URLSearchParams()
      params.set('tab', tab)
      params.set('search', searchInput)
      params.set('category', category)
      params.set('page', String(page))
      params.set('limit', String(PAGE_LIMIT))
      params.set('sort', sort)

      const response = await fetch(`/api/skills?${params.toString()}`)
      const payload = (await response.json()) as SkillsApiResponse & {
        error?: string
      }
      if (!response.ok) {
        throw new Error(payload.error || '加载技能失败')
      }
      return payload
    },
  })

  const hubQuery = useQuery({
    queryKey: ['skills-hub-search', debouncedMarketplaceSearch],
    enabled: tab === 'marketplace',
    queryFn: async function fetchHubResults(): Promise<HubSearchResponse> {
      const params = new URLSearchParams()
      params.set('q', debouncedMarketplaceSearch)
      params.set('source', 'all')
      params.set('limit', '20')

      const response = await fetch(
        `/api/skills/hub-search?${params.toString()}`,
      )
      const payload = (await response.json()) as HubSearchResponse
      if (!response.ok) {
        throw new Error(payload.error || '搜索技能中心失败')
      }
      return payload
    },
  })

  const categories = useMemo(
    function resolveCategories() {
      const fromApi = skillsQuery.data?.categories
      if (Array.isArray(fromApi) && fromApi.length > 0) {
        return fromApi
      }
      return DEFAULT_CATEGORIES
    },
    [skillsQuery.data?.categories],
  )

  const totalPages = Math.max(
    1,
    Math.ceil((skillsQuery.data?.total || 0) / PAGE_LIMIT),
  )

  const skills = useMemo(
    function resolveVisibleSkills() {
      const sourceSkills = skillsQuery.data?.skills || []
      const normalizedQuery = searchInput.trim().toLowerCase()
      if (!normalizedQuery) {
        return sourceSkills
      }

      return sourceSkills
        .map(function mapSkillToTier(skill, index) {
          return {
            skill,
            index,
            tier: resolveSkillSearchTier(skill, normalizedQuery),
          }
        })
        .sort(function sortByTierThenOriginalOrder(a, b) {
          if (a.tier !== b.tier) return a.tier - b.tier
          return a.index - b.index
        })
        .map(function unwrapSkill(entry) {
          return entry.skill
        })
    },
    [searchInput, skillsQuery.data?.skills],
  )

  const marketplaceSkills = useMemo<Array<SkillSummary>>(
    function resolveMarketplaceSkills() {
      return (hubQuery.data?.results || []).map(function mapHubSkill(skill) {
        return {
          id: skill.id,
          slug: skill.id,
          name: skill.name,
          description: skill.description,
          author: skill.author,
          triggers: skill.tags,
          tags: skill.tags,
          homepage: skill.homepage || null,
          category: skill.category || 'Productivity',
          icon:
            skill.source === 'skillsmp'
              ? '🛒'
              : skill.source === 'github'
                ? '🐙'
                : skill.source === 'official'
                  ? '✅'
                  : '🧩',
          content: [skill.description, skill.installCommand]
            .filter(Boolean)
            .join('\n\n'),
          fileCount: 0,
          sourcePath: skill.homepage || skill.source,
          installed: skill.installed,
          enabled: skill.installed,
          featuredGroup: undefined,
          security: {
            level: 'safe',
            flags: [],
            score: 0,
          },
        }
      })
    },
    [hubQuery.data?.results],
  )

  async function copyCommandAndToast(command: string, message: string) {
    try {
      await writeTextToClipboard(command)
      toast(`${message} Copied: ${command}`, {
        type: 'warning',
        icon: '📋',
      })
    } catch {
      toast(`${message} ${command}`, {
        type: 'warning',
        icon: '📋',
        duration: 7000,
      })
    }
  }

  async function runSkillAction(
    action: 'install' | 'uninstall' | 'toggle',
    payload: {
      skillId: string
      enabled?: boolean
      source?: HubSkill['source']
      githubUrl?: string
    },
  ) {
    setActionError(null)
    setActionSkillId(payload.skillId)
    setActionType(action)

    try {
      const endpoint =
        action === 'install'
          ? '/api/skills/install'
          : action === 'uninstall'
            ? '/api/skills/uninstall'
            : '/api/skills'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          skillId: payload.skillId,
          enabled: payload.enabled,
          source: payload.source,
          githubUrl: payload.githubUrl,
        }),
      })

      const data = (await response.json()) as {
        error?: string
        command?: string
        ok?: boolean
      }

      if (!response.ok) {
        throw new Error(data.error || '操作失败')
      }

      if (
        (action === 'install' || action === 'uninstall') &&
        data.ok === false
      ) {
        throw new Error(data.error || '操作失败')
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['skills-browser'] }),
        queryClient.invalidateQueries({ queryKey: ['skills-hub-search'] }),
      ])

      if (action === 'install') {
        toast(`${payload.skillId} 已安装`, { type: 'success', icon: '✅' })
      } else if (action === 'uninstall') {
        toast(`${payload.skillId} 已卸载`, { type: 'info', icon: '🗑️' })
      }

      setSelectedSkill(function updateSelectedSkill(current) {
        if (!current || current.id !== payload.skillId) return current
        if (action === 'install') {
          return { ...current, installed: true, enabled: true }
        }
        if (action === 'uninstall') {
          return { ...current, installed: false, enabled: false }
        }
        return { ...current, enabled: payload.enabled ?? current.enabled }
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setActionError(errorMessage)
      toast(errorMessage, { type: 'error', icon: '❌' })
    } finally {
      setActionSkillId(null)
      setActionType(null)
    }
  }

  function handleTabChange(nextTab: string) {
    const parsedTab: SkillsTab =
      nextTab === 'installed' ||
      nextTab === 'marketplace' ||
      nextTab === 'featured'
        ? nextTab
        : 'installed'

    setTab(parsedTab)
    setPage(1)
    if (parsedTab !== 'marketplace') {
      setCategory('All')
      setSort('name')
    }
  }

  function handleSearchChange(value: string) {
    setSearchInput(value)
    setPage(1)
  }

  function handleCategoryChange(value: string) {
    setCategory(value)
    setPage(1)
  }

  function handleSortChange(value: SkillsSort) {
    setSort(value)
    setPage(1)
  }

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)]/85 p-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase text-[var(--theme-muted)] tabular-nums">
                Ti Work 市场
              </p>
              <h1 className="text-2xl font-medium text-ink text-balance sm:text-3xl">
                技能浏览器
              </h1>
              <p className="text-sm text-[var(--theme-muted)] text-pretty sm:text-base">
                在本地工作区与技能中心发现、安装和管理技能。
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-3 backdrop-blur-xl sm:p-4">
          <Tabs value={tab} onValueChange={handleTabChange}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList
                className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-1 sm:w-auto"
                variant="default"
              >
                <TabsTab value="installed" className="flex-1 sm:min-w-[132px]">
                  已安装
                </TabsTab>
                <TabsTab
                  value="marketplace"
                  className="flex-1 sm:min-w-[168px]"
                >
                  市场
                </TabsTab>
                <TabsTab value="featured" className="flex-1 sm:min-w-[120px]">
                  精选
                </TabsTab>
              </TabsList>

              {tab !== 'marketplace' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={searchInput}
                    onChange={(event) => handleSearchChange(event.target.value)}
                    placeholder="按名称、标签或描述搜索"
                    className="h-9 w-full min-w-0 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-panel)] px-3 text-sm text-ink outline-none transition-colors focus:border-[var(--theme-accent)] sm:min-w-[220px]"
                  />

                  {tab === 'installed' ? (
                    <select
                      value={category}
                      onChange={(event) =>
                        handleCategoryChange(event.target.value)
                      }
                      className="h-9 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-panel)] px-3 text-sm text-ink outline-none"
                    >
                      {categories.map((item) => (
                        <option key={item} value={item}>
                          {CATEGORY_LABELS[item] ?? item}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {tab === 'installed' ? (
                    <select
                      value={sort}
                      onChange={(event) =>
                        handleSortChange(
                          event.target.value === 'category'
                            ? 'category'
                            : 'name',
                        )
                      }
                      className="h-9 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-panel)] px-3 text-sm text-ink outline-none"
                    >
                      <option value="name">名称 A-Z</option>
                      <option value="category">分类</option>
                    </select>
                  ) : null}
                </div>
              ) : null}
            </div>

            {actionError ? (
              <p className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-panel)] px-3 py-2 text-sm text-ink">
                {actionError}
              </p>
            ) : null}
            {actionSkillId && actionType === 'install' ? (
              <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700   ">
                正在安装 {actionSkillId}... 可能需要 2 分钟。
              </p>
            ) : null}

            <TabsPanel value="installed" className="pt-2">
              <SkillsGrid
                skills={skills}
                loading={skillsQuery.isPending}
                actionSkillId={actionSkillId}
                tab="installed"
                onOpenDetails={setSelectedSkill}
                onInstall={(skillId) => runSkillAction('install', { skillId })}
                onUninstall={(skillId) =>
                  runSkillAction('uninstall', { skillId })
                }
                onToggle={(skillId, enabled) =>
                  runSkillAction('toggle', { skillId, enabled })
                }
              />
            </TabsPanel>

            <TabsPanel value="marketplace" className="space-y-3 pt-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <input
                  value={searchInput}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder="搜索技能..."
                  className="h-10 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-panel)] px-3 text-sm text-ink outline-none transition-colors focus:border-primary"
                />
                <div className="text-xs text-[var(--theme-muted)] sm:text-right">
                  {hubQuery.data?.source === 'skillsmp'
                    ? '来源：skillsmp.com'
                    : hubQuery.data?.source === 'installed-fallback'
                      ? '来源：本地 ~/.hermes/skills'
                      : ''}
                </div>
              </div>

              {hubQuery.data?.source === 'no-api-key' ? (
                <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] px-4 py-4 text-sm text-[var(--theme-text)]">
                  <p className="font-medium mb-1">未配置 skillsmp.com API 密钥</p>
                  <p className="text-[var(--theme-muted)] text-pretty">
                    要搜索技能市场，请在{' '}
                    <a href="/settings" className="underline underline-offset-2 hover:opacity-80">
                      设置 → 集成
                    </a>
                    中添加你的 API 密钥。{' '}
                    <a
                      href="https://skillsmp.com/docs/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:opacity-80"
                    >
                      在 skillsmp.com 获取 API 密钥 →
                    </a>
                  </p>
                </div>
              ) : hubQuery.error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {hubQuery.error instanceof Error
                    ? hubQuery.error.message
                    : '加载市场技能失败。'}
                </div>
              ) : null}

              <SkillsGrid
                skills={marketplaceSkills}
                loading={hubQuery.isPending && (hubQuery.data as HubSearchResponse | undefined)?.source !== 'no-api-key'}
                actionSkillId={actionSkillId}
                tab="marketplace"
                emptyState={{
                  title: searchInput.trim()
                    ? '未找到技能'
                    : '搜索技能',
                  description: searchInput.trim()
                    ? '尝试不同的搜索词。'
                    : '输入关键词开始搜索可用技能。',
                }}
                onOpenDetails={setSelectedSkill}
                onInstall={(skillId) => {
                  const skill = hubQuery.data?.results.find(
                    (entry) => entry.id === skillId,
                  )
                  runSkillAction('install', {
                    skillId,
                    source: skill?.source,
                    githubUrl: skill?.githubUrl,
                  })
                }}
                onUninstall={(skillId) =>
                  runSkillAction('uninstall', { skillId })
                }
                onToggle={(skillId, enabled) =>
                  runSkillAction('toggle', { skillId, enabled })
                }
              />
            </TabsPanel>

            <TabsPanel value="featured" className="pt-2">
              <FeaturedGrid
                skills={skills}
                loading={skillsQuery.isPending}
                actionSkillId={actionSkillId}
                onOpenDetails={setSelectedSkill}
                onInstall={(skillId) => runSkillAction('install', { skillId })}
                onUninstall={(skillId) =>
                  runSkillAction('uninstall', { skillId })
                }
              />
            </TabsPanel>
          </Tabs>
        </section>

        {tab !== 'featured' && tab !== 'marketplace' ? (
          <footer className="flex items-center justify-between rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] px-3 py-2.5 text-sm text-[var(--theme-muted)] tabular-nums">
            <span>
              共 {(skillsQuery.data?.total || 0).toLocaleString()} 个技能
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || skillsQuery.isPending}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                上一页
              </Button>
              <span className="min-w-[82px] text-center">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || skillsQuery.isPending}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                下一页
              </Button>
            </div>
          </footer>
        ) : null}
      </div>

      <DialogRoot
        open={Boolean(selectedSkill)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSkill(null)
          }
        }}
      >
        <DialogContent className="w-[min(960px,95vw)] border-[var(--theme-border)] bg-[var(--theme-bg)]/95 backdrop-blur-sm">
          {selectedSkill ? (
            <div className="flex max-h-[85vh] flex-col">
              <div className="border-b border-[var(--theme-border)] px-5 py-4">
                <DialogTitle className="text-balance">
                  <EmojiIcon emoji={selectedSkill.icon} size={16} />{' '}
                  {selectedSkill.name}
                </DialogTitle>
                <DialogDescription className="mt-1 text-pretty">
                  作者：{selectedSkill.author} • {CATEGORY_LABELS[selectedSkill.category] ?? selectedSkill.category} • {selectedSkill.fileCount.toLocaleString()} 个文件
                </DialogDescription>
                {selectedSkill.security && (
                  <div className="mt-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] overflow-hidden">
                    <SecurityBadge
                      security={selectedSkill.security}
                      compact={false}
                    />
                  </div>
                )}
              </div>

              <ScrollAreaRoot className="h-[56vh]">
                <ScrollAreaViewport className="px-5 py-4">
                  <div className="space-y-3">
                    {selectedSkill.homepage ? (
                      <p className="text-sm text-[var(--theme-muted)] text-pretty">
                        主页：{' '}
                        <a
                          href={selectedSkill.homepage}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-border underline-offset-4 hover:decoration-primary"
                        >
                          {selectedSkill.homepage}
                        </a>
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-1.5">
                      {selectedSkill.triggers.length > 0 ? (
                        selectedSkill.triggers.slice(0, 8).map((trigger) => (
                          <span
                            key={trigger}
                            className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-panel)] px-2 py-0.5 text-xs text-[var(--theme-muted)]"
                          >
                            {trigger}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-panel)] px-2 py-0.5 text-xs text-[var(--theme-muted)]">
                          未列出触发器
                        </span>
                      )}
                    </div>

                    <article className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-4 backdrop-blur-sm">
                      <Markdown>
                        {selectedSkill.content ||
                          `# ${selectedSkill.name}\n\n${selectedSkill.description}`}
                      </Markdown>
                    </article>
                  </div>
                </ScrollAreaViewport>
                <ScrollAreaScrollbar>
                  <ScrollAreaThumb />
                </ScrollAreaScrollbar>
              </ScrollAreaRoot>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--theme-border)] px-5 py-3">
                <p className="text-sm text-[var(--theme-muted)] text-pretty">
                  来源：{' '}
                  <code className="inline-code">
                    {selectedSkill.sourcePath}
                  </code>
                </p>
                <div className="flex items-center gap-2">
                  {selectedSkill.installed ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionSkillId === selectedSkill.id}
                      onClick={() => {
                        runSkillAction('uninstall', {
                          skillId: selectedSkill.id,
                        })
                      }}
                    >
                      {actionSkillId === selectedSkill.id ? (
                        <>
                          <EmojiIcon emoji="⏳" size={12} /> 卸载中…
                        </>
                      ) : (
                        '卸载'
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={actionSkillId === selectedSkill.id}
                      onClick={() =>
                        runSkillAction('install', { skillId: selectedSkill.id })
                      }
                    >
                      {actionSkillId === selectedSkill.id ? (
                        <>
                          <EmojiIcon emoji="⏳" size={12} /> 安装中…
                        </>
                      ) : (
                        '安装'
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSkill(null)}
                  >
                    关闭
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </DialogRoot>
    </div>
  )
}

type SkillsGridProps = {
  skills: Array<SkillSummary>
  loading: boolean
  actionSkillId: string | null
  tab: 'installed' | 'marketplace'
  emptyState?: {
    title: string
    description: string
  }
  onOpenDetails: (skill: SkillSummary) => void
  onInstall: (skillId: string) => void
  onUninstall: (skillId: string) => void
  onToggle: (skillId: string, enabled: boolean) => void
}

const SECURITY_BADGE: Record<
  string,
  { label: string; badgeClass: string; confidence: string }
> = {
  safe: {
    label: '安全',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    confidence: '高置信度',
  },
  low: {
    label: '安全',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    confidence: '中',
  },
  medium: {
    label: '谨慎',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
    confidence: '建议审查',
  },
  high: {
    label: '警告',
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
    confidence: '需要人工审查',
  },
}

function SecurityBadge({
  security,
  compact = true,
}: {
  security?: SecurityRisk
  compact?: boolean
}) {
  if (!security) return null
  const config = SECURITY_BADGE[security.level]
  if (!config) return null

  const [expanded, setExpanded] = useState(false)

  // Compact badge for card grid
  if (compact) {
    return (
      <div className="relative">
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors',
            config.badgeClass,
          )}
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
        >
          {config.label}
        </button>
        {expanded && (
          <div className="absolute left-0 bottom-[calc(100%+6px)] z-50 w-72 rounded-xl border border-[var(--theme-border)] bg-surface p-0 shadow-xl overflow-hidden">
            <SecurityScanCard security={security} />
          </div>
        )}
      </div>
    )
  }

  // Full card for detail dialog
  return <SecurityScanCard security={security} />
}

function SecurityScanCard({ security }: { security: SecurityRisk }) {
  const [showDetails, setShowDetails] = useState(false)
  const config = SECURITY_BADGE[security.level]
  if (!config) return null

  const summaryText =
    security.flags.length === 0
      ? '未检测到风险模式，该技能可以安全安装。'
      : security.level === 'high'
        ? `发现 ${security.flags.length} 个潜在安全风险，安装前请审查。`
        : `已扫描该技能代码中的常见风险模式，发现 ${security.flags.length} 个。`

  return (
    <div className="text-xs">
      <div className="px-3 pt-3 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] mb-2">
          安全扫描
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[var(--theme-muted)] font-medium w-16 shrink-0">
              Ti Work
            </span>
            <span
              className={cn(
                'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
                config.badgeClass,
              )}
            >
              {config.label}
            </span>
            <span className="text-[10px] text-[var(--theme-muted)] uppercase tracking-wide font-medium">
              {config.confidence}
            </span>
          </div>
        </div>
      </div>
      <div className="px-3 pb-2">
        <p className="text-[var(--theme-muted)] text-pretty leading-relaxed">
          {summaryText}
        </p>
      </div>
      {security.flags.length > 0 && (
        <div className="border-t border-primary-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowDetails((v) => !v)
            }}
            className="flex w-full items-center justify-between px-3 py-2 text-accent-500 hover:text-accent-600 transition-colors"
          >
            <span className="text-[11px] font-medium">详情</span>
            <span className="text-[10px]">
              <EmojiIcon emoji={showDetails ? '▲' : '▼'} size={12} />
            </span>
          </button>
          {showDetails && (
            <div className="px-3 pb-3 space-y-1">
              {security.flags.map((flag) => (
                <div
                  key={flag}
                  className="flex items-start gap-2 text-[var(--theme-muted)]"
                >
                  <span className="mt-0.5 text-[var(--theme-muted)]">
                    <EmojiIcon emoji="●" size={9} />
                  </span>
                  <span>{flag}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="border-t border-primary-100 px-3 py-2">
        <p className="text-[10px] text-[var(--theme-muted)] italic">
          多层防护 — 运行前请务必审查代码。
        </p>
      </div>
    </div>
  )
}

function SkillsGrid({
  skills,
  loading,
  actionSkillId,
  tab,
  emptyState,
  onOpenDetails,
  onInstall,
  onUninstall,
  onToggle,
}: SkillsGridProps) {
  if (loading) {
    return <SkillsSkeleton count={tab === 'installed' ? 6 : 9} />
  }

  if (skills.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-panel)]/40 px-4 py-8 text-center">
        <p className="text-sm font-medium text-[var(--theme-text)]">
          {emptyState?.title || '未找到技能'}
        </p>
        <p className="mt-1 text-xs text-[var(--theme-muted)] text-pretty max-w-sm mx-auto">
          {emptyState?.description ||
            '尝试调整筛选条件或搜索词'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence initial={false}>
        {skills.map((skill) => {
          const isActing = actionSkillId === skill.id

          return (
            <motion.article
              key={`${tab}-${skill.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="flex min-h-[220px] flex-col rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)]/85 p-4 shadow-sm backdrop-blur-sm"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <EmojiIcon emoji={skill.icon} size={20} />
                  <h3 className="line-clamp-1 text-base font-medium text-ink text-balance">
                    {skill.name}
                  </h3>
                  <p className="line-clamp-1 text-xs text-[var(--theme-muted)]">
                    作者：{skill.author}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-md border px-2 py-0.5 text-xs tabular-nums',
                    skill.installed
                      ? 'border-primary/40 bg-primary/15 text-primary'
                      : 'border-[var(--theme-border)] bg-[var(--theme-panel)] text-[var(--theme-muted)]',
                  )}
                >
                  {skill.installed ? '已安装' : '可安装'}
                </span>
              </div>

              <p className="line-clamp-3 min-h-[58px] text-sm text-[var(--theme-muted)] text-pretty">
                {skill.description}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <SecurityBadge security={skill.security} />
                <span className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-panel)] px-2 py-0.5 text-xs text-[var(--theme-muted)]">
                  {skill.category}
                </span>
                {skill.triggers.slice(0, 2).map((trigger) => (
                  <span
                    key={`${skill.id}-${trigger}`}
                    className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-panel)] px-2 py-0.5 text-xs text-[var(--theme-muted)]"
                  >
                    {trigger}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenDetails(skill)}
                >
                  详情
                </Button>

                {tab === 'installed' ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-[var(--theme-muted)]">
                      <Switch
                        checked={skill.enabled}
                        disabled={isActing}
                        onCheckedChange={(checked) =>
                          onToggle(skill.id, checked)
                        }
                        aria-label={`切换 ${skill.name}`}
                      />
                      {skill.enabled ? '已启用' : '已停用'}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isActing}
                      onClick={() => onUninstall(skill.id)}
                    >
                      {isActing ? <EmojiIcon emoji="⏳" size={14} /> : '卸载'}
                    </Button>
                  </div>
                ) : skill.installed ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isActing}
                    onClick={() => onUninstall(skill.id)}
                  >
                    {isActing ? <EmojiIcon emoji="⏳" size={14} /> : '卸载'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={isActing}
                    onClick={() => onInstall(skill.id)}
                  >
                    {isActing ? (
                      <>
                        <EmojiIcon emoji="⏳" size={14} /> 安装中…
                      </>
                    ) : (
                      '安装'
                    )}
                  </Button>
                )}
              </div>
            </motion.article>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

type FeaturedGridProps = {
  skills: Array<SkillSummary>
  loading: boolean
  actionSkillId: string | null
  onOpenDetails: (skill: SkillSummary) => void
  onInstall: (skillId: string) => void
  onUninstall: (skillId: string) => void
}

function FeaturedGrid({
  skills,
  loading,
  actionSkillId,
  onOpenDetails,
  onInstall,
  onUninstall,
}: FeaturedGridProps) {
  if (loading) {
    return <SkillsSkeleton count={6} large />
  }

  if (skills.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-panel)]/40 px-4 py-10 text-center text-sm text-[var(--theme-muted)] text-pretty">
        暂无精选推荐。
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 pb-2 lg:grid-cols-2">
      {skills.map((skill) => {
        const isActing = actionSkillId === skill.id
        return (
          <article
            key={skill.id}
            className="flex min-h-0 flex-col rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)]/85 p-4 shadow-sm backdrop-blur-sm"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-[var(--theme-muted)] tabular-nums">
                  {skill.featuredGroup || '编辑精选'}
                </p>
                <h3 className="text-lg font-medium text-ink text-balance">
                  <EmojiIcon emoji={skill.icon} size={16} /> {skill.name}
                </h3>
                <p className="text-sm text-[var(--theme-muted)]">作者：{skill.author}</p>
              </div>

              <span
                className={cn(
                  'rounded-md border px-2 py-0.5 text-xs tabular-nums',
                  skill.installed
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-[var(--theme-border)] bg-[var(--theme-panel)] text-[var(--theme-muted)]',
                )}
              >
                {skill.installed ? '已安装' : '编辑精选'}
              </span>
            </div>

            <p className="line-clamp-3 mb-3 text-sm text-[var(--theme-muted)] text-pretty">
              {skill.description}
            </p>

            <div className="mt-auto flex items-center justify-between gap-2 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenDetails(skill)}
              >
                详情
              </Button>
              {skill.installed ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isActing}
                  onClick={() => onUninstall(skill.id)}
                >
                  卸载
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={isActing}
                  onClick={() => onInstall(skill.id)}
                >
                  安装
                </Button>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function SkillsSkeleton({
  count,
  large = false,
}: {
  count: number
  large?: boolean
}) {
  return (
    <div
      className={cn(
        'grid gap-3',
        large
          ? 'grid-cols-1 lg:grid-cols-2'
          : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'animate-pulse rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)]/70 p-4',
            large ? 'min-h-[120px]' : 'min-h-[100px]',
          )}
        >
          <div className="mb-3 h-5 w-2/5 rounded-md bg-[var(--theme-panel)]" />
          <div className="mb-2 h-4 w-3/4 rounded-md bg-[var(--theme-panel)]" />
          <div className="h-4 w-1/2 rounded-md bg-[var(--theme-panel)]" />
          <div className="mt-4 h-20 rounded-xl bg-[var(--theme-panel)]/80" />
          <div className="mt-4 h-8 w-1/3 rounded-md bg-[var(--theme-panel)]" />
        </div>
      ))}
    </div>
  )
}
