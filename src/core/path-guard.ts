import fs from 'node:fs'
import path from 'node:path'

const PROTECTED_SEGMENTS = new Set([
  '.ssh',
  '.aws',
  '.gnupg',
  '.gpg',
  '.kube',
  '.docker',
  '.git',
  'node_modules',
])

const PROTECTED_BASENAME_PATTERNS: readonly RegExp[] = [
  /^\.env(?:\..+)?$/i,
  /^\.npmrc$/i,
  /^\.pypirc$/i,
  /^\.netrc$/i,
  /^id_(?:rsa|ed25519|ecdsa|dsa)(?:\.pub)?$/i,
  /^authorized_keys$/i,
  /^credentials(?:\.json)?$/i,
  /\.(?:pem|key|p12|pfx|jks|kdbx)$/i,
]

export function isProtectedKbPath(targetPath: string): boolean {
  const normalized = targetPath.replaceAll('\\', '/')
  const segments = normalized.split('/').filter(Boolean)
  for (const seg of segments) {
    if (PROTECTED_SEGMENTS.has(seg.toLowerCase())) return true
  }
  const base = path.basename(targetPath)
  return PROTECTED_BASENAME_PATTERNS.some((re) => re.test(base))
}

export function normalizeRealRoot(rootPath: string): string {
  const resolved = path.resolve(rootPath)
  return fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved
}

export interface ConfinedPathResult {
  readonly ok: true
  readonly absPath: string
  readonly rootPath: string
  readonly relPath: string
}

export interface ConfinedPathError {
  readonly ok: false
  readonly code: 'OUTSIDE_KB_ROOTS' | 'PROTECTED_PATH' | 'SYMLINK_ESCAPE' | 'NOT_FOUND'
  readonly message: string
}

/**
 * Confines `targetPath` strictly inside one of `registeredRoots`, blocking
 * `..` traversal, symlink escapes, and sensitive credential/secret paths.
 */
export function resolveConfinedKbPath(
  targetPath: string,
  registeredRoots: readonly string[],
): ConfinedPathResult | ConfinedPathError {
  if (!targetPath || targetPath.includes('\0')) {
    return { ok: false, code: 'OUTSIDE_KB_ROOTS', message: 'Invalid empty or null-byte path' }
  }
  if (isProtectedKbPath(targetPath)) {
    return { ok: false, code: 'PROTECTED_PATH', message: `Protected credential/secret path denied: ${path.basename(targetPath)}` }
  }

  const normalizedRoots = registeredRoots.map((r) => normalizeRealRoot(r))
  const candidates: { root: string; resolved: string }[] = []

  if (path.isAbsolute(targetPath)) {
    const abs = path.resolve(targetPath)
    for (const root of normalizedRoots) {
      const prefix = root.endsWith(path.sep) ? root : root + path.sep
      if (abs === root || abs.startsWith(prefix)) {
        candidates.push({ root, resolved: abs })
      }
    }
  } else {
    for (const root of normalizedRoots) {
      const abs = path.resolve(root, targetPath)
      const prefix = root.endsWith(path.sep) ? root : root + path.sep
      if (abs.startsWith(prefix)) {
        candidates.push({ root, resolved: abs })
      }
    }
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      code: 'OUTSIDE_KB_ROOTS',
      message: `Path "${targetPath}" is outside authorized KB roots (kbOnlyMode enforced).`,
    }
  }

  for (const cand of candidates) {
    if (!fs.existsSync(cand.resolved)) continue
    let realTarget: string
    try {
      realTarget = fs.realpathSync(cand.resolved)
    } catch {
      continue
    }
    const prefix = cand.root.endsWith(path.sep) ? cand.root : cand.root + path.sep
    if (realTarget !== cand.root && !realTarget.startsWith(prefix)) {
      return {
        ok: false,
        code: 'SYMLINK_ESCAPE',
        message: `Symlink target escapes authorized KB root: ${targetPath}`,
      }
    }
    if (isProtectedKbPath(realTarget)) {
      return { ok: false, code: 'PROTECTED_PATH', message: 'Protected path denied after realpath resolution' }
    }
    return {
      ok: true,
      absPath: realTarget,
      rootPath: cand.root,
      relPath: path.relative(cand.root, realTarget).replaceAll('\\', '/'),
    }
  }

  return { ok: false, code: 'NOT_FOUND', message: `KB document not found inside authorized roots: ${targetPath}` }
}
