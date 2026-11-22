import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { buildFtsTokenQuery, buildFtsTrigramQuery, tokenizeForFts } from '../core/cjk-tokenizer.js'
import { ExtractorRegistry } from '../core/extractors.js'
import { isProtectedKbPath, normalizeRealRoot, resolveConfinedKbPath } from '../core/path-guard.js'
import type {
  KbDocumentRecord,
  KbExtractorFn,
  KbIndexSummary,
  KbReadOptions,
  KbReadResult,
  KbRootRecord,
  KbSearchHit,
  KbSearchResult,
  LocalKbConfig,
} from '../core/types.js'

const DEFAULT_MAX_FILE_BYTES = 25 * 1024 * 1024
const DEFAULT_READ_LIMIT = 8_000
const DEFAULT_MAX_READ_LIMIT = 32_000
const DEFAULT_CHUNK_CHARS = 1_500
const DEFAULT_CHUNK_OVERLAP = 150

function resolveDefaultDbPath(): string {
  const dshHome = process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh')
  return path.join(dshHome, 'governance', 'local-kb.sqlite')
}

function sha256Buffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

function docIdFor(absPath: string): string {
  return createHash('sha256').update(absPath).digest('hex').slice(0, 24)
}

function chunkText(text: string, chunkChars: number, overlap: number): { readonly index: number; readonly start: number; readonly end: number; readonly content: string }[] {
  if (text.length === 0) return []
  const chunks: { index: number; start: number; end: number; content: string }[] = []
  const step = Math.max(100, chunkChars - overlap)
  let start = 0
  let index = 0
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkChars)
    chunks.push({ index, start, end, content: text.slice(start, end) })
    if (end >= text.length) break
    start += step
    index += 1
  }
  return chunks
}

export class LocalKbStore {
  readonly dbPath: string
  readonly kbOnlyMode: boolean
  readonly maxFileBytes: number
  readonly defaultReadLimit: number
  readonly maxReadLimit: number
  readonly chunkChars: number
  readonly chunkOverlap: number
  readonly extractors: ExtractorRegistry
  private readonly db: DatabaseSync

  constructor(config: LocalKbConfig = {}) {
    this.dbPath = config.dbPath ?? resolveDefaultDbPath()
    this.kbOnlyMode = config.kbOnlyMode ?? true
    this.maxFileBytes = config.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES
    this.defaultReadLimit = Math.max(256, config.defaultReadLimit ?? DEFAULT_READ_LIMIT)
    this.maxReadLimit = Math.max(this.defaultReadLimit, config.maxReadLimit ?? DEFAULT_MAX_READ_LIMIT)
    this.chunkChars = Math.max(300, config.chunkChars ?? DEFAULT_CHUNK_CHARS)
    this.chunkOverlap = Math.min(Math.floor(this.chunkChars / 2), Math.max(0, config.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP))
    this.extractors = new ExtractorRegistry(config.zipQuotas)

    if (this.dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true })
    }
    this.db = new DatabaseSync(this.dbPath)
    this.initSchema()

    for (const root of config.roots ?? []) {
      if (fs.existsSync(root)) {
        this.addRoot(root)
      }
    }
  }

  private initSchema(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS kb_roots (
        root_path TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        added_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS kb_documents (
        doc_id TEXT PRIMARY KEY,
        root_path TEXT NOT NULL,
        rel_path TEXT NOT NULL,
        abs_path TEXT NOT NULL UNIQUE,
        ext TEXT NOT NULL,
        extractor TEXT NOT NULL,
        source_hash TEXT NOT NULL,
        bytes INTEGER NOT NULL,
        mtime_ms REAL NOT NULL,
        total_chars INTEGER NOT NULL,
        full_text TEXT NOT NULL,
        indexed_at TEXT NOT NULL,
        FOREIGN KEY (root_path) REFERENCES kb_roots(root_path) ON DELETE CASCADE
      ) STRICT;

      CREATE TABLE IF NOT EXISTS kb_chunks (
        chunk_id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        char_start INTEGER NOT NULL,
        char_end INTEGER NOT NULL,
        content TEXT NOT NULL,
        FOREIGN KEY (doc_id) REFERENCES kb_documents(doc_id) ON DELETE CASCADE
      ) STRICT;

      CREATE INDEX IF NOT EXISTS idx_kb_chunks_doc ON kb_chunks(doc_id, chunk_index);

      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts_trigram USING fts5(
        content,
        tokenize='trigram'
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts_tokens USING fts5(
        tokens,
        tokenize='unicode61'
      );
    `)
  }

  registerExtractor(ext: string, fn: KbExtractorFn): () => void {
    return this.extractors.register(ext, fn)
  }

  addRoot(rootPath: string, label?: string): KbRootRecord {
    const realRoot = normalizeRealRoot(rootPath)
    if (!fs.existsSync(realRoot) || !fs.statSync(realRoot).isDirectory()) {
      throw new Error(`KB root does not exist or is not a directory: ${rootPath}`)
    }
    const now = new Date().toISOString()
    const effectiveLabel = label?.trim() || path.basename(realRoot) || realRoot
    this.db
      .prepare(
        `INSERT INTO kb_roots (root_path, label, added_at) VALUES (?, ?, ?)
         ON CONFLICT(root_path) DO UPDATE SET label = excluded.label`,
      )
      .run(realRoot, effectiveLabel, now)
    return this.listRoots().find((r) => r.rootPath === realRoot)!
  }

  removeRoot(rootPath: string): boolean {
    const realRoot = normalizeRealRoot(rootPath)
    const docs = this.db
      .prepare('SELECT doc_id FROM kb_documents WHERE root_path = ?')
      .all(realRoot) as { doc_id: string }[]
    for (const d of docs) {
      this.deleteDocumentFts(d.doc_id)
    }
    const res = this.db.prepare('DELETE FROM kb_roots WHERE root_path = ?').run(realRoot)
    return Number(res.changes) > 0
  }

  listRoots(): KbRootRecord[] {
    const rows = this.db
      .prepare(
        `SELECT r.root_path, r.label, r.added_at, COUNT(d.doc_id) AS doc_count
         FROM kb_roots r
         LEFT JOIN kb_documents d ON d.root_path = r.root_path
         GROUP BY r.root_path
         ORDER BY r.added_at ASC`,
      )
      .all() as { root_path: string; label: string; added_at: string; doc_count: number }[]
    return rows.map((r) => ({
      rootPath: r.root_path,
      label: r.label,
      addedAt: r.added_at,
      documentCount: Number(r.doc_count),
    }))
  }

  listDocuments(rootPath?: string): KbDocumentRecord[] {
    const rows = rootPath
      ? (this.db
          .prepare(
            `SELECT doc_id, root_path, rel_path, abs_path, ext, extractor, source_hash, bytes, mtime_ms, total_chars, indexed_at
             FROM kb_documents WHERE root_path = ? ORDER BY rel_path ASC`,
          )
          .all(normalizeRealRoot(rootPath)) as Record<string, unknown>[])
      : (this.db
          .prepare(
            `SELECT doc_id, root_path, rel_path, abs_path, ext, extractor, source_hash, bytes, mtime_ms, total_chars, indexed_at
             FROM kb_documents ORDER BY root_path ASC, rel_path ASC`,
          )
          .all() as Record<string, unknown>[])

    return rows.map((r) => ({
      docId: String(r.doc_id),
      rootPath: String(r.root_path),
      relPath: String(r.rel_path),
      absPath: String(r.abs_path),
      ext: String(r.ext),
      extractor: String(r.extractor),
      sourceHash: String(r.source_hash),
      bytes: Number(r.bytes),
      mtimeMs: Number(r.mtime_ms),
      totalChars: Number(r.total_chars),
      indexedAt: String(r.indexed_at),
    }))
  }

  private deleteDocumentFts(docId: string): void {
    const chunkRows = this.db
      .prepare('SELECT chunk_id FROM kb_chunks WHERE doc_id = ?')
      .all(docId) as { chunk_id: number }[]
    const delTri = this.db.prepare('DELETE FROM chunks_fts_trigram WHERE rowid = ?')
    const delTok = this.db.prepare('DELETE FROM chunks_fts_tokens WHERE rowid = ?')
    for (const row of chunkRows) {
      delTri.run(row.chunk_id)
      delTok.run(row.chunk_id)
    }
    this.db.prepare('DELETE FROM kb_chunks WHERE doc_id = ?').run(docId)
  }

  private async indexSingleFile(
    realRoot: string,
    absPath: string,
    relPath: string,
  ): Promise<'indexed' | 'skipped'> {
    const stat = fs.statSync(absPath)
    if (stat.size > this.maxFileBytes) {
      throw new Error(`FILE_TOO_LARGE:${stat.size}`)
    }
    const bytes = fs.readFileSync(absPath)
    const sourceHash = sha256Buffer(bytes)
    const docId = docIdFor(absPath)

    const existing = this.db
      .prepare('SELECT source_hash FROM kb_documents WHERE doc_id = ?')
      .get(docId) as { source_hash: string } | undefined
    if (existing && existing.source_hash === sourceHash) {
      return 'skipped'
    }

    const extracted = await this.extractors.extract(bytes, absPath)
    const chunks = chunkText(extracted.text, this.chunkChars, this.chunkOverlap)
    const now = new Date().toISOString()

    this.db.exec('BEGIN IMMEDIATE')
    try {
      this.deleteDocumentFts(docId)
      this.db
        .prepare(
          `INSERT INTO kb_documents
            (doc_id, root_path, rel_path, abs_path, ext, extractor, source_hash, bytes, mtime_ms, total_chars, full_text, indexed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(doc_id) DO UPDATE SET
             rel_path = excluded.rel_path,
             extractor = excluded.extractor,
             source_hash = excluded.source_hash,
             bytes = excluded.bytes,
             mtime_ms = excluded.mtime_ms,
             total_chars = excluded.total_chars,
             full_text = excluded.full_text,
             indexed_at = excluded.indexed_at`,
        )
        .run(
          docId,
          realRoot,
          relPath,
          absPath,
          path.extname(absPath).toLowerCase(),
          extracted.extractor,
          sourceHash,
          stat.size,
          stat.mtimeMs,
          extracted.text.length,
          extracted.text,
          now,
        )

      const insChunk = this.db.prepare(
        'INSERT INTO kb_chunks (doc_id, chunk_index, char_start, char_end, content) VALUES (?, ?, ?, ?, ?)',
      )
      const insTri = this.db.prepare('INSERT INTO chunks_fts_trigram (rowid, content) VALUES (?, ?)')
      const insTok = this.db.prepare('INSERT INTO chunks_fts_tokens (rowid, tokens) VALUES (?, ?)')

      for (const ch of chunks) {
        const res = insChunk.run(docId, ch.index, ch.start, ch.end, ch.content)
        const rowid = Number(res.lastInsertRowid)
        insTri.run(rowid, ch.content)
        insTok.run(rowid, tokenizeForFts(ch.content))
      }
      this.db.exec('COMMIT')
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }

    return 'indexed'
  }

  async indexRoot(rootPath: string): Promise<KbIndexSummary> {
    const rootRec = this.addRoot(rootPath)
    const realRoot = rootRec.rootPath
    const rootPrefix = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep

    let scanned = 0
    let indexed = 0
    let skippedUnchanged = 0
    const blocked: { path: string; reason: string }[] = []
    const seenDocIds = new Set<string>()

    const walk = async (dir: string): Promise<void> => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (isProtectedKbPath(fullPath)) continue

        if (entry.isSymbolicLink()) {
          let realTarget: string
          try {
            realTarget = fs.realpathSync(fullPath)
          } catch {
            continue
          }
          if (!realTarget.startsWith(rootPrefix)) {
            blocked.push({ path: fullPath, reason: 'SYMLINK_ESCAPE' })
            continue
          }
          if (fs.statSync(realTarget).isDirectory()) continue
        }

        if (entry.isDirectory()) {
          await walk(fullPath)
          continue
        }
        if (!entry.isFile()) continue
        if (!this.extractors.isSupported(fullPath)) continue

        scanned += 1
        const relPath = path.relative(realRoot, fullPath).replaceAll('\\', '/')
        seenDocIds.add(docIdFor(fullPath))
        try {
          const outcome = await this.indexSingleFile(realRoot, fullPath, relPath)
          if (outcome === 'indexed') indexed += 1
          else skippedUnchanged += 1
        } catch (err) {
          blocked.push({
            path: relPath,
            reason: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
          })
        }
      }
    }

    await walk(realRoot)

    // Prune deleted files
    const existingDocs = this.db
      .prepare('SELECT doc_id FROM kb_documents WHERE root_path = ?')
      .all(realRoot) as { doc_id: string }[]
    let removed = 0
    for (const d of existingDocs) {
      if (!seenDocIds.has(d.doc_id)) {
        this.deleteDocumentFts(d.doc_id)
        this.db.prepare('DELETE FROM kb_documents WHERE doc_id = ?').run(d.doc_id)
        removed += 1
      }
    }

    return { rootPath: realRoot, scanned, indexed, skippedUnchanged, removed, blocked }
  }

  private isFileStale(absPath: string, indexedHash: string): boolean {
    try {
      const buf = fs.readFileSync(absPath)
      return sha256Buffer(buf) !== indexedHash
    } catch {
      return true
    }
  }

  search(
    query: string,
    opts: { readonly limit?: number; readonly rootPath?: string; readonly checkFreshness?: boolean } = {},
  ): KbSearchResult {
    const trimmed = query.trim()
    const limit = Math.min(50, Math.max(1, opts.limit ?? 10))
    if (!trimmed) {
      return { query, hits: [], totalHits: 0, truncated: false }
    }

    const filterRoot = opts.rootPath ? normalizeRealRoot(opts.rootPath) : undefined
    const merged = new Map<number, { hit: Omit<KbSearchHit, 'matchSource'>; sources: Set<'trigram' | 'tokens'> }>()

    const runQuery = (table: 'chunks_fts_trigram' | 'chunks_fts_tokens', ftsExpr: string, source: 'trigram' | 'tokens') => {
      try {
        const sql = filterRoot
          ? `SELECT c.chunk_id, c.doc_id, c.chunk_index, c.char_start, c.char_end, c.content,
                    d.root_path, d.rel_path, d.abs_path, d.source_hash
             FROM ${table} f
             JOIN kb_chunks c ON c.chunk_id = f.rowid
             JOIN kb_documents d ON d.doc_id = c.doc_id
             WHERE ${table} MATCH ? AND d.root_path = ?
             ORDER BY bm25(${table}) ASC
             LIMIT ?`
          : `SELECT c.chunk_id, c.doc_id, c.chunk_index, c.char_start, c.char_end, c.content,
                    d.root_path, d.rel_path, d.abs_path, d.source_hash
             FROM ${table} f
             JOIN kb_chunks c ON c.chunk_id = f.rowid
             JOIN kb_documents d ON d.doc_id = c.doc_id
             WHERE ${table} MATCH ?
             ORDER BY bm25(${table}) ASC
             LIMIT ?`

        const rows = (
          filterRoot
            ? this.db.prepare(sql).all(ftsExpr, filterRoot, limit + 1)
            : this.db.prepare(sql).all(ftsExpr, limit + 1)
        ) as Record<string, unknown>[]

        for (const r of rows) {
          const chunkId = Number(r.chunk_id)
          const existing = merged.get(chunkId)
          if (existing) {
            existing.sources.add(source)
          } else {
            const absPath = String(r.abs_path)
            const sourceHash = String(r.source_hash)
            const stale = opts.checkFreshness === false ? false : this.isFileStale(absPath, sourceHash)
            merged.set(chunkId, {
              sources: new Set([source]),
              hit: {
                docId: String(r.doc_id),
                rootPath: String(r.root_path),
                relPath: String(r.rel_path),
                absPath,
                sourceHash,
                stale,
                chunkIndex: Number(r.chunk_index),
                charStart: Number(r.char_start),
                charEnd: Number(r.char_end),
                excerpt: String(r.content).slice(0, 600),
              },
            })
          }
        }
      } catch {
        /* ignore FTS syntax edge cases */
      }
    }

    const triExpr = buildFtsTrigramQuery(trimmed)
    if (triExpr) runQuery('chunks_fts_trigram', triExpr, 'trigram')

    const tokExpr = buildFtsTokenQuery(trimmed)
    if (tokExpr) runQuery('chunks_fts_tokens', tokExpr, 'tokens')

    const allHits: KbSearchHit[] = [...merged.values()].map(({ hit, sources }) => ({
      ...hit,
      matchSource: sources.size === 2 ? 'both' : sources.has('trigram') ? 'trigram' : 'tokens',
    }))

    // Prioritize matches found by both indexes first
    allHits.sort((a, b) => {
      const rank = (s: KbSearchHit['matchSource']) => (s === 'both' ? 0 : s === 'trigram' ? 1 : 2)
      return rank(a.matchSource) - rank(b.matchSource)
    })

    const truncated = allHits.length > limit
    return {
      query: trimmed,
      hits: allHits.slice(0, limit),
      totalHits: allHits.length,
      truncated,
    }
  }

  async read(targetPath: string, opts: KbReadOptions = {}): Promise<KbReadResult> {
    const roots = this.listRoots().map((r) => r.rootPath)
    const confined = resolveConfinedKbPath(targetPath, roots)
    if (!confined.ok) {
      throw new Error(`${confined.code}: ${confined.message}`)
    }

    const docId = docIdFor(confined.absPath)
    let row = this.db
      .prepare(
        'SELECT doc_id, root_path, rel_path, abs_path, extractor, source_hash, total_chars, full_text FROM kb_documents WHERE doc_id = ?',
      )
      .get(docId) as
      | {
          doc_id: string
          root_path: string
          rel_path: string
          abs_path: string
          extractor: string
          source_hash: string
          total_chars: number
          full_text: string
        }
      | undefined

    const liveHash = sha256Buffer(fs.readFileSync(confined.absPath))
    let stale = !row || row.source_hash !== liveHash
    let reindexed = false

    if (!row || (stale && opts.autoReindexIfStale !== false)) {
      await this.indexSingleFile(confined.rootPath, confined.absPath, confined.relPath)
      row = this.db
        .prepare(
          'SELECT doc_id, root_path, rel_path, abs_path, extractor, source_hash, total_chars, full_text FROM kb_documents WHERE doc_id = ?',
        )
        .get(docId) as typeof row
      reindexed = true
      stale = false
    }

    if (!row) {
      throw new Error(`KB_READ_FAILED: Unable to load document ${confined.relPath}`)
    }

    const offset = Math.max(0, Math.floor(opts.offset ?? 0))
    const limit = Math.min(this.maxReadLimit, Math.max(1, Math.floor(opts.limit ?? this.defaultReadLimit)))
    const totalChars = row.full_text.length
    const content = row.full_text.slice(offset, offset + limit)
    const endPos = offset + content.length
    const truncated = endPos < totalChars

    return {
      path: row.abs_path,
      relPath: row.rel_path,
      rootPath: row.root_path,
      extractor: row.extractor,
      sourceHash: row.source_hash,
      stale,
      reindexed,
      offset,
      limit,
      totalChars,
      truncated,
      ...(truncated ? { nextOffset: endPos } : {}),
      content,
    }
  }

  close(): void {
    this.db.close()
  }
}
