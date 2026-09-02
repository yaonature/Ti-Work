import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  ArrowUpRight01Icon,
} from '@hugeicons/core-free-icons'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { FeatureGate } from '@/components/feature-gate'
import { usePageTitle } from '@/hooks/use-page-title'
import { cn } from '@/lib/utils'
import { AuditTrailScreen } from '@/screens/audit/audit-trail-screen'
import {
  AccountCenterSection,
  HermesConfigSection,
  HubSection,
} from '@/routes/settings/index'

type SecurityTab = 'permissions' | 'audit' | 'account' | 'hub'
type SecurityAnchor = 'security-directory' | 'security-website' | 'security-risk'

const SECURITY_TABS: Array<{
  id: SecurityTab
  label: string
}> = [
  { id: 'permissions', label: '授权配置' },
  { id: 'audit', label: '审计记录' },
  { id: 'account', label: '账号授权' },
  { id: 'hub', label: '企业中枢' },
]

// ─── 真实授权状态读取（config.security 摘要）───────────────────────────────

interface SecurityStatus {
  directories: {
    mode: string
    allowed: Array<string>
    readonly: Array<string>
    blocked: Array<string>
  }
  website: {
    enabled: boolean
    mode: string
    allowed: Array<string>
    blocked: Array<string>
  }
  risk: {
    confirmation: Array<string>
    approval: Array<string>
  }
}

const EMPTY_STATUS: SecurityStatus = {
  directories: { mode: 'scoped', allowed: [], readonly: [], blocked: [] },
  website: { enabled: true, mode: 'balanced', allowed: [], blocked: [] },
  risk: { confirmation: [], approval: [] },
}

function useSecurityStatus() {
  return useQuery({
    queryKey: ['security-status'],
    queryFn: async (): Promise<SecurityStatus> => {
      const res = await fetch('/api/hermes-config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { config: Record<string, unknown> }
      const security = (data.config?.security as Record<string, unknown>) || {}
      const directoryAccess =
        (security.directory_access as Record<string, unknown>) || {}
      const websiteAccess =
        (security.website_access as Record<string, unknown>) || {}
      const websiteBlocklist =
        (security.website_blocklist as Record<string, unknown>) || {}
      const riskControls =
        (security.risk_controls as Record<string, unknown>) || {}
      const confirmation =
        (riskControls.require_confirmation as Record<string, unknown>) || {}
      const approval =
        (riskControls.require_approval as Record<string, unknown>) || {}

      const readStrings = (value: unknown): Array<string> =>
        Array.isArray(value)
          ? (value as Array<unknown>).map(String).filter(Boolean)
          : []
      const readEnabledKeys = (rules: Record<string, unknown>): Array<string> =>
        Object.entries(rules)
          .filter(([, value]) => value === true)
          .map(([key]) => key)

      const blockedDomains = Array.from(
        new Set([
          ...readStrings(websiteAccess.blocked_domains),
          ...readStrings(websiteBlocklist.domains),
        ]),
      )

      return {
        directories: {
          mode:
            typeof directoryAccess.mode === 'string'
              ? directoryAccess.mode
              : 'scoped',
          allowed: readStrings(directoryAccess.allowed_paths),
          readonly: readStrings(directoryAccess.readonly_paths),
          blocked: readStrings(directoryAccess.blocked_paths),
        },
        website: {
          enabled:
            typeof websiteAccess.enabled === 'boolean'
              ? websiteAccess.enabled
              : true,
          mode:
            typeof websiteAccess.mode === 'string'
              ? websiteAccess.mode
              : 'balanced',
          allowed: readStrings(websiteAccess.allowed_domains),
          blocked: blockedDomains,
        },
        risk: {
          confirmation: readEnabledKeys(confirmation),
          approval: readEnabledKeys(approval),
        },
      }
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

// ─── 页面 ────────────────────────────────────────────────────────────────────

function AuditRouteComponent() {
  usePageTitle('权限与安全')
  const [activeTab, setActiveTab] = useState<SecurityTab>('permissions')
  const statusQuery = useSecurityStatus()
  const status = statusQuery.data ?? EMPTY_STATUS

  const activeTabMeta = useMemo(
    () => SECURITY_TABS.find((item) => item.id === activeTab) ?? SECURITY_TABS[0],
    [activeTab],
  )

  const goConfigure = (anchor: SecurityAnchor) => {
    setActiveTab('permissions')
    // 通过 hash 让授权配置面板定位到对应区块（HermesConfigSection 监听 hashchange）
    window.location.hash = anchor
  }

  const goTab = (tab: SecurityTab) => {
    setActiveTab(tab)
    // 切出总览时清理授权区块锚点，避免再次进入时误滚动
    if (window.location.hash.startsWith('#security-')) {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }

  const directoryConfigured =
    status.directories.allowed.length > 0 ||
    status.directories.readonly.length > 0 ||
    status.directories.blocked.length > 0
  const websiteConfigured =
    status.website.enabled && (status.website.allowed.length > 0 ||
      status.website.blocked.length > 0 ||
      status.website.mode !== 'allowlist')
  const riskConfigured =
    status.risk.confirmation.length > 0 || status.risk.approval.length > 0

  // 尚未配置的授权领域：点击提醒可逐项直达对应配置块
  const unconfiguredDomains: Array<{
    key: 'directory' | 'website' | 'risk'
    label: string
    anchor: SecurityAnchor
    configured: boolean
  }> = [
    { key: 'directory', label: '目录访问', anchor: 'security-directory', configured: directoryConfigured },
    { key: 'website', label: '网站访问', anchor: 'security-website', configured: websiteConfigured },
    { key: 'risk', label: '风险动作', anchor: 'security-risk', configured: riskConfigured },
  ]
  const unconfiguredList = unconfiguredDomains.filter((item) => !item.configured)
  const unconfiguredCount = unconfiguredList.length

  return (
    <div
      className="min-h-full bg-[var(--theme-bg)] text-[var(--theme-text)]"
      data-testid="security_center_page"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-4 md:px-6 md:py-6">
        {/* 授权状态提醒：仅列未配置项，点击直达对应配置块 */}
        {!statusQuery.isLoading && unconfiguredCount > 0 && (
          <section
            className="rounded-2xl border border-[var(--theme-accent)]/30 bg-[var(--theme-accent)]/8 px-4 py-3 shadow-sm"
            data-testid="security_center_incomplete_alert"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--theme-text)]">
                <HugeiconsIcon icon={Alert02Icon} size={16} />
                有 {unconfiguredCount} 项授权尚未配置
              </span>
              <div className="flex flex-wrap gap-1.5">
                {unconfiguredList.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => goConfigure(item.anchor)}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-2.5 py-1 text-xs font-medium text-[var(--theme-text)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]"
                    data-testid={`security_incomplete_item_${item.key}`}
                  >
                    {item.label}
                    <HugeiconsIcon icon={ArrowUpRight01Icon} size={12} />
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Tab 切换 */}
        <section
          className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-3 shadow-sm"
          data-testid="security_center_tab_switcher"
        >
          <div className="flex flex-wrap gap-2">
            {SECURITY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => goTab(tab.id)}
                className={cn(
                  'rounded-xl border px-4 py-2 text-left transition-colors',
                  activeTab === tab.id
                    ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/10 text-[var(--theme-text)]'
                    : 'border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                )}
                data-testid={`security_center_tab_${tab.id}`}
              >
                <div className="text-sm font-medium">{tab.label}</div>
              </button>
            ))}
          </div>
        </section>

        <section
          className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] shadow-sm"
          data-testid="security_center_content"
        >
          <div
            className="border-b border-[var(--theme-border)] px-5 py-4"
            data-testid="security_center_content_header"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--theme-text)]">
                  {activeTabMeta.label}
                </h2>
              </div>
            </div>
          </div>

          <div className="p-5">
            {activeTab === 'permissions' && (
              <div data-testid="security_center_panel_permissions">
                <HermesConfigSection activeView="permissions" />
              </div>
            )}

            {activeTab === 'audit' && (
              <div data-testid="security_center_panel_audit">
                <FeatureGate feature="audit">
                  <AuditTrailScreen embedded />
                </FeatureGate>
              </div>
            )}

            {activeTab === 'account' && (
              <div data-testid="security_center_panel_account">
                <AccountCenterSection />
              </div>
            )}

            {activeTab === 'hub' && (
              <div data-testid="security_center_panel_hub">
                <HubSection />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/audit')({
  component: AuditRouteComponent,
})
