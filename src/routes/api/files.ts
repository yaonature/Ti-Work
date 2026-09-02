import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  isAuthenticated,
  requireLocalOrAuth,
} from '../../server/auth-middleware'
import {
  getClientIp,
  rateLimit,
  rateLimitResponse,
  requireJsonContentType,
  safeErrorMessage,
} from '../../server/rate-limit'
import { getProfileWorkspaceRoot } from '../../server/profiles-browser'
import {
  AuthorizationGuardError,
  enforceDirectoryAccess,
  readDesktopSecurityPolicy,
} from '../../server/authorization-guard'

const execFileAsync = promisify(execFile)

const WORKSPACE_ROOT = (
  process.env.HERMES_WORKSPACE_DIR ||
  process.env.HERMES_WORKSPACE_DIR ||
  path.join(os.homedir(), '.hermes')
).trim()

type FileEntry = {
  name: string
  path: string
  type: 'file' | 'folder'
  size?: number
  modifiedAt?: string
  children?: Array<FileEntry>
}

/**
 * Resolve the "authorized workspace" root configured by the user in
 * 权限与安全 → 目录访问. This is the primary business directory the agent is
 * granted access to — distinct from `~/.hermes` (which only holds the agent's
 * own config like `.env` / `config.yaml` / `habits` and must not be exposed
 * as the default browsing root).
 *
 * Returns `null` when the user has not authorized any workspace yet.
 */
function getAuthorizedWorkspaceRoot(): string | null {
  const policy = readDesktopSecurityPolicy()
  const { workspaceRoot, allowedPaths } = policy.directoryAccess
  if (workspaceRoot) return workspaceRoot
  if (allowedPaths.length > 0) return allowedPaths[0]
  return null
}

function workspaceNotConfiguredResponse() {
  return json(
    {
      ok: false,
      code: 'workspace_not_configured',
      error: '尚未配置工作区，请先在权限与安全中完成目录授权。',
    },
    { status: 403 },
  )
}

/**
 * Resolve the effective workspace root for a request.
 *
 * - `rootScope === 'authorized'` (sent by the 执行中心 file browser) requests
 *   the user's authorized workspace instead of the global `~/.hermes`,
 *   returning `null` when no workspace has been authorized.
 * - Otherwise, if `profileName` is provided (from the ?profile= query param),
 *   the root is scoped to that profile's directory.
 * - Falls back to the global WORKSPACE_ROOT for all legacy consumers (identity
 *   file editor, search, chat) which intentionally operate on `~/.hermes`.
 *
 * Security: `getProfileWorkspaceRoot` validates the name and always returns a
 * path inside ~/.hermes — no arbitrary path injection is possible.
 */
function getEffectiveRoot(
  profileName?: string | null,
  rootScope?: string | null,
): string | null {
  if (rootScope === 'authorized' && (!profileName || profileName === 'default')) {
    return getAuthorizedWorkspaceRoot()
  }
  if (!profileName || profileName === 'default') return WORKSPACE_ROOT
  try {
    return getProfileWorkspaceRoot(profileName)
  } catch {
    return WORKSPACE_ROOT
  }
}

function ensureWorkspacePathFor(input: string, root: string) {
  const raw = input.trim()
  if (!raw) return root
  const resolved = path.isAbsolute(raw)
    ? path.resolve(raw)
    : path.resolve(root, raw)
  if (!resolved.startsWith(root)) {
    throw new Error('路径超出工作区')
  }
  return resolved
}

function toRelativeFor(resolvedPath: string, root: string) {
  const relative = path.relative(root, resolvedPath)
  return relative || ''
}

function sortEntries(entries: Array<FileEntry>) {
  return entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function normalizePathForGlob(input: string) {
  return input.replace(/\\/g, '/')
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasGlob(input: string) {
  return input.includes('*')
}

function parseGlobPattern(input: string) {
  const normalized = normalizePathForGlob(input.trim())
  const lastSlashIndex = normalized.lastIndexOf('/')
  const directoryPath =
    lastSlashIndex >= 0 ? normalized.slice(0, lastSlashIndex) : ''
  const filePattern =
    lastSlashIndex >= 0 ? normalized.slice(lastSlashIndex + 1) : normalized

  const regexSource = `^${escapeRegex(filePattern).replace(/\\\*/g, '.*')}$`

  return {
    directoryPath,
    regex: new RegExp(regexSource),
  }
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  '.cache',
  '__pycache__',
  '.venv',
  'dist',
  '.DS_Store',
])

const MAX_DIRECTORY_DEPTH = 3
const MAX_DIRECTORY_ENTRIES = 20_000

type ReadDirectoryOptions = {
  root: string
  maxDepth: number
  maxEntries: number | null
  countedEntries: { value: number }
}

function parseMaxDepth(input: string | null): number | null {
  if (!input) return null
  const parsed = Number(input)
  if (!Number.isFinite(parsed)) return null
  return Math.min(MAX_DIRECTORY_DEPTH, Math.max(0, Math.floor(parsed)))
}

function parseMaxEntries(input: string | null): number | null {
  if (!input) return null
  const parsed = Number(input)
  if (!Number.isFinite(parsed)) return null
  return Math.min(MAX_DIRECTORY_ENTRIES, Math.max(1, Math.floor(parsed)))
}

async function readDirectory(
  dirPath: string,
  depth: number,
  options: ReadDirectoryOptions,
): Promise<Array<FileEntry>> {
  if (depth > options.maxDepth) return []
  if (
    options.maxEntries !== null &&
    options.countedEntries.value >= options.maxEntries
  ) {
    return []
  }

  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const mapped: Array<FileEntry> = []

  for (const entry of entries) {
    if (
      options.maxEntries !== null &&
      options.countedEntries.value >= options.maxEntries
    ) {
      break
    }

    if (IGNORED_DIRS.has(entry.name)) continue
    const fullPath = path.join(dirPath, entry.name)
    const relativePath = toRelativeFor(fullPath, options.root)
    try {
      const stats = await fs.stat(fullPath)
      if (entry.isDirectory()) {
        const children = await readDirectory(fullPath, depth + 1, options)
        mapped.push({
          name: entry.name,
          path: relativePath,
          type: 'folder',
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
          children,
        })
      } else {
        mapped.push({
          name: entry.name,
          path: relativePath,
          type: 'file',
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        })
      }
      options.countedEntries.value += 1
    } catch {
      // Skip broken symlinks or inaccessible entries
      continue
    }
  }

  return sortEntries(mapped)
}

async function readGlobDirectory(
  globPath: string,
  root: string,
  profileName?: string | null,
) {
  const { directoryPath, regex } = parseGlobPattern(globPath)
  const resolvedDirectory = ensureWorkspacePathFor(directoryPath, root)
  enforceDirectoryAccess({
    action: 'list',
    resolvedPath: resolvedDirectory,
    fallbackRoot: root,
    profileName,
  })
  const entries = await fs.readdir(resolvedDirectory, { withFileTypes: true })
  const mapped: Array<FileEntry> = []

  for (const entry of entries) {
    if (!regex.test(entry.name)) continue
    const fullPath = path.join(resolvedDirectory, entry.name)
    const stats = await fs.stat(fullPath)
    mapped.push({
      name: entry.name,
      path: toRelativeFor(fullPath, root),
      type: entry.isDirectory() ? 'folder' : 'file',
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
    })
  }

  return {
    root: toRelativeFor(resolvedDirectory, root),
    entries: sortEntries(mapped),
  }
}

function getMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.svg':
      return 'image/svg+xml'
    default:
      return 'application/octet-stream'
  }
}

function isImageFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)
}

export const Route = createFileRoute('/api/files')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const url = new URL(request.url)
          const action = url.searchParams.get('action') || 'list'
          const inputPath = url.searchParams.get('path') || ''
          const profileName = url.searchParams.get('profile') || undefined
          const rootScope = url.searchParams.get('root')
          const maxDepthParam = parseMaxDepth(url.searchParams.get('maxDepth'))
          const maxEntriesParam = parseMaxEntries(
            url.searchParams.get('maxEntries'),
          )

          // Resolve effective root — profile-scoped, authorized workspace, or global
          const effectiveRoot = getEffectiveRoot(profileName, rootScope)

          if (effectiveRoot === null) {
            return workspaceNotConfiguredResponse()
          }

          if (action === 'list' && hasGlob(inputPath)) {
            const globListing = await readGlobDirectory(
              inputPath,
              effectiveRoot,
              profileName,
            )
            return json({
              root: globListing.root,
              base: effectiveRoot,
              entries: globListing.entries,
            })
          }

          const resolvedPath = ensureWorkspacePathFor(inputPath, effectiveRoot)
          enforceDirectoryAccess({
            action:
              action === 'read'
                ? 'read'
                : action === 'download'
                  ? 'download'
                  : 'list',
            resolvedPath,
            fallbackRoot: effectiveRoot,
            profileName,
          })

          if (action === 'read') {
            const buffer = await fs.readFile(resolvedPath)
            if (isImageFile(resolvedPath)) {
              const mime = getMimeType(resolvedPath)
              return json({
                type: 'image',
                path: toRelativeFor(resolvedPath, effectiveRoot),
                content: `data:${mime};base64,${buffer.toString('base64')}`,
              })
            }
            return json({
              type: 'text',
              path: toRelativeFor(resolvedPath, effectiveRoot),
              content: buffer.toString('utf8'),
            })
          }

          if (action === 'download') {
            const buffer = await fs.readFile(resolvedPath)
            return new Response(buffer, {
              headers: {
                'Content-Type': getMimeType(resolvedPath),
                'Content-Disposition': `attachment; filename="${path.basename(
                  resolvedPath,
                )}"`,
              },
            })
          }

          const tree = await readDirectory(resolvedPath, 0, {
            root: effectiveRoot,
            maxDepth: maxDepthParam ?? MAX_DIRECTORY_DEPTH,
            maxEntries: maxEntriesParam,
            countedEntries: { value: 0 },
          })
          return json({
            root: toRelativeFor(resolvedPath, effectiveRoot),
            base: effectiveRoot,
            entries: tree,
            profile: profileName ?? null,
          })
        } catch (err) {
          if (err instanceof AuthorizationGuardError) {
            return json(
              {
                ok: false,
                error: err.message,
                code: err.code,
                details: err.details,
              },
              { status: err.status },
            )
          }
          return json({ error: safeErrorMessage(err) }, { status: 500 })
        }
      },
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        const ip = getClientIp(request)
        if (!rateLimit(`files:${ip}`, 30, 60_000)) {
          return rateLimitResponse()
        }

        try {
          const contentType = request.headers.get('content-type') || ''
          if (!contentType.includes('multipart/form-data')) {
            const csrfCheck = requireJsonContentType(request)
            if (csrfCheck) return csrfCheck
          }
          if (contentType.includes('multipart/form-data')) {
            const form = await request.formData()
            const action = String(form.get('action') || 'upload')
            if (action !== 'upload') {
              return json({ error: '无效的上传请求' }, { status: 400 })
            }
            const file = form.get('file')
            const targetPath = String(form.get('path') || '')
            const uploadProfile = String(form.get('profile') || '')
            const uploadRootScope = String(form.get('root') || '')
            if (!(file instanceof File)) {
              return json({ error: '缺少文件' }, { status: 400 })
            }
            const uploadRoot = getEffectiveRoot(
              uploadProfile || undefined,
              uploadRootScope,
            )
            if (uploadRoot === null) {
              return workspaceNotConfiguredResponse()
            }
            const resolvedTarget = ensureWorkspacePathFor(targetPath, uploadRoot)
            enforceDirectoryAccess({
              action: 'upload',
              resolvedPath: resolvedTarget,
              fallbackRoot: uploadRoot,
              profileName: uploadProfile || null,
            })
            const isDir = (await fs.stat(resolvedTarget)).isDirectory()
            const destination = isDir
              ? path.join(resolvedTarget, file.name)
              : resolvedTarget
            enforceDirectoryAccess({
              action: 'upload',
              resolvedPath: destination,
              fallbackRoot: uploadRoot,
              profileName: uploadProfile || null,
            })
            await fs.mkdir(path.dirname(destination), { recursive: true })
            const buffer = Buffer.from(await file.arrayBuffer())
            await fs.writeFile(destination, buffer)
            return json({ ok: true, path: toRelativeFor(destination, uploadRoot) })
          }

          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >
          const action = typeof body.action === 'string' ? body.action : 'write'
          const postProfile =
            typeof body.profile === 'string' ? body.profile : undefined
          const postRootScope =
            typeof body.root === 'string' ? body.root : undefined
          const postRoot = getEffectiveRoot(postProfile, postRootScope)
          if (postRoot === null) {
            return workspaceNotConfiguredResponse()
          }

          if (action === 'mkdir') {
            const dirPath = ensureWorkspacePathFor(String(body.path || ''), postRoot)
            enforceDirectoryAccess({
              action: 'mkdir',
              resolvedPath: dirPath,
              fallbackRoot: postRoot,
              profileName: postProfile || null,
            })
            await fs.mkdir(dirPath, { recursive: true })
            return json({ ok: true, path: toRelativeFor(dirPath, postRoot) })
          }

          if (action === 'rename') {
            const fromPath = ensureWorkspacePathFor(String(body.from || ''), postRoot)
            const toPath = ensureWorkspacePathFor(String(body.to || ''), postRoot)
            enforceDirectoryAccess({
              action: 'rename',
              resolvedPath: fromPath,
              fallbackRoot: postRoot,
              profileName: postProfile || null,
            })
            enforceDirectoryAccess({
              action: 'rename',
              resolvedPath: toPath,
              fallbackRoot: postRoot,
              profileName: postProfile || null,
            })
            await fs.mkdir(path.dirname(toPath), { recursive: true })
            await fs.rename(fromPath, toPath)
            return json({ ok: true, path: toRelativeFor(toPath, postRoot) })
          }

          if (action === 'delete') {
            if (!requireLocalOrAuth(request)) {
              return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
            }
            const targetPath = ensureWorkspacePathFor(String(body.path || ''), postRoot)
            enforceDirectoryAccess({
              action: 'delete',
              resolvedPath: targetPath,
              fallbackRoot: postRoot,
              profileName: postProfile || null,
            })
            try {
              // Try macOS trash command first
              await execFileAsync('trash', [targetPath])
            } catch {
              // Fallback to rm -rf if trash is not available
              await fs.rm(targetPath, { recursive: true, force: true })
            }
            return json({ ok: true })
          }

          const filePath = ensureWorkspacePathFor(String(body.path || ''), postRoot)
          enforceDirectoryAccess({
            action: 'write',
            resolvedPath: filePath,
            fallbackRoot: postRoot,
            profileName: postProfile || null,
          })
          const content = typeof body.content === 'string' ? body.content : ''
          await fs.mkdir(path.dirname(filePath), { recursive: true })
          await fs.writeFile(filePath, content, 'utf8')
          return json({ ok: true, path: toRelativeFor(filePath, postRoot) })
        } catch (err) {
          if (err instanceof AuthorizationGuardError) {
            return json(
              {
                ok: false,
                error: err.message,
                code: err.code,
                details: err.details,
              },
              { status: err.status },
            )
          }
          return json({ error: safeErrorMessage(err) }, { status: 500 })
        }
      },
    },
  },
})
