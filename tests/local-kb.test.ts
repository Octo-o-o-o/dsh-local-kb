import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { afterEach, describe, expect, it } from 'vitest'
import { apply, extractSafeOoxmlText, OoxmlBlockedError } from '../src/host/index.js'

const tempDirs: string[] = []
function makeTempDir(prefix = 'dsh-kb-test-'): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

function createMockCtx() {
  const provided = new Map<string, unknown>()
  const tools = new Map<string, any>()
  const routes = new Map<string, (req: Request) => Promise<Response>>()
  const registeredEvidence: any[] = []
  const auditEvents: any[] = []

  const ctx = {
    get(key: string) {
      if (key === 'governanceEvidence') {
        return {
          registerEvidence: (ev: any) => {
            const id = `ev-${registeredEvidence.length + 1}`
            registeredEvidence.push({ id, ...ev })
            return { id }
          },
        }
      }
      if (key === 'governanceAudit') {
        return { recordEvent: (ev: any) => auditEvents.push(ev) }
      }
      if (key === 'tools') {
        return {
          register: (def: any) => {
            tools.set(def.name, def)
            return () => tools.delete(def.name)
          },
        }
      }
      if (key === 'connection') {
        return {
          fetch: {
            register: (r: { path: string; fetch: (req: Request) => Promise<Response> }) => {
              routes.set(r.path, r.fetch)
              return () => routes.delete(r.path)
            },
          },
        }
      }
      return undefined
    },
    provide(key: string, val: unknown) {
      provided.set(key, val)
    },
    effect() {},
  }

  return { ctx, provided, tools, routes, registeredEvidence, auditEvents }
}

function buildMiniDocx(bodyXml: string): Buffer {
  const bytes = zipSync({
    '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    'word/document.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`,
    ),
  })
  return Buffer.from(bytes)
}

describe('dsh-local-kb', () => {
  it('supports dual FTS5 search for both 2-char CJK terms and 3+ char substrings', async () => {
    const dir = makeTempDir()
    writeFileSync(
      path.join(dir, 'tender.md'),
      '# 投标技术要求\n本项目标书必须明确违约金条款，且交付周期不得超过 30 个工作日。Reference code: ALPHA-992.\n',
      'utf8',
    )

    const { ctx } = createMockCtx()
    const svc = apply(ctx, { dbPath: ':memory:' })
    const summary = await svc.indexRoot(dir)
    expect(summary.indexed).toBe(1)

    // 2-char Chinese term -> matched via chunks_fts_tokens (CJK bigram)
    const twoChar = svc.search('标书')
    expect(twoChar.hits).toHaveLength(1)
    expect(twoChar.hits[0]!.relPath).toBe('tender.md')

    // 3+ char Chinese substring -> matched via trigram + tokens ('both')
    const longCjk = svc.search('违约金条款')
    expect(longCjk.hits).toHaveLength(1)
    expect(longCjk.hits[0]!.matchSource).toBe('both')

    // ASCII identifier match
    const ascii = svc.search('ALPHA-992')
    expect(ascii.hits).toHaveLength(1)

    // Second re-index skips unchanged file via source_hash
    const second = await svc.indexRoot(dir)
    expect(second.indexed).toBe(0)
    expect(second.skippedUnchanged).toBe(1)
    svc.close()
  })

  it('safely extracts DOCX, XLSX, and PPTX while stripping deleted runs and blocking XXE/ZIP-bombs/OLE2', () => {
    // 1. DOCX strips <w:del> and <w:altChunk>
    const docx = buildMiniDocx(
      '<w:p><w:r><w:t>正式报价为 120 万元</w:t></w:r><w:del><w:r><w:delText>旧报价 999 万元</w:delText></w:r></w:del></w:p><w:altChunk r:id="evil"/>',
    )
    const docxText = extractSafeOoxmlText(docx, '.docx')
    expect(docxText).toContain('正式报价为 120 万元')
    expect(docxText).not.toContain('999')

    // 2. XLSX extracts shared strings + numeric values
    const xlsx = Buffer.from(
      zipSync({
        'xl/sharedStrings.xml': strToU8('<sst><si><t>项目名称</t></si><si><t>智慧政务</t></si></sst>'),
        'xl/worksheets/sheet1.xml': strToU8(
          '<worksheet><sheetData><row><c t="s"><v>0</v></c><c><v>500</v></c></row><row><c t="s"><v>1</v></c><c><v>1280</v></c></row></sheetData></worksheet>',
        ),
      }),
    )
    const xlsxText = extractSafeOoxmlText(xlsx, '.xlsx')
    expect(xlsxText).toContain('项目名称 | 500')
    expect(xlsxText).toContain('智慧政务 | 1280')

    // 3. PPTX extracts slide text in numeric order
    const pptx = Buffer.from(
      zipSync({
        'ppt/slides/slide1.xml': strToU8('<p:sld><a:p><a:r><a:t>第一页：方案总览</a:t></a:r></a:p></p:sld>'),
      }),
    )
    expect(extractSafeOoxmlText(pptx, '.pptx')).toContain('第一页：方案总览')

    // 4. XXE hard-blocked
    const xxeDocx = Buffer.from(
      zipSync({
        'word/document.xml': strToU8('<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><w:document/>'),
      }),
    )
    expect(() => extractSafeOoxmlText(xxeDocx, '.docx')).toThrowError(OoxmlBlockedError)
    try {
      extractSafeOoxmlText(xxeDocx, '.docx')
    } catch (err) {
      expect((err as OoxmlBlockedError).code).toBe('XXE_FORBIDDEN')
    }

    // 5. ZIP bomb quota blocked (maxEntries = 2)
    const manyEntries = Buffer.from(
      zipSync({
        'a.xml': strToU8('<a/>'),
        'b.xml': strToU8('<b/>'),
        'word/document.xml': strToU8('<w:document/>'),
      }),
    )
    expect(() => extractSafeOoxmlText(manyEntries, '.docx', { maxEntries: 2 })).toThrowError(OoxmlBlockedError)

    // 6. Legacy OLE2 header blocked
    const ole2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0])
    expect(() => extractSafeOoxmlText(ole2, '.docx')).toThrowError(OoxmlBlockedError)
  })

  it('enforces mandatory pagination, source_hash freshness re-index, and evidence bus registration', async () => {
    const dir = makeTempDir()
    const body = 'A'.repeat(400) + 'B'.repeat(400)
    writeFileSync(path.join(dir, 'long.txt'), body, 'utf8')

    const { ctx, registeredEvidence, auditEvents, tools } = createMockCtx()
    const svc = apply(ctx, { dbPath: ':memory:', defaultReadLimit: 300, maxReadLimit: 500 })
    await svc.indexRoot(dir)

    // Page 1 -> truncated: true, nextOffset: 300
    const page1 = await svc.read('long.txt', { offset: 0, limit: 300, sessionId: 's-1' })
    expect(page1.truncated).toBe(true)
    expect(page1.nextOffset).toBe(300)
    expect(page1.content).toHaveLength(300)
    expect(page1.evidenceId).toBe('ev-1')
    expect(registeredEvidence[0].truncated).toBe(true)
    expect(registeredEvidence[0].nextOffset).toBe(300)

    // Page 2 -> read remaining bytes (truncated: false)
    const page2 = await svc.read('long.txt', { offset: 300, limit: 500, sessionId: 's-1' })
    expect(page2.truncated).toBe(false)
    expect(page2.nextOffset).toBeUndefined()
    expect(page2.content).toHaveLength(500)

    // Edit file on disk -> search marks stale, read auto-reindexes & refreshes source_hash
    const oldHash = page1.sourceHash
    writeFileSync(path.join(dir, 'long.txt'), 'UPDATED CONTENT 2026', 'utf8')
    const staleSearch = svc.search('AAAA', { checkFreshness: true })
    expect(staleSearch.hits[0]?.stale).toBe(true)

    const freshRead = await svc.read('long.txt', { offset: 0, limit: 300, sessionId: 's-1' })
    expect(freshRead.reindexed).toBe(true)
    expect(freshRead.stale).toBe(false)
    expect(freshRead.sourceHash).not.toBe(oldHash)
    expect(freshRead.content).toBe('UPDATED CONTENT 2026')

    // DSH tool execution works end-to-end
    expect(tools.has('kb_list_roots')).toBe(true)
    expect(tools.has('kb_search')).toBe(true)
    expect(tools.has('kb_read')).toBe(true)
    const toolRes = await tools.get('kb_read').execute({ path: 'long.txt', offset: 0, limit: 100 }, { sessionId: 's-tool' })
    expect(toolRes.content).toBe('UPDATED CONTENT 2026')
    expect(auditEvents.some((e) => e.eventName === 'kb.read')).toBe(true)
    svc.close()
  })

  it('enforces kbOnlyMode path confinement and excludes protected credential files', async () => {
    const outer = makeTempDir('dsh-kb-outer-')
    const kbRoot = path.join(outer, 'docs')
    mkdirSync(kbRoot, { recursive: true })
    writeFileSync(path.join(outer, 'secret-outside.txt'), 'OUTSIDE', 'utf8')
    writeFileSync(path.join(kbRoot, 'public.md'), 'Public spec content', 'utf8')
    writeFileSync(path.join(kbRoot, '.env'), 'API_KEY=sk-secret-123456', 'utf8')
    writeFileSync(path.join(kbRoot, 'private.pem'), '-----BEGIN PRIVATE KEY-----', 'utf8')

    const { ctx, auditEvents } = createMockCtx()
    const svc = apply(ctx, { dbPath: ':memory:' })
    const summary = await svc.indexRoot(kbRoot)
    // Only public.md is indexed; .env and private.pem are excluded!
    expect(summary.indexed).toBe(1)
    expect(svc.listDocuments().map((d) => d.relPath)).toEqual(['public.md'])

    await expect(svc.read('../secret-outside.txt')).rejects.toThrow(/OUTSIDE_KB_ROOTS/)
    await expect(svc.read('.env')).rejects.toThrow(/PROTECTED_PATH/)
    await expect(svc.read('private.pem')).rejects.toThrow(/PROTECTED_PATH/)
    expect(auditEvents.some((e) => e.eventName === 'kb.read_denied')).toBe(true)
    svc.close()
  })

  it('supports pluggable registerExtractor hook for custom formats like .pdf', async () => {
    const dir = makeTempDir()
    writeFileSync(path.join(dir, 'contract.pdf'), Buffer.from('%PDF-1.4 mock-bytes-合同编号2026'))

    const { ctx } = createMockCtx()
    const svc = apply(ctx, { dbPath: ':memory:' })
    svc.registerExtractor('.pdf', (bytes) => ({
      text: `Extracted PDF: ${bytes.toString('utf8')}`,
      extractor: 'custom-pdf-mock',
    }))

    const summary = await svc.indexRoot(dir)
    expect(summary.indexed).toBe(1)
    const search = svc.search('合同编号')
    expect(search.hits).toHaveLength(1)
    expect(search.hits[0]!.relPath).toBe('contract.pdf')
    svc.close()
  })

  it('responds with strict DSH Connection RPC server-response envelope on /api/dshLocalKb', async () => {
    const { ctx, routes } = createMockCtx()
    const svc = apply(ctx, { dbPath: ':memory:' })
    const handler = routes.get('/api/dshLocalKb')!
    const resp = await handler(
      new Request('http://127.0.0.1/api/dshLocalKb', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'rpc-kb-1',
          method: 'dshLocalKb',
          payload: { method: 'status', payload: {} },
        }),
      }),
    )
    const json = (await resp.json()) as any
    expect(json.type).toBe('server-response')
    expect(json.rpcId).toBe('rpc-kb-1')
    expect(json.result.ok).toBe(true)
    expect(json.result.value.config.kbOnlyMode).toBe(true)
    svc.close()
  })
})
