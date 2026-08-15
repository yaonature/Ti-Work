/**
 * Electron 壳 —— 更新清单拉取（纯逻辑，node 环境可单测）。
 *
 * 更新源为静态 JSON（latest.json）：{ version, notes, url }。
 * 拉取函数通过参数注入（fetchImpl），main.ts 注入真实 fetch；
 * 未配置 TI_WORK_UPDATE_URL 时由调用方跳过检查。
 */
export interface UpdateManifest {
  version: string
  notes: string
  url: string
}

export type ManifestFetcher = (url: string) => Promise<UpdateManifest | null>

export async function fetchUpdateManifest(
  checkUrl: string,
  fetchImpl: ManifestFetcher,
): Promise<UpdateManifest | null> {
  try {
    const manifest = await fetchImpl(checkUrl)
    if (manifest === null) return null
    if (typeof manifest.version !== 'string' || manifest.version.length === 0)
      return null
    if (typeof manifest.url !== 'string' || manifest.url.length === 0) return null
    const notes = typeof manifest.notes === 'string' ? manifest.notes : ''
    return { version: manifest.version, notes, url: manifest.url }
  } catch {
    return null
  }
}
