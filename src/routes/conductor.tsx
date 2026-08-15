import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { ConductorScreen } from '@/screens/conductor/conductor-screen'
import { FeatureGate } from '@/components/feature-gate'

export const Route = createFileRoute('/conductor')({
  component: function ConductorRoute() {
    usePageTitle('调度台')
    return (
      <FeatureGate feature="orchestration">
        <ConductorScreen />
      </FeatureGate>
    )
  },
})
