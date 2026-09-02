import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { AgentLibraryScreen } from '@/screens/agents/agent-library-screen'

export const Route = createFileRoute('/agents')({
  component: AgentsRoute,
})

function AgentsRoute() {
  usePageTitle('数字员工')
  return <AgentLibraryScreen />
}
