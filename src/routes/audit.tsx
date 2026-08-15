import { createFileRoute } from '@tanstack/react-router'
import { AuditTrailScreen } from '@/screens/audit/audit-trail-screen'
import { FeatureGate } from '@/components/feature-gate'

export const Route = createFileRoute('/audit')({
  component: function AuditRoute() {
    return (
      <FeatureGate feature="audit">
        <AuditTrailScreen />
      </FeatureGate>
    )
  },
})
