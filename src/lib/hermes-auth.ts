export interface AuthStatus {
  authenticated: boolean
  authRequired: boolean
  /** 多用户模式是否激活（TI_WORK_MULTIUSER=1） */
  multiUser?: boolean
  /** 是否允许自助注册（TI_WORK_SELF_REGISTER=1） */
  selfRegister?: boolean
  /** 多用户模式下当前登录用户（未登录为 null） */
  currentUser?: {
    userId: string
    displayName: string
    role: 'super_admin' | 'regular_admin'
  } | null
  /** Hermes 网关是否已连通；不影响本地认证态返回。 */
  gatewayAvailable?: boolean
  error?: string
}

export async function fetchHermesAuthStatus(
  timeoutMs = 5_000,
): Promise<AuthStatus> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch('/api/auth-check', { signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out after 5 seconds')
    }

    throw error instanceof Error
      ? error
      : new Error('Failed to connect to Hermes Agent')
  } finally {
    globalThis.clearTimeout(timeout)
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  return (await res.json()) as AuthStatus
}
