import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { McpSettingsScreen } from '@/screens/settings/mcp-settings-screen'

export const Route = createFileRoute('/settings/mcp')({
  component: function SettingsMcpRoute() {
    usePageTitle('MCP 服务')
    return <McpSettingsScreen />
  },
})
