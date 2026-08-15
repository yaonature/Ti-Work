import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { LineageScreen } from '@/screens/lineage/lineage-screen'

export const Route = createFileRoute('/lineage')({
  component: function LineageRoute() {
    usePageTitle('任务血缘')
    return <LineageScreen />
  },
})
