import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { PatternsCorrectionScreen } from '@/screens/patterns/patterns-corrections-screen'

export const Route = createFileRoute('/patterns')({
  component: function PatternsRoute() {
    usePageTitle('团队规则')
    return <PatternsCorrectionScreen />
  },
})
