import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { UsersSettingsScreen } from '@/screens/settings/users-settings-screen'

export const Route = createFileRoute('/settings/users')({
  component: function SettingsUsersRoute() {
    usePageTitle('用户管理')
    return <UsersSettingsScreen />
  },
})
