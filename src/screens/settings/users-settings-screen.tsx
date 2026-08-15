/**
 * Users settings screen (G2 multi-user RBAC management UI).
 *
 *  - Visible to all signed-in users: account section (current identity, edit displayName, change password, logout)
 *  - Additionally visible to super_admin: user management section (list, create, role assignment, reset password, delete)
 *  - The frontend holds no toggle/role logic; identity always comes from /api/auth-check
 */
import {
  Add01Icon,
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  Key01Icon,
  LockIcon,
  RefreshIcon,
  UserGroupIcon,
  UserIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AuthStatus } from '@/lib/hermes-auth'
import { Button } from '@/components/ui/button'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

type Role = 'super_admin' | 'regular_admin'

interface IdentityUser {
  userId: string
  displayName: string
  role: Role
  createdAt?: number
  updatedAt?: number
}

type UsersResponse = { ok?: boolean; users?: Array<IdentityUser>; error?: string }
type UserResponse = { ok?: boolean; user?: IdentityUser; error?: string }

const ROLE_LABELS: Record<Role, string> = {
  super_admin: '超级管理员',
  regular_admin: '管理员',
}

function RoleBadge({ role }: { role: Role }) {
  const isSuper = role === 'super_admin'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        isSuper
          ? 'bg-amber-100 text-amber-800'
          : 'bg-primary-100 text-primary-700',
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  )
}

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json().catch(() => ({}))) as T
}

export function UsersSettingsScreen() {
  const [authInfo, setAuthInfo] = useState<AuthStatus | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  // Account section
  const [displayName, setDisplayName] = useState('')
  const [savingDisplayName, setSavingDisplayName] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  // User management section (super_admin)
  const [users, setUsers] = useState<Array<IdentityUser>>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)

  const [createUserId, setCreateUserId] = useState('')
  const [createDisplayName, setCreateDisplayName] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<Role>('regular_admin')
  const [creating, setCreating] = useState(false)

  const [resetTarget, setResetTarget] = useState<IdentityUser | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetting, setResetting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<IdentityUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [roleUpdating, setRoleUpdating] = useState<string | null>(null)

  const currentUser = authInfo?.currentUser ?? null
  const isSuper = currentUser?.role === 'super_admin'

  // Identity probe (the backend defines everything)
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth-check')
      .then((res) => readJson<AuthStatus | null>(res))
      .then((data) => {
        if (cancelled || !data) return
        setAuthInfo(data)
        setDisplayName(data.currentUser?.displayName ?? '')
      })
      .catch(() => {
        if (cancelled) return
        setAuthInfo({ authenticated: false, authRequired: false })
      })
      .finally(() => {
        if (!cancelled) setLoadingAuth(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    setUsersError(null)
    try {
      const res = await fetch('/api/users')
      const data = await readJson<UsersResponse>(res)
      if (!res.ok || !data.ok) {
        setUsersError(data.error ?? `HTTP ${res.status}`)
        setUsers([])
        return
      }
      setUsers(data.users ?? [])
    } catch {
      setUsersError('无法访问用户接口。')
      setUsers([])
    } finally {
      setUsersLoading(false)
    }
  }, [])

  // Fetch the user list when entering the management section
  useEffect(() => {
    if (authInfo?.currentUser?.role === 'super_admin') void loadUsers()
  }, [authInfo?.currentUser?.role, loadUsers])

  const currentUserId = currentUser?.userId ?? ''
  const currentDisplayName = currentUser?.displayName ?? ''

  // ── Account actions ──────────────────────────────────────────────────

  async function handleSaveDisplayName() {
    const name = displayName.trim()
    if (!name) {
      toast('显示名称不能为空。', { type: 'warning' })
      return
    }
    if (name === currentDisplayName) return
    setSavingDisplayName(true)
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUserId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name }),
      })
      const data = await readJson<UserResponse>(res)
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setDisplayName(data.user?.displayName ?? name)
      if (isSuper) void loadUsers()
      toast('显示名称已更新。', { type: 'success' })
    } catch (err) {
      toast(err instanceof Error ? err.message : '更新失败。', {
        type: 'error',
      })
    } finally {
      setSavingDisplayName(false)
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 8) {
      toast('密码长度至少为 8 个字符。', { type: 'warning' })
      return
    }
    if (newPassword !== confirmPassword) {
      toast('两次输入的密码不一致。', { type: 'warning' })
      return
    }
    setChangingPassword(true)
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUserId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })
      const data = await readJson<UserResponse>(res)
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setNewPassword('')
      setConfirmPassword('')
      toast('密码已更改。', { type: 'success' })
    } catch (err) {
      toast(err instanceof Error ? err.message : '更改失败。', {
        type: 'error',
      })
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Force a refresh even if the request fails, so the frontend re-probes the session state
    } finally {
      window.location.reload()
    }
  }

  // ── Admin actions ─────────────────────────────────────────────────────

  async function handleCreateUser() {
    setCreating(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: createUserId,
          password: createPassword,
          displayName: createDisplayName.trim() || undefined,
          role: createRole,
        }),
      })
      const data = await readJson<UserResponse>(res)
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setCreateUserId('')
      setCreateDisplayName('')
      setCreatePassword('')
      setCreateRole('regular_admin')
      toast(`用户 ${data.user?.userId} 已创建。`, { type: 'success' })
      void loadUsers()
    } catch (err) {
      toast(err instanceof Error ? err.message : '创建失败。', {
        type: 'error',
      })
    } finally {
      setCreating(false)
    }
  }

  async function handleRoleChange(user: IdentityUser, role: Role) {
    if (role === user.role) return
    setRoleUpdating(user.userId)
    try {
      const res = await fetch(
        `/api/users/${encodeURIComponent(user.userId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        },
      )
      const data = await readJson<UserResponse>(res)
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      toast(`${user.userId} 的角色已更新。`, { type: 'success' })
      void loadUsers()
    } catch (err) {
      toast(err instanceof Error ? err.message : '角色更新失败。', {
        type: 'error',
      })
    } finally {
      setRoleUpdating(null)
    }
  }

  async function handleResetPassword() {
    if (!resetTarget) return
    if (resetPassword.length < 8) {
      toast('密码长度至少为 8 个字符。', { type: 'warning' })
      return
    }
    if (resetPassword !== resetConfirm) {
      toast('两次输入的密码不一致。', { type: 'warning' })
      return
    }
    setResetting(true)
    try {
      const res = await fetch(
        `/api/users/${encodeURIComponent(resetTarget.userId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: resetPassword }),
        },
      )
      const data = await readJson<UserResponse>(res)
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      toast(`已重置 ${resetTarget.userId} 的密码。`, { type: 'success' })
      setResetTarget(null)
      setResetPassword('')
      setResetConfirm('')
    } catch (err) {
      toast(err instanceof Error ? err.message : '重置失败。', {
        type: 'error',
      })
    } finally {
      setResetting(false)
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/users/${encodeURIComponent(deleteTarget.userId)}`,
        { method: 'DELETE' },
      )
      const data = await readJson<{ ok?: boolean; error?: string }>(res)
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      toast(`用户 ${deleteTarget.userId} 已删除。`, { type: 'success' })
      setDeleteTarget(null)
      void loadUsers()
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败。', {
        type: 'error',
      })
    } finally {
      setDeleting(false)
    }
  }

  const selectClassName =
    'h-8.5 rounded-lg border border-primary-200 bg-white px-2 text-sm text-primary-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'

  const isNotMultiUser = useMemo(
    () => authInfo !== null && !authInfo.multiUser,
    [authInfo],
  )

  if (loadingAuth) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-primary-600">
          <HugeiconsIcon icon={RefreshIcon} size={16} strokeWidth={1.8} />
          加载中…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-surface">
      <main className="mx-auto w-full max-w-5xl px-4 py-6 text-ink md:px-6 md:py-8">
        <div className="space-y-5">
          <header className="rounded-2xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 w-fit"
                  render={
                    <Link to="/settings">
                      <HugeiconsIcon
                        icon={ArrowLeft01Icon}
                        size={16}
                        strokeWidth={1.8}
                      />
                      返回设置
                    </Link>
                  }
                />
                <div>
                  <h1 className="text-lg font-semibold text-ink">用户管理</h1>
                  <p className="mt-1 text-sm text-primary-600">
                    管理工作区账号、角色以及您当前的登录会话。
                  </p>
                </div>
              </div>
            </div>
          </header>

          {isNotMultiUser ? (
            <div className="rounded-2xl border border-primary-200 bg-primary-50/80 px-4 py-3 text-sm text-primary-600 shadow-sm">
              多用户模式尚未启用。设置{' '}
              <code className="rounded bg-primary-200/60 px-1.5 py-0.5 font-mono text-xs text-ink">
                TI_WORK_MULTIUSER=1
              </code>{' '}
              以启用用户账号和 RBAC 权限。
            </div>
          ) : null}

          {/* ── Account section ───────────────────────────────────────── */}
          {authInfo?.multiUser && currentUser ? (
            <section className="rounded-2xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm">
              <div className="mb-4 flex items-start gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-xl border border-primary-200 bg-white">
                  <HugeiconsIcon icon={UserIcon} size={20} strokeWidth={1.5} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-medium text-ink">账号</h2>
                  <p className="text-sm text-primary-600">
                    您在当前工作区中的身份与会话状态。
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Identity card */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-primary-200 bg-white p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {currentDisplayName || currentUserId}
                    </p>
                    <p className="font-mono text-xs text-primary-600">
                      @{currentUserId}
                    </p>
                  </div>
                  <div className="ml-auto">
                    <RoleBadge role={currentUser.role} />
                  </div>
                </div>

                {/* Edit displayName */}
                <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">
                      显示名称
                    </p>
                    <p className="text-xs text-primary-600">
                      其他工作区用户看到的您的名称。
                    </p>
                  </div>
                  <div className="flex w-full items-center gap-2 md:w-auto">
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={currentDisplayName}
                      className="md:w-56"
                      disabled={savingDisplayName}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleSaveDisplayName()}
                      disabled={
                        savingDisplayName || !displayName.trim()
                      }
                    >
                      保存
                    </Button>
                  </div>
                </div>

                {/* Change password */}
                <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">密码</p>
                    <p className="text-xs text-primary-600">
                      更改当前账号的登录密码。
                    </p>
                  </div>
                  <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:flex-row md:items-center">
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="新密码（至少 8 个字符）"
                      className="md:w-52"
                      disabled={changingPassword}
                    />
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="确认密码"
                      className="md:w-40"
                      disabled={changingPassword}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleChangePassword()}
                      disabled={changingPassword}
                    >
                      更改
                    </Button>
                  </div>
                </div>

                {/* Logout */}
                <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">
                      退出登录
                    </p>
                    <p className="text-xs text-primary-600">
                      结束当前会话并返回登录页面。
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => void handleLogout()}
                    disabled={loggingOut}
                  >
                    <HugeiconsIcon icon={LockIcon} size={16} strokeWidth={1.8} />
                    {loggingOut ? '正在退出…' : '退出登录'}
                  </Button>
                </div>
              </div>
            </section>
          ) : null}

          {/* ── User management section (super_admin only) ───────────── */}
          {authInfo?.multiUser && isSuper ? (
            <section className="rounded-2xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm">
              <div className="mb-4 flex items-start gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-xl border border-primary-200 bg-white">
                  <HugeiconsIcon
                    icon={UserGroupIcon}
                    size={20}
                    strokeWidth={1.5}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-medium text-ink">
                    用户管理
                  </h2>
                  <p className="text-sm text-primary-600">
                    创建账号、分配角色并重置密码。
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void loadUsers()}
                  disabled={usersLoading}
                >
                  <HugeiconsIcon icon={RefreshIcon} size={16} strokeWidth={1.8} />
                  刷新
                </Button>
              </div>

              {/* Create user form */}
              <div className="rounded-xl border border-primary-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.8} />
                  <p className="text-sm font-semibold text-ink">
                    创建用户
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <Input
                    value={createUserId}
                    onChange={(e) => setCreateUserId(e.target.value)}
                    placeholder="用户名（3-32 个字符）"
                    disabled={creating}
                  />
                  <Input
                    value={createDisplayName}
                    onChange={(e) => setCreateDisplayName(e.target.value)}
                    placeholder="显示名称（可选）"
                    disabled={creating}
                  />
                  <Input
                    type="password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="密码（至少 8 个字符）"
                    disabled={creating}
                  />
                  <select
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value as Role)}
                    className={selectClassName}
                    disabled={creating}
                  >
                    <option value="regular_admin">管理员</option>
                    <option value="super_admin">超级管理员</option>
                  </select>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => void handleCreateUser()}
                    disabled={
                      creating || !createUserId.trim() || createPassword.length < 8
                    }
                  >
                    {creating ? '创建中…' : '创建用户'}
                  </Button>
                </div>
              </div>

              {/* User list */}
              <div className="mt-4">
                {usersError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {usersError}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-primary-200 bg-white">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="border-b border-primary-200 text-left text-xs uppercase tracking-wide text-primary-600">
                          <th className="px-4 py-3 font-medium">用户</th>
                          <th className="px-4 py-3 font-medium">角色</th>
                          <th className="px-4 py-3 text-right font-medium">
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => {
                          const isSelf = user.userId === currentUserId
                          const isLastSuper =
                            user.role === 'super_admin' &&
                            users.filter((u) => u.role === 'super_admin')
                              .length <= 1
                          return (
                            <tr
                              key={user.userId}
                              className="border-b border-primary-100 last:border-b-0"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-ink">
                                      {user.displayName}
                                      {isSelf ? (
                                        <span className="ml-1.5 text-[10px] font-semibold uppercase text-primary-400">
                                          当前用户
                                        </span>
                                      ) : null}
                                    </p>
                                    <p className="font-mono text-xs text-primary-600">
                                      @{user.userId}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <RoleBadge role={user.role} />
                                  <select
                                    value={user.role}
                                    onChange={(e) =>
                                      void handleRoleChange(
                                        user,
                                        e.target.value as Role,
                                      )
                                    }
                                    disabled={
                                      roleUpdating === user.userId || isLastSuper
                                    }
                                    className={cn(
                                      selectClassName,
                                      'h-7 text-xs',
                                    )}
                                  >
                                    <option value="regular_admin">
                                      管理员
                                    </option>
                                    <option value="super_admin">超级管理员</option>
                                  </select>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setResetTarget(user)
                                      setResetPassword('')
                                      setResetConfirm('')
                                    }}
                                  >
                                    <HugeiconsIcon
                                      icon={Key01Icon}
                                      size={16}
                                      strokeWidth={1.8}
                                    />
                                    重置密码
                                  </Button>
                                  {!isSelf ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-600 hover:bg-red-50"
                                      onClick={() => setDeleteTarget(user)}
                                    >
                                      <HugeiconsIcon
                                        icon={Delete02Icon}
                                        size={16}
                                        strokeWidth={1.8}
                                      />
                                      删除
                                    </Button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {users.length === 0 && !usersLoading ? (
                      <div className="px-4 py-8 text-center text-sm text-primary-600">
                        暂无用户 — 请在上方创建第一个账号。
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {/* ── Hint for signed-in non-admin users ──────────────────── */}
          {authInfo?.multiUser && currentUser && !isSuper ? (
            <div className="flex items-center gap-2 rounded-2xl border border-primary-200 bg-primary-50/80 px-4 py-3 text-sm text-primary-600 shadow-sm">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} strokeWidth={1.8} />
              只有超级管理员可以管理工作区用户。
            </div>
          ) : null}
        </div>
      </main>

      {/* Reset password confirmation */}
      <DialogRoot open={resetTarget !== null} onOpenChange={(open) => {
        if (!open) setResetTarget(null)
      }}>
        <DialogContent className="w-[min(420px,92vw)]">
          <div className="space-y-4 p-5 md:p-6">
            <div className="space-y-1">
              <DialogTitle>重置密码</DialogTitle>
              <DialogDescription>
                为{' '}
                <span className="font-mono text-ink">
                  @{resetTarget?.userId ?? ''}
                </span>{' '}
                设置新密码。
              </DialogDescription>
            </div>
            <div className="space-y-3">
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="新密码（至少 8 个字符）"
                disabled={resetting}
              />
              <Input
                type="password"
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                placeholder="确认密码"
                disabled={resetting}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <DialogClose disabled={resetting}>取消</DialogClose>
              <Button
                variant="default"
                onClick={() => void handleResetPassword()}
                disabled={resetting || resetPassword.length < 8}
              >
                {resetting ? '正在重置…' : '重置密码'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </DialogRoot>

      {/* Delete user confirmation */}
      <DialogRoot open={deleteTarget !== null} onOpenChange={(open) => {
        if (!open) setDeleteTarget(null)
      }}>
        <DialogContent className="w-[min(420px,92vw)]">
          <div className="space-y-4 p-5 md:p-6">
            <div className="space-y-1">
              <DialogTitle>删除用户</DialogTitle>
              <DialogDescription>
                确定删除{' '}
                <span className="font-mono text-ink">
                  @{deleteTarget?.userId ?? ''}
                </span>
                ？此操作无法撤销。
              </DialogDescription>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <DialogClose disabled={deleting}>取消</DialogClose>
              <Button
                variant="destructive"
                onClick={() => void handleDeleteUser()}
                disabled={deleting}
              >
                {deleting ? '删除中…' : '删除用户'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </DialogRoot>
    </div>
  )
}
