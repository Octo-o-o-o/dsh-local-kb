/**
 * Pure-JS safe OOXML text extractor (DOCX / XLSX / PPTX) powered by statically
 * bundled `fflate`.
 *
 * Security controls (aligned with `ooxml-safe.ts`):
 * - Blocks legacy OLE2 binary Office formats & encrypted OOXML packages.
 * - Pre-checks ZIP Central Directory BEFORE inflating against 4 ZIP-bomb quotas:
 *   maxEntries, maxSingleFileBytes, maxTotalBytes, maxCompressionRatio.
 * - Rejects `..` and absolute entry paths inside ZIP archives.
 * - Hard-blocks XML XXE (`<!DOCTYPE` / `<!ENTITY`).
 * - Strips `<w:altChunk>`, `<w:del>`, `<w:delText>`, and `<w:instrText>`.
 */
import { strFromU8, unzipSync } from 'fflate'
import type { ZipBombQuotas } from './types.js'

export const DEFAULT_ZIP_QUOTAS: ZipBombQuotas = {
  maxEntries: 1000,
  maxSingleFileBytes: 25 * 1024 * 1024,
  maxTotalBytes: 100 * 1024 * 1024,
  maxCompressionRatio: 100,
}

const OLE2_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04])

export type OoxmlBlockCode =
  | 'LEGACY_OFFICE_FORMAT'
  | 'ENCRYPTED_OOXML'
  | 'INVALID_ZIP'
  | 'ZIP_BOMB_QUOTA'
  | 'XXE_FORBIDDEN'
  | 'UNSUPPORTED_OOXML'

export class OoxmlBlockedError extends Error {
  readonly code: OoxmlBlockCode

  constructor(code: OoxmlBlockCode, message: string) {
    super(message)
    this.name = 'OoxmlBlockedError'
    this.code = code
  }
}

export function precheckZipCentralDirectory(buf: Uint8Array, quotas: ZipBombQuotas = DEFAULT_ZIP_QUOTAS): void {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const minPos = Math.max(0, buf.byteLength - 65557)
  let eocdOffset = -1
  for (let i = buf.byteLength - 22; i >= minPos; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset === -1) {
    throw new OoxmlBlockedError('INVALID_ZIP', 'Missing ZIP End of Central Directory (EOCD)')
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true)
  if (totalEntries > quotas.maxEntries) {
    throw new OoxmlBlockedError('ZIP_BOMB_QUOTA', `ZIP entry count ${totalEntries} exceeds quota ${quotas.maxEntries}`)
  }

  const cdSize = view.getUint32(eocdOffset + 12, true)
  const cdOffset = view.getUint32(eocdOffset + 16, true)
  if (cdOffset + cdSize > buf.byteLength) {
    throw new OoxmlBlockedError('INVALID_ZIP', 'Corrupt ZIP central directory bounds')
  }

  let pos = cdOffset
  let totalUncompressed = 0
  let seen = 0
  while (pos < cdOffset + cdSize && seen < totalEntries) {
    if (pos + 46 > buf.byteLength || view.getUint32(pos, true) !== 0x02014b50) {
      throw new OoxmlBlockedError('INVALID_ZIP', 'Corrupt ZIP central directory entry header')
    }
    const compSize = view.getUint32(pos + 20, true)
    const uncompSize = view.getUint32(pos + 24, true)
    const nameLen = view.getUint16(pos + 28, true)
    const extraLen = view.getUint16(pos + 30, true)
    const commentLen = view.getUint16(pos + 32, true)
    const entryName = strFromU8(buf.subarray(pos + 46, pos + 46 + nameLen))

    if (entryName.startsWith('/') || entryName.startsWith('\\') || entryName.includes('..') || /^[A-Za-z]:/.test(entryName)) {
      throw new OoxmlBlockedError('INVALID_ZIP', `Unsafe ZIP entry path rejected: ${entryName}`)
    }
    if (uncompSize > quotas.maxSingleFileBytes) {
      throw new OoxmlBlockedError('ZIP_BOMB_QUOTA', `Entry "${entryName}" uncompressed size ${uncompSize} exceeds limit ${quotas.maxSingleFileBytes}`)
    }
    if (compSize > 0 && uncompSize / compSize > quotas.maxCompressionRatio && uncompSize > 512 * 1024) {
      throw new OoxmlBlockedError(
        'ZIP_BOMB_QUOTA',
        `Entry "${entryName}" compression ratio ${(uncompSize / compSize).toFixed(1)}x exceeds limit ${quotas.maxCompressionRatio}x`,
      )
    }
    totalUncompressed += uncompSize
    if (totalUncompressed > quotas.maxTotalBytes) {
      throw new OoxmlBlockedError('ZIP_BOMB_QUOTA', `Total uncompressed size ${totalUncompressed} exceeds quota ${quotas.maxTotalBytes}`)
    }
    pos += 46 + nameLen + extraLen + commentLen
    seen += 1
  }
}

function assertNoXxe(xml: string, partName: string): void {
  if (/<!(?:DOCTYPE|ENTITY)\b/i.test(xml)) {
    throw new OoxmlBlockedError('XXE_FORBIDDEN', `XML DTD/ENTITY declarations forbidden in ${partName}`)
  }
}

function decodeXmlEntities(text: string): string {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
}

function safeUnzipOoxml(input: Buffer | Uint8Array, quotas: ZipBombQuotas): Record<string, Uint8Array> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  if (bytes.byteLength < 8) {
    throw new OoxmlBlockedError('INVALID_ZIP', 'File too small to be a valid OOXML archive')
  }
  if (Buffer.from(bytes.subarray(0, 8)).equals(OLE2_MAGIC)) {
    throw new OoxmlBlockedError('LEGACY_OFFICE_FORMAT', 'Legacy OLE2 binary or encrypted Office file is not supported')
  }
  if (!Buffer.from(bytes.subarray(0, 4)).equals(ZIP_MAGIC)) {
    throw new OoxmlBlockedError('INVALID_ZIP', 'Missing ZIP magic header')
  }

  precheckZipCentralDirectory(bytes, quotas)

  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(bytes)
  } catch (err) {
    throw new OoxmlBlockedError('INVALID_ZIP', `Failed to inflate OOXML: ${err instanceof Error ? err.message : String(err)}`)
  }

  if ('EncryptionInfo' in entries || 'EncryptedPackage' in entries) {
    throw new OoxmlBlockedError('ENCRYPTED_OOXML', 'Password-protected OOXML archives are blocked')
  }

  let totalBytes = 0
  for (const [name, data] of Object.entries(entries)) {
    if (data.byteLength > quotas.maxSingleFileBytes) {
      throw new OoxmlBlockedError('ZIP_BOMB_QUOTA', `Inflated entry ${name} exceeds maxSingleFileBytes`)
    }
    totalBytes += data.byteLength
    if (totalBytes > quotas.maxTotalBytes) {
      throw new OoxmlBlockedError('ZIP_BOMB_QUOTA', 'Total inflated bytes exceed maxTotalBytes')
    }
    if (name.endsWith('.xml') || name.endsWith('.rels')) {
      assertNoXxe(strFromU8(data), name)
    }
  }
  return entries
}

function extractDocxFromEntries(entries: Record<string, Uint8Array>): string {
  if (!('word/document.xml' in entries)) {
    throw new OoxmlBlockedError('INVALID_ZIP', 'DOCX missing word/document.xml')
  }
  const parts = [
    'word/document.xml',
    ...Object.keys(entries)
      .filter((k) => /^word\/(?:header|footer)\d+\.xml$/i.test(k))
      .sort(),
  ]
  const paragraphs: string[] = []
  for (const part of parts) {
    const raw = entries[part]
    if (!raw) continue
    const xml = strFromU8(raw)
      .replace(/<w:altChunk\b[^>]*(?:\/>|>[\s\S]*?<\/w:altChunk>)/gi, '')
      .replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/gi, '')
      .replace(/<w:delText\b[^>]*>[\s\S]*?<\/w:delText>/gi, '')
      .replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/gi, '')

    const pRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi
    let pm: RegExpExecArray | null
    while ((pm = pRe.exec(xml)) !== null) {
      const body = pm[1] ?? ''
      const pieces: string[] = []
      const tRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/gi
      let tm: RegExpExecArray | null
      while ((tm = tRe.exec(body)) !== null) {
        if (tm[1] !== undefined) pieces.push(decodeXmlEntities(tm[1]))
        else if (tm[0].toLowerCase().startsWith('<w:tab')) pieces.push('\t')
        else pieces.push('\n')
      }
      const line = pieces.join('').replace(/[ \t]+/g, ' ').trim()
      if (line.length > 0) paragraphs.push(line)
    }
  }
  return paragraphs.join('\n')
}

function extractXlsxFromEntries(entries: Record<string, Uint8Array>): string {
  const sharedStrings: string[] = []
  if (entries['xl/sharedStrings.xml']) {
    const ssXml = strFromU8(entries['xl/sharedStrings.xml']!)
    const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/gi
    let sm: RegExpExecArray | null
    while ((sm = siRe.exec(ssXml)) !== null) {
      const texts: string[] = []
      const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/gi
      let tm: RegExpExecArray | null
      while ((tm = tRe.exec(sm[1] ?? '')) !== null) {
        texts.push(decodeXmlEntities(tm[1] ?? ''))
      }
      sharedStrings.push(texts.join(''))
    }
  }

  const sheetParts = Object.keys(entries)
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
    .sort((a, b) => {
      const na = Number.parseInt(/sheet(\d+)/i.exec(a)?.[1] ?? '0', 10)
      const nb = Number.parseInt(/sheet(\d+)/i.exec(b)?.[1] ?? '0', 10)
      return na - nb
    })
  if (sheetParts.length === 0) {
    throw new OoxmlBlockedError('INVALID_ZIP', 'XLSX missing xl/worksheets/sheet*.xml')
  }

  const output: string[] = []
  for (const part of sheetParts) {
    const xml = strFromU8(entries[part]!)
    output.push(`# ${part.replace(/^xl\/worksheets\//i, '').replace(/\.xml$/i, '')}`)
    const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/gi
    let rm: RegExpExecArray | null
    while ((rm = rowRe.exec(xml)) !== null) {
      const cells: string[] = []
      const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi
      let cm: RegExpExecArray | null
      while ((cm = cellRe.exec(rm[1] ?? '')) !== null) {
        const attrs = cm[1] ?? ''
        const inner = cm[2] ?? ''
        const typeMatch = /\bt\s*=\s*["']([^"']+)["']/i.exec(attrs)
        const cellType = typeMatch?.[1] ?? ''
        if (cellType === 'inlineStr') {
          const tMatch = /<t\b[^>]*>([\s\S]*?)<\/t>/i.exec(inner)
          cells.push(decodeXmlEntities(tMatch?.[1] ?? ''))
        } else {
          const vMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(inner)
          const rawVal = decodeXmlEntities(vMatch?.[1] ?? '')
          if (cellType === 's') {
            const idx = Number.parseInt(rawVal, 10)
            cells.push(Number.isInteger(idx) && sharedStrings[idx] !== undefined ? sharedStrings[idx]! : rawVal)
          } else {
            cells.push(rawVal)
          }
        }
      }
      const line = cells.filter((c) => c.trim().length > 0).join(' | ')
      if (line.length > 0) output.push(line)
    }
  }
  return output.join('\n')
}

function extractPptxFromEntries(entries: Record<string, Uint8Array>): string {
  const slideParts = Object.keys(entries)
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
    .sort((a, b) => {
      const na = Number.parseInt(/slide(\d+)/i.exec(a)?.[1] ?? '0', 10)
      const nb = Number.parseInt(/slide(\d+)/i.exec(b)?.[1] ?? '0', 10)
      return na - nb
    })
  if (slideParts.length === 0) {
    throw new OoxmlBlockedError('INVALID_ZIP', 'PPTX missing ppt/slides/slide*.xml')
  }

  const output: string[] = []
  slideParts.forEach((part, idx) => {
    const xml = strFromU8(entries[part]!)
    const lines: string[] = []
    const pRe = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/gi
    let pm: RegExpExecArray | null
    while ((pm = pRe.exec(xml)) !== null) {
      const pieces: string[] = []
      const tRe = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/gi
      let tm: RegExpExecArray | null
      while ((tm = tRe.exec(pm[1] ?? '')) !== null) {
        pieces.push(decodeXmlEntities(tm[1] ?? ''))
      }
      const line = pieces.join('').trim()
      if (line.length > 0) lines.push(line)
    }
    if (lines.length > 0) {
      output.push(`# Slide ${idx + 1}\n${lines.join('\n')}`)
    }
  })
  return output.join('\n\n')
}

export function extractSafeOoxmlText(
  bytes: Buffer | Uint8Array,
  ext: '.docx' | '.xlsx' | '.pptx',
  quotas: Partial<ZipBombQuotas> = {},
): string {
  const mergedQuotas: ZipBombQuotas = { ...DEFAULT_ZIP_QUOTAS, ...quotas }
  const entries = safeUnzipOoxml(bytes, mergedQuotas)
  if (ext === '.docx') return extractDocxFromEntries(entries)
  if (ext === '.xlsx') return extractXlsxFromEntries(entries)
  if (ext === '.pptx') return extractPptxFromEntries(entries)
  throw new OoxmlBlockedError('UNSUPPORTED_OOXML', `Unsupported OOXML extension: ${ext}`)
}
