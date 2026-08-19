import { createFileRoute } from '@tanstack/react-router'
import { LogsScreen } from '@/screens/logs/logs-screen'
import { usePageTitle } from '@/hooks/use-page-title'

export const Route = createFileRoute('/logs')({
  component: function LogsRoute() {
    usePageTitle('系统日志')
    return <LogsScreen />
  },
})
