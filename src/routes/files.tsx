import { useCallback, useEffect, useState } from 'react'
import { Editor } from '@monaco-editor/react'
import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { FileExplorerSidebar } from '@/components/file-explorer'
import { resolveTheme, useSettings } from '@/hooks/use-settings'

const INITIAL_EDITOR_VALUE = `// 文件工作区
// 使用左侧文件树浏览和管理项目文件。
// “插入为引用”操作会显示在这里，方便快速补充上下文片段。

function note() {
  return '可以开始浏览文件了。'
}
`

export const Route = createFileRoute('/files')({
  component: FilesRoute,
  errorComponent: function FilesError({ error }) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-primary-50">
        <h2 className="text-xl font-semibold text-primary-900 mb-3">
          文件加载失败
        </h2>
        <p className="text-sm text-primary-600 mb-4 max-w-md">
          {error instanceof Error
            ? error.message
            : '发生了意外错误'}
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
  pendingComponent: function FilesPending() {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent-500 border-r-transparent mb-3" />
          <p className="text-sm text-primary-500">正在加载文件浏览器...</p>
        </div>
      </div>
    )
  },
})

function FilesRoute() {
  usePageTitle('文件')
  const { settings } = useSettings()
  const [isMobile, setIsMobile] = useState(false)
  const [fileExplorerCollapsed, setFileExplorerCollapsed] = useState(false)
  const [editorValue, setEditorValue] = useState(INITIAL_EDITOR_VALUE)
  const resolvedTheme = resolveTheme(settings.theme)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!isMobile) return
    setFileExplorerCollapsed(true)
  }, [isMobile])

  const handleInsertReference = useCallback(function handleInsertReference(
    reference: string,
  ) {
    setEditorValue((prev) => `${prev}\n${reference}\n`)
  }, [])

  return (
    <div className="h-full min-h-0 overflow-hidden bg-surface text-primary-900">
      <div className="flex h-full min-h-0 overflow-hidden">
        <FileExplorerSidebar
          collapsed={fileExplorerCollapsed}
          onToggle={function onToggleFileExplorer() {
            setFileExplorerCollapsed((prev) => !prev)
          }}
          onInsertReference={handleInsertReference}
        />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="border-b border-primary-200 px-3 py-2 md:px-4 md:py-3">
            <h1 className="text-base font-medium text-balance md:text-lg">
              文件
            </h1>
            <p className="hidden text-sm text-primary-600 text-pretty sm:block">
              在这里浏览工作区文件，并在编辑器中记录草稿或备注。
            </p>
          </header>
          <div className="min-h-0 flex-1 pb-24 md:pb-0">
            <Editor
              height="100%"
              theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs-light'}
              language="typescript"
              value={editorValue}
              onChange={function onEditorChange(value) {
                setEditorValue(value || '')
              }}
              options={{
                minimap: { enabled: settings.editorMinimap },
                fontSize: settings.editorFontSize,
                scrollBeyondLastLine: false,
                wordWrap: settings.editorWordWrap ? 'on' : 'off',
              }}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
