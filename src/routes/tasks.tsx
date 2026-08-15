import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { TasksScreen } from '@/screens/tasks/tasks-screen'

export const Route = createFileRoute('/tasks')({
  component: function TasksRoute() {
    usePageTitle('任务')
    return <TasksScreen />
  },
})
