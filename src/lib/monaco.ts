import { useEffect, useState } from 'react'
import { loader } from '@monaco-editor/react'

// ---------------------------------------------------------------------------
// 本地 Monaco 加载器（离线/内网可用）
//
// @monaco-editor/react 默认从 jsdelivr CDN 拉取 monaco-editor，内网/受限环境下
// 会永久卡在 Loading。这里改为打包本地 monaco-editor：动态 import + worker 配置，
// 并通过 loader.config({ monaco }) 让 @monaco-editor/react 直接使用本地实例，
// 完全不再请求任何外部 CDN。
//
// 注意：vite.config.ts 设置了 ssr.noExternal=true，若静态 import monaco-editor
// 会被内联进 SSR bundle 并在服务端 import 时崩溃（monaco 依赖浏览器 API）。
// 因此这里必须采用动态 import，且只在客户端（useEffect）触发 —— 与
// terminal-workspace.tsx 中 xterm 的处理方式一致。
// ---------------------------------------------------------------------------

type MonacoGetter = (moduleId: string, label: string) => Worker

let setupPromise: Promise<void> | null = null

async function configureMonaco(): Promise<void> {
  const monaco = await import('monaco-editor')

  // 动态引入所需的 web worker，避免再次走网络。
  const [editorWorker, tsWorker] = await Promise.all([
    import('monaco-editor/esm/vs/editor/editor.worker?worker'),
    import('monaco-editor/esm/vs/language/typescript/ts.worker?worker'),
  ])

  const getWorker: MonacoGetter = (_moduleId, label) => {
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker.default()
    }
    return new editorWorker.default()
  }

  ;(window as unknown as { MonacoEnvironment?: { getWorker: MonacoGetter } })
    .MonacoEnvironment = { getWorker }

  loader.config({ monaco })
}

/**
 * 确保本地 Monaco 已就绪（幂等）。仅在客户端调用。
 */
export function ensureMonaco(): Promise<void> {
  if (!setupPromise) {
    setupPromise = configureMonaco().catch((err) => {
      setupPromise = null
      throw err
    })
  }
  return setupPromise
}

/**
 * 返回编辑器是否已就绪，就绪后才渲染 <Editor/>，从而避免 @monaco-editor/react
 * 在 loader.config 之前触发 CDN 加载（竞态）。
 */
export function useMonacoReady(): { ready: boolean } {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ensureMonaco()
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((err) => {
        // 加载失败时保持 ready=false，以免抛出未捕获错误。
        console.error('[monaco] 本地编辑器加载失败：', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { ready }
}
