import { useCallback, useEffect, useMemo, useState } from 'react'
import { Editor } from '@monaco-editor/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ComputerTerminal01Icon,
  File01Icon,
  Folder01Icon,
} from '@hugeicons/core-free-icons'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { FileExplorerSidebar } from '@/components/file-explorer'
import { TerminalWorkspace } from '@/components/terminal/terminal-workspace'
import { resolveTheme, useSettings } from '@/hooks/use-settings'
import { cn } from '@/lib/utils'
import { useMonacoReady } from '@/lib/monaco'

const INITIAL_EDITOR_VALUE = `// 执行中心
// 左侧管理文件，右侧沉淀草稿；执行终端负责本地命令。

function note() {
  return '可以开始处理任务了。'
}
`

type ExecutionView = 'workspace' | 'terminal'

export const Route = createFileRoute('/files')({
  component: FilesRoute,
  errorComponent: function FilesError({ error }) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-primary-50 p-6 text-center">
        <h2 className="mb-3 text-xl font-semibold text-primary-900">执行中心加载失败</h2>
        <p className="mb-4 max-w-md text-sm text-primary-600">
          {error instanceof Error ? error.message : '发生了意外错误'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-accent-500 px-4 py-2 text-white transition-colors hover:bg-accent-600"
        >
          重新加载页面
        </button>
      </div>
    )
  },
  pendingComponent: function FilesPending() {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent-500 border-r-transparent" />
          <p className="text-sm text-primary-500">正在加载执行中心...</p>
        </div>
      </div>
    )
  },
})

function FilesRoute() {
  usePageTitle('执行中心')
  const { settings } = useSettings()
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const [isMobile, setIsMobile] = useState(false)
  const [fileExplorerCollapsed, setFileExplorerCollapsed] = useState(false)
  const [editorValue, setEditorValue] = useState(INITIAL_EDITOR_VALUE)
  const [activeView, setActiveView] = useState<ExecutionView>(
    search.view === 'terminal' ? 'terminal' : 'workspace',
  )
  const resolvedTheme = resolveTheme(settings.theme)
  const { ready: monacoReady } = useMonacoReady()

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

  useEffect(() => {
    setActiveView(search.view === 'terminal' ? 'terminal' : 'workspace')
  }, [search.view])

  const handleInsertReference = useCallback(function handleInsertReference(
    reference: string,
  ) {
    setEditorValue((prev) => `${prev}\n${reference}\n`)
  }, [])

  const executionViews = useMemo(
    () => [
      {
        id: 'workspace' as const,
        label: '文件处理',
        icon: Folder01Icon,
      },
      {
        id: 'terminal' as const,
        label: '执行终端',
        icon: ComputerTerminal01Icon,
      },
    ],
    [],
  )

  return (
    <div
      className="min-h-full bg-[var(--theme-bg)] text-[var(--theme-text)]"
      data-testid="execution_center_page"
    >
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-5 px-4 py-4 md:px-6 md:py-6">
        <section
          className="rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-5 shadow-sm md:p-6"
          data-testid="execution_center_hero"
        >
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-1 text-xs text-[var(--theme-muted)]">
              <HugeiconsIcon icon={File01Icon} size={14} />
              执行中心
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--theme-text)]">
              文件、终端与结果，一处收口
            </h1>
          </div>
        </section>

        <section
          className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-3 shadow-sm"
          data-testid="execution_center_switcher"
        >
          <div className="flex flex-wrap gap-2">
            {executionViews.map((view) => {
              const isActive = activeView === view.id
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => {
                    setActiveView(view.id)
                    void navigate({
                      to: '/files',
                      search: view.id === 'terminal' ? { view: 'terminal' } : {},
                      replace: true,
                    })
                  }}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/10 text-[var(--theme-text)]'
                      : 'border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                  )}
                  data-testid={`execution_center_tab_${view.id}`}
                >
                  <HugeiconsIcon icon={view.icon} size={16} />
                  {view.label}
                </button>
              )
            })}
          </div>
        </section>

        <section
          className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] shadow-sm"
          data-testid="execution_center_content"
        >
          {activeView === 'workspace' ? (
            <div
              className="flex h-full min-h-0 w-full overflow-hidden"
              data-testid="execution_center_workspace_view"
            >
              <FileExplorerSidebar
                collapsed={fileExplorerCollapsed}
                onToggle={function onToggleFileExplorer() {
                  setFileExplorerCollapsed((prev) => !prev)
                }}
                onInsertReference={handleInsertReference}
                rootScope="authorized"
              />

              <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <header
                  className="flex items-center border-b border-[var(--theme-border)] px-4 py-3"
                  data-testid="execution_center_workspace_header"
                >
                  <h2 className="text-base font-semibold text-[var(--theme-text)]">
                    文件处理
                  </h2>
                </header>

                <div
                  className="min-h-0 flex-1 pb-24 md:pb-0"
                  data-testid="execution_center_workspace_editor"
                >
                  {monacoReady ? (
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
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-primary-500">
                      正在加载编辑器...
                    </div>
                  )}
                </div>
              </main>
            </div>
          ) : (
            <div
              className="flex h-full min-h-0 w-full flex-col overflow-hidden"
              data-testid="execution_center_terminal_view"
            >
              <div
                className="flex items-center border-b border-[var(--theme-border)] px-4 py-3"
                data-testid="execution_center_terminal_header"
              >
                <h2 className="text-base font-semibold text-[var(--theme-text)]">执行终端</h2>
              </div>

              <div
                className="min-h-0 flex-1"
                data-testid="execution_center_terminal_workspace"
              >
                <TerminalWorkspace mode="fullscreen" />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
