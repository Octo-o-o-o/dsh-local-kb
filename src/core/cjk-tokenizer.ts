/**
 * Pure-JS CJK bigram + ASCII word tokenizer for SQLite FTS5 `unicode61`.
 *
 * SQLite's built-in `trigram` tokenizer handles 3+ character substrings well,
 * but cannot match 2-character Chinese terms (e.g. "标书", "合同", "审计").
 * Indexing CJK bigrams alongside `trigram` guarantees deterministic 2+ char CJK
 * AND arbitrary substring matching with zero native C++ addons.
 */

const CJK_CHAR_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const CJK_RUN_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/g
const ASCII_TOKEN_RE = /[A-Za-z0-9_.-]{2,}/g

export function tokenizeForFts(text: string): string {
  const tokens: string[] = []
  const cjkRuns = text.match(CJK_RUN_RE) ?? []
  for (const run of cjkRuns) {
    if (run.length === 1) {
      tokens.push(run)
    } else {
      for (let i = 0; i < run.length - 1; i += 1) {
        tokens.push(run.slice(i, i + 2))
      }
    }
  }
  const asciiRuns = text.match(ASCII_TOKEN_RE) ?? []
  for (const word of asciiRuns) {
    tokens.push(word.toLowerCase())
  }
  return tokens.join(' ')
}

export function buildFtsTokenQuery(query: string): string | null {
  const trimmed = query.trim()
  if (!trimmed) return null
  const terms = new Set<string>()

  const cjkRuns = trimmed.match(CJK_RUN_RE) ?? []
  for (const run of cjkRuns) {
    if (run.length === 1) {
      terms.add(run)
    } else {
      for (let i = 0; i < run.length - 1; i += 1) {
        terms.add(run.slice(i, i + 2))
      }
    }
  }

  const asciiRuns = trimmed.match(ASCII_TOKEN_RE) ?? []
  for (const word of asciiRuns) {
    terms.add(word.toLowerCase())
  }

  if (terms.size === 0) return null
  return [...terms]
    .slice(0, 16)
    .map((term) => `"${term.replaceAll('"', '""')}"`)
    .join(' AND ')
}

export function buildFtsTrigramQuery(query: string): string | null {
  const trimmed = query.trim()
  if (trimmed.length < 3) return null
  // Quote literal query so FTS5 operators inside user input cannot cause syntax errors
  const safe = trimmed.replaceAll('"', '""').slice(0, 128)
  return `"${safe}"`
}

export function hasCjk(text: string): boolean {
  return CJK_CHAR_RE.test(text)
}
