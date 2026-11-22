export interface ZipBombQuotas {
  readonly maxEntries: number
  readonly maxSingleFileBytes: number
  readonly maxTotalBytes: number
  readonly maxCompressionRatio: number
}

export interface KbRootRecord {
  readonly rootPath: string
  readonly label: string
  readonly addedAt: string
  readonly documentCount: number
}

export interface KbDocumentRecord {
  readonly docId: string
  readonly rootPath: string
  readonly relPath: string
  readonly absPath: string
  readonly ext: string
  readonly extractor: string
  readonly sourceHash: string
  readonly bytes: number
  readonly mtimeMs: number
  readonly totalChars: number
  readonly indexedAt: string
}

export interface KbIndexSummary {
  readonly rootPath: string
  readonly scanned: number
  readonly indexed: number
  readonly skippedUnchanged: number
  readonly removed: number
  readonly blocked: readonly { readonly path: string; readonly reason: string }[]
}

export interface KbSearchHit {
  readonly docId: string
  readonly rootPath: string
  readonly relPath: string
  readonly absPath: string
  readonly sourceHash: string
  readonly stale: boolean
  readonly chunkIndex: number
  readonly charStart: number
  readonly charEnd: number
  readonly excerpt: string
  readonly matchSource: 'trigram' | 'tokens' | 'both'
}

export interface KbSearchResult {
  readonly query: string
  readonly hits: readonly KbSearchHit[]
  readonly totalHits: number
  readonly truncated: boolean
}

export interface KbReadOptions {
  readonly offset?: number
  readonly limit?: number
  readonly autoReindexIfStale?: boolean
  readonly sessionId?: string
}

export interface KbReadResult {
  readonly path: string
  readonly relPath: string
  readonly rootPath: string
  readonly extractor: string
  readonly sourceHash: string
  readonly stale: boolean
  readonly reindexed: boolean
  readonly offset: number
  readonly limit: number
  readonly totalChars: number
  readonly truncated: boolean
  readonly nextOffset?: number
  readonly content: string
  readonly evidenceId?: string
}

export interface ExtractedDocumentText {
  readonly text: string
  readonly extractor: string
}

export type KbExtractorFn = (
  bytes: Buffer,
  filePath: string,
) => ExtractedDocumentText | Promise<ExtractedDocumentText>

export interface LocalKbConfig {
  readonly dbPath?: string
  readonly roots?: readonly string[]
  readonly kbOnlyMode?: boolean
  readonly maxFileBytes?: number
  readonly defaultReadLimit?: number
  readonly maxReadLimit?: number
  readonly chunkChars?: number
  readonly chunkOverlap?: number
  readonly zipQuotas?: Partial<ZipBombQuotas>
}

export interface GovernanceKbService {
  addRoot(rootPath: string, label?: string): KbRootRecord
  removeRoot(rootPath: string): boolean
  listRoots(): readonly KbRootRecord[]
  indexRoot(rootPath: string): Promise<KbIndexSummary>
  listDocuments(rootPath?: string): readonly KbDocumentRecord[]
  search(query: string, opts?: { readonly limit?: number; readonly rootPath?: string; readonly checkFreshness?: boolean; readonly sessionId?: string }): KbSearchResult
  read(targetPath: string, opts?: KbReadOptions): Promise<KbReadResult>
  registerExtractor(ext: string, fn: KbExtractorFn): () => void
  getSupportedExtensions(): readonly string[]
  getConfig(): { readonly kbOnlyMode: boolean; readonly defaultReadLimit: number; readonly maxReadLimit: number; readonly dbPath: string }
  close(): void
}
