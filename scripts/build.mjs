import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))

const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  'zod',
  '@tanstack/react-virtual',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

function wrapClientFactory(id, code, stylesheets) {
  const entries = Object.entries(stylesheets)
  const install =
    entries.length === 0
      ? ''
      : `if (typeof document !== "undefined") { const sheets = ${JSON.stringify(Object.fromEntries(entries))}; for (const sheetPath of Object.keys(sheets)) { const tagId = ${JSON.stringify(id)} + ":" + sheetPath; if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) { const tag = document.createElement("style"); tag.dataset.plugin = ${JSON.stringify(id)}; tag.dataset.pluginCss = tagId; tag.textContent = sheets[sheetPath]; document.head.appendChild(tag); } } }\n`
  return `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;\n${install}${code}\nreturn module.exports; } });\n`
}

// Note: `fflate` is bundled statically into `dist/index.js` so `dependencies: {}` stays empty!
mkdirSync(path.join(root, 'dist'), { recursive: true })
await esbuild.build({
  absWorkingDir: root,
  entryPoints: [path.join(root, 'src', 'host', 'index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node24',
  outfile: path.join(root, 'dist', 'index.js'),
  external: ['node:*', '@deepseek-ai/cordis', '@deepseek-ai/dsh-*'],
  sourcemap: false,
  logLevel: 'info',
})

const clientResult = await esbuild.build({
  absWorkingDir: root,
  entryPoints: [path.join(root, 'src', 'client.tsx')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  jsx: 'automatic',
  write: false,
  outfile: path.join(root, 'lib', 'client.js'),
  external: [...new Set([...PLATFORM_MODULES, ...(manifest.dsh?.client?.external ?? [])])],
  loader: { '.module.css': 'local-css', '.css': 'css' },
  logLevel: 'silent',
})

const jsFile = clientResult.outputFiles.find((f) => f.path.endsWith('.js'))
if (!jsFile) throw new Error('Client esbuild produced no JS output')
const cssFile = clientResult.outputFiles.find((f) => f.path.endsWith('.css'))
const stylesheets = cssFile && cssFile.text.trim().length > 0 ? { 'client.css': cssFile.text } : {}

mkdirSync(path.join(root, 'lib'), { recursive: true })
writeFileSync(path.join(root, 'lib', 'client.js'), wrapClientFactory(manifest.name, jsFile.text, stylesheets))
console.log(`Built ${manifest.name}@${manifest.version}: dist/index.js & lib/client.js`)
