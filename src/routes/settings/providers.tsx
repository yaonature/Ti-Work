import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { ProvidersScreen } from '@/screens/settings/providers-screen'

export const Route = createFileRoute('/settings/providers')({
  component: function SettingsProvidersRoute() {
    usePageTitle('提供方配置')
    return <ProvidersScreen />
  },
})
