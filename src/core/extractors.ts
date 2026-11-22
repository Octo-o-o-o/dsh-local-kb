import path from 'node:path'
import { extractSafeOoxmlText } from './ooxml-extract.js'
import type { ExtractedDocumentText, KbExtractorFn, ZipBombQuotas } from './types.js'

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.txt',
  '.json',
  '.jsonl',
  '.csv',
  '.tsv',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.xml',
  '.html',
  '.htm',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.cs',
  '.sql',
  '.sh',
  '.ps1',
  '.css',
  '.scss',
  '.log',
])

function stripHtmlTags(raw: string): string {
  return raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export class ExtractorRegistry {
  private readonly custom = new Map<string, KbExtractorFn>()
  private readonly zipQuotas: Partial<ZipBombQuotas>

  constructor(zipQuotas: Partial<ZipBombQuotas> = {}) {
    this.zipQuotas = zipQuotas
  }

  register(ext: string, fn: KbExtractorFn): () => void {
    const normalized = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`
    this.custom.set(normalized, fn)
    return () => {
      if (this.custom.get(normalized) === fn) {
        this.custom.delete(normalized)
      }
    }
  }

  isSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    return this.custom.has(ext) || TEXT_EXTENSIONS.has(ext) || ext === '.docx' || ext === '.xlsx' || ext === '.pptx'
  }

  listSupportedExtensions(): string[] {
    return [...new Set([...TEXT_EXTENSIONS, '.docx', '.xlsx', '.pptx', ...this.custom.keys()])].sort()
  }

  async extract(bytes: Buffer, filePath: string): Promise<ExtractedDocumentText> {
    const ext = path.extname(filePath).toLowerCase()
    const customFn = this.custom.get(ext)
    if (customFn) {
      return await customFn(bytes, filePath)
    }
    if (ext === '.docx' || ext === '.xlsx' || ext === '.pptx') {
      return {
        text: extractSafeOoxmlText(bytes, ext, this.zipQuotas),
        extractor: `builtin-ooxml-${ext.slice(1)}`,
      }
    }
    if (TEXT_EXTENSIONS.has(ext)) {
      const raw = new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/^\uFEFF/, '')
      if (ext === '.html' || ext === '.htm') {
        return { text: stripHtmlTags(raw), extractor: 'builtin-html' }
      }
      return { text: raw, extractor: 'builtin-text' }
    }
    throw new Error(`UNSUPPORTED_EXTENSION:${ext || '(none)'}`)
  }
}
