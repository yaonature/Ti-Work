import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'

export const Route = createFileRoute('/terminal')({
  component: TerminalRoute,
  errorComponent: function TerminalError({ error }) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-primary-50">
        <h2 className="text-xl font-semibold text-primary-900 mb-3">
          执行中心跳转失败
        </h2>
        <p className="text-sm text-primary-600 mb-4 max-w-md">
          {error instanceof Error
            ? error.message
            : '执行终端初始化失败'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-colors"
        >
          重新加载页面
        </button>
      </div>
    )
  },
})

function TerminalRoute() {
  usePageTitle('执行终端')
  const navigate = useNavigate()

  useEffect(() => {
    void navigate({
      to: '/files',
      search: { view: 'terminal' },
      replace: true,
    })
  }, [navigate])

  return null
}
