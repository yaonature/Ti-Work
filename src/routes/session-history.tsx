import { createFileRoute } from '@tanstack/react-router'
import { SessionHistoryScreen } from '@/screens/session-history/session-history-screen'
import { usePageTitle } from '@/hooks/use-page-title'

export const Route = createFileRoute('/session-history')({
  component: function SessionHistoryRoute() {
    usePageTitle('业务记录')
    return <SessionHistoryScreen />
  },
})
