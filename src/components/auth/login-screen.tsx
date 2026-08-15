import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { AuthStatus } from '@/lib/hermes-auth'

type Mode = 'login' | 'register'

/**
 * 登录/注册屏。
 *  - 多用户模式（TI_WORK_MULTIUSER=1）：用户名 + 密码登录；
 *    开启自助注册（TI_WORK_SELF_REGISTER=1）时提供注册切换。
 *  - 单用户模式：保留原有单密码行为。
 */
export function LoginScreen() {
  // 多用户模式信息来自 /api/auth-check（后端定义一切，前端不持有任何开关逻辑）
  const [multiUser, setMultiUser] = useState(false)
  const [selfRegister, setSelfRegister] = useState(false)

  const [mode, setMode] = useState<Mode>('login')

  // 单用户
  const [password, setPassword] = useState('')

  // 多用户
  const [userId, setUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth-check')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AuthStatus | null) => {
        if (cancelled || !data) return
        setMultiUser(Boolean(data.multiUser))
        setSelfRegister(Boolean(data.selfRegister))
      })
      .catch(() => {
        // 探测失败保持单用户默认形态
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function postLogin(payload: Record<string, string>) {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) {
      throw new Error(data.error || '凭据无效')
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await postLogin(
        multiUser
          ? { userId, password }
          : { password },
      )
      // Success! Reload to trigger auth check
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '认证失败')
      setLoading(false)
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          password,
          displayName: displayName || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '注册失败')
      }
      // 注册即最低权限 regular_admin；成功后直接登录进入
      await postLogin({ userId, password })
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败')
      setLoading(false)
    }
  }

  const title = multiUser
    ? mode === 'login'
      ? '登录'
      : '注册账号'
    : '输入密码'
  const subtitle = multiUser
    ? mode === 'login'
      ? '使用工作区账号登录'
      : '注册新的工作区账号'
    : '此工作区受密码保护'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white px-8 py-10 shadow-xl shadow-primary-900/5 ring-1 ring-primary-900/5">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="flex items-center gap-2.5">
              <svg
                width="32"
                height="32"
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-accent-500"
              >
                <path
                  d="M50 10 L90 30 L90 70 L50 90 L10 70 L10 30 Z"
                  fill="currentColor"
                  opacity="0.15"
                />
                <path
                  d="M50 25 L75 38 L75 62 L50 75 L25 62 L25 38 Z"
                  fill="currentColor"
                  opacity="0.3"
                />
                <circle cx="50" cy="50" r="15" fill="currentColor" />
              </svg>
              <h1 className="text-2xl font-bold tracking-tight text-primary-900">
                Ti Work
              </h1>
            </div>
          </div>

          {/* Title */}
          <h2 className="mb-2 text-center text-lg font-semibold text-primary-900">
            {title}
          </h2>
          <p className="mb-6 text-center text-sm text-primary-600">{subtitle}</p>

          {/* Form */}
          <form
            onSubmit={mode === 'login' ? handleLogin : handleRegister}
            className="space-y-4"
          >
            {multiUser && (
              <div>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="用户名"
                  autoComplete="username"
                  className="w-full rounded-lg border border-primary-200 bg-white px-4 py-2.5 text-primary-900 placeholder-primary-400 outline-none transition-all focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                  disabled={loading}
                  autoFocus
                />
              </div>
            )}

            {mode === 'register' && (
              <div>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="显示名称（可选）"
                  autoComplete="name"
                  className="w-full rounded-lg border border-primary-200 bg-white px-4 py-2.5 text-primary-900 placeholder-primary-400 outline-none transition-all focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                  disabled={loading}
                />
              </div>
            )}

            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'login' ? '密码' : '密码（至少 8 位）'}
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                className="w-full rounded-lg border border-primary-200 bg-white px-4 py-2.5 text-primary-900 placeholder-primary-400 outline-none transition-all focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                disabled={loading}
              />
            </div>

            {mode === 'register' && (
              <div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="确认密码"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-primary-200 bg-white px-4 py-2.5 text-primary-900 placeholder-primary-400 outline-none transition-all focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                  disabled={loading}
                />
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={
                loading ||
                !password ||
                (multiUser && !userId) ||
                (mode === 'register' && !confirmPassword)
              }
              className="w-full rounded-lg bg-accent-500 px-4 py-2.5 font-medium text-white transition-all hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? '处理中...'
                : mode === 'login'
                  ? '继续'
                  : '创建账号'}
            </button>
          </form>

          {/* Mode switch（仅多用户且开放自助注册时） */}
          {multiUser && selfRegister && (
            <button
              type="button"
              onClick={() => {
                setError('')
                setMode(mode === 'login' ? 'register' : 'login')
              }}
              disabled={loading}
              className="mt-4 w-full text-center text-sm text-accent-500 transition-colors hover:text-accent-600 disabled:opacity-50"
            >
              {mode === 'login'
                ? '新用户？创建账号'
                : '已有账号？直接登录'}
            </button>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-primary-500">
          基于{' '}
          <a
            href="https://github.com/NousResearch/hermes-agent"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-500 hover:text-accent-600 transition-colors"
          >
            Hermes
          </a>{' '}
          开源引擎构建
        </p>
      </div>
    </div>
  )
}
