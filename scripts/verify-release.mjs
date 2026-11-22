#!/usr/bin/env node
/**
 * 10-Gate DSH Plugin Release Verifier for `dsh-local-kb`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { parseDocument } from 'yaml'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appBootPath =
  process.env.DSH_APP_BOOT_PATH ??
  'C:/WorkSpace/OctoDEepSeeK/apps/desktop/runtime/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js'

const FORBIDDEN = [
  /(^|\/)\.env(\.|$)/i,
  /(^|\/)\.npmrc$/i,
  /\.(pem|key|p12|pfx)$/i,
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)src(\/|$)/i,
  /\.test\.[cm]?[jt]sx?$/i,
]

function listTarEntries(tgzPath) {
  const tarBuf = gunzipSync(readFileSync(tgzPath))
  const entries = []
  let offset = 0
  while (offset + 512 <= tarBuf.length) {
    const header = tarBuf.subarray(offset, offset + 512)
    if (header.every((b) => b === 0)) break
    const rawName = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '')
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '')
    const fullName = prefix ? `${prefix}/${rawName}` : rawName
    const sizeOctal = header.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim()
    const size = sizeOctal ? Number.parseInt(sizeOctal, 8) : 0
    const typeFlag = String.fromCharCode(header[156])
    if (fullName && typeFlag !== 'x' && typeFlag !== 'g') {
      entries.push(fullName.replace(/^package\//, ''))
    }
    offset += 512 + Math.ceil(size / 512) * 512
  }
  return entries
}

const checks = []
const record = (id, ok, detail) => {
  checks.push({ id, ok, detail })
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${id}: ${detail}`)
}

const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))

// Gate 1: DSH compatibility
if (existsSync(appBootPath)) {
  const boot = await import(pathToFileURL(appBootPath).href)
  const runtimeVer = boot.getDshRuntimeVersion?.() ?? '0.2.2-rc.5'
  const compat = boot.evaluatePluginCompatibility(manifest, {}, runtimeVer)
  record('dsh-compat', compat === undefined, compat === undefined ? `0 gaps against dsh@${runtimeVer}` : JSON.stringify(compat))
} else {
  const ok = Boolean(manifest.engines?.dsh && manifest.peerDependencies?.['@deepseek-ai/cordis'] === '~4.1.0')
  record('dsh-compat', ok, 'Fallback static manifest check (DSH_APP_BOOT_PATH not set)')
}

// Gate 2: Zero runtime deps & zero workspace:* (fflate bundled statically!)
const rawPkg = readFileSync(path.join(root, 'package.json'), 'utf8')
record(
  'zero-workspace-and-runtime-deps',
  !rawPkg.includes('workspace:') && Object.keys(manifest.dependencies ?? {}).length === 0,
  'Zero workspace:* and dependencies: {} (fflate statically bundled)',
)

// Gate 3: cordis.patch.yml pure YAML core schema
const patchText = readFileSync(path.join(root, 'cordis.patch.yml'), 'utf8')
const doc = parseDocument(patchText, { schema: 'core', customTags: [] })
let patchOk = !/!!js\b/.test(patchText) && doc.errors.length === 0
try { doc.toJS({ maxAliasCount: 0 }) } catch { patchOk = false }
record('cordis-patch-yaml', patchOk, patchOk ? 'Plain YAML core schema, zero custom JS tags' : 'Invalid or unsafe patch YAML')

// Gate 4: Client bundle factory structure
const clientText = readFileSync(path.join(root, 'lib', 'client.js'), 'utf8')
const clientOk =
  clientText.includes('window.__ModuleLoader__.load') &&
  clientText.includes(`id: "${manifest.name}"`) &&
  clientText.includes('var module = { exports: {} }')
record('client-bundle-factory', clientOk, clientOk ? 'Valid lazy-CJS client factory wrapper' : 'Malformed lib/client.js')

// Gate 5: Host syntax check & zero external fflate import
const hostPath = path.join(root, 'dist', 'index.js')
const syntaxRes = spawnSync(process.execPath, ['--check', hostPath], { encoding: 'utf8' })
const hostText = readFileSync(hostPath, 'utf8')
const hostOk = syntaxRes.status === 0 && !hostText.includes('workspace:') && !/from\s+["']fflate["']/.test(hostText)
record('host-syntax', hostOk, hostOk ? 'dist/index.js passed node --check with bundled fflate' : syntaxRes.stderr || 'Unbundled import found')

// Gate 6: Publish metadata
const metaOk =
  manifest.private === false &&
  manifest.license === 'Apache-2.0' &&
  manifest.dsh?.manifestVersion === 1 &&
  Array.isArray(manifest.keywords) &&
  manifest.keywords.includes('dsh-plugin') &&
  Boolean(manifest.repository?.url) &&
  Boolean(manifest.exports?.['.']) &&
  Boolean(manifest.exports?.['./client'])
record('manifest-publish-metadata', metaOk, metaOk ? 'Complete Apache-2.0 DSH publish metadata' : 'Missing publish metadata fields')

// Gate 7: Assets & bilingual docs
const requiredFiles = ['icon.svg', 'locale/zh.json', 'locale/en.json', 'skills/local-kb/SKILL.md', 'README.md', 'README.en.md', 'LICENSE']
const missing = requiredFiles.filter((f) => !existsSync(path.join(root, f)))
const iconSize = existsSync(path.join(root, 'icon.svg')) ? statSync(path.join(root, 'icon.svg')).size : 999999
record('assets-and-docs', missing.length === 0 && iconSize <= 32768, missing.length === 0 ? `All assets present (icon ${iconSize} B)` : `Missing: ${missing.join(', ')}`)

// Gate 8: npm pack tarball hygiene
const tmpPackDir = path.join(root, '.dev', 'verify-pack')
rmSync(tmpPackDir, { recursive: true, force: true })
mkdirSync(tmpPackDir, { recursive: true })
const npmCliJs = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
const packRes = spawnSync(process.execPath, [npmCliJs, 'pack', '--json', '--pack-destination', tmpPackDir], {
  cwd: root,
  encoding: 'utf8',
})
let tarOk = false
let tarDetail = ''
if (packRes.status === 0) {
  const arr = JSON.parse(packRes.stdout.slice(packRes.stdout.indexOf('['), packRes.stdout.lastIndexOf(']') + 1))
  const tgzPath = path.join(tmpPackDir, arr[0].filename)
  const entries = listTarEntries(tgzPath)
  const violations = entries.filter((e) => FORBIDDEN.some((re) => re.test(e)))
  tarOk = violations.length === 0 && entries.includes('dist/index.js') && entries.includes('lib/client.js')
  tarDetail = tarOk ? `Clean tarball (${entries.length} files, ${arr[0].size} bytes)` : `Violations: ${violations.join(', ')}`
} else {
  tarDetail = packRes.stderr || packRes.stdout
}
rmSync(tmpPackDir, { recursive: true, force: true })
record('tarball-clean-audit', tarOk, tarDetail)

// Gate 9: Live Host apply() smoke test + real FTS5 CJK search + tool output contract
const mod = await import(pathToFileURL(hostPath).href)
const routes = []
const tools = []
const provided = new Map()
let cleanupFn = null
const tmpKb = mkdtempSync(path.join(os.tmpdir(), 'dsh-kb-smoke-'))
writeFileSync(path.join(tmpKb, 'policy.md'), '# 审计规范\n标书评分标准与违约责任详见本文件。\n', 'utf8')

const mockCtx = {
  get: (k) => {
    if (k === 'connection') {
      return {
        fetch: {
          register: (r) => {
            routes.push(r.path)
            return () => {}
          },
        },
      }
    }
    if (k === 'tools') {
      return {
        register: (def) => {
          tools.push(def)
          return () => {}
        },
      }
    }
    return undefined
  },
  provide: (k, v) => provided.set(k, v),
  effect: (fn) => {
    cleanupFn = fn()
  },
}
const svc = mod.apply(mockCtx, { dbPath: ':memory:' })
await svc.indexRoot(tmpKb)
const hit2Char = svc.search('标书')
const validToolContracts =
  tools.length === 3 &&
  tools.every((t) => t.output && typeof t.output.render === 'function' && t.output.schema?.type === 'object')
const smokeOk =
  mod.name === 'dsh-local-kb' &&
  provided.has('governanceKb') &&
  routes.includes('/api/dshLocalKb') &&
  validToolContracts &&
  hit2Char.hits.length === 1
if (typeof cleanupFn === 'function') await cleanupFn()
rmSync(tmpKb, { recursive: true, force: true })
record('host-apply-smoke', smokeOk, smokeOk ? 'Mounted governanceKb + 3 DSH tools + FTS5 CJK verified' : 'Host apply smoke failed')

// Gate 10: Clean root & zero single-slot collision
const cleanOk = !existsSync(path.join(root, 'local-kb.sqlite')) && !clientText.includes('conversation.approval.detail')
record('clean-root-and-slot-isolation', cleanOk, cleanOk ? 'Clean root + zero slot collision' : 'Found stray DB or slot conflict')

const failed = checks.filter((c) => !c.ok)
if (failed.length > 0) {
  console.error(`\n${failed.length} release gate(s) FAILED.`)
  process.exit(1)
}
console.log(`\nAll ${checks.length}/${checks.length} release gates PASSED.`)
