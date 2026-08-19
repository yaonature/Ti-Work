import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { AnalyticsScreen } from '@/screens/analytics/analytics-screen'

export const Route = createFileRoute('/analytics')({
  component: function AnalyticsRoute() {
    usePageTitle('使用分析')
    return <AnalyticsScreen />
  },
})
