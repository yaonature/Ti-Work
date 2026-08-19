import { createFileRoute } from '@tanstack/react-router'
import { AuditTrailScreen } from '@/screens/audit/audit-trail-screen'
import { FeatureGate } from '@/components/feature-gate'
import { usePageTitle } from '@/hooks/use-page-title'

export const Route = createFileRoute('/audit')({
  component: function AuditRoute() {
    usePageTitle('审计记录')
    return (
      <FeatureGate feature="audit">
        <AuditTrailScreen />
      </FeatureGate>
    )
  },
})
