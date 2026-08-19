import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { ProfilesScreen } from '@/screens/profiles/profiles-screen'

export const Route = createFileRoute('/profiles')({
  component: function ProfilesRoute() {
    usePageTitle('工作画像')
    return <ProfilesScreen />
  },
})
