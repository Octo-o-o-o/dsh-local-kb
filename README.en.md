# dsh-local-kb

[中文](./README.md)

Local-first deterministic knowledge base plugin for DeepSeek Harness (`dsh@0.2.2-rc.5`) built on Node 26's built-in `node:sqlite` FTS5 with **zero native compilation** and **zero runtime dependencies**.

## Features

- **Dual FTS5 Index on Built-in `node:sqlite`**:
  - `chunks_fts_trigram` (`tokenize='trigram'`) for arbitrary 3+ character substring matches.
  - `chunks_fts_tokens` (pure-JS CJK bigram + ASCII tokenizer with `unicode61`) so 2-character Chinese terms (e.g., `标书`, `合同`, `审计`) match deterministically without C++ addons.
- **Safe Pure-JS & OOXML Extraction**:
  - Built-in support for Markdown, plain text, JSON, CSV, YAML, HTML, and source code.
  - Statically bundled `fflate` OOXML extractor for `.docx`, `.xlsx`, `.pptx` featuring pre-inflation ZIP Central Directory 4-quota bomb protection (max entries, max single file, max total uncompressed, max compression ratio), path traversal rejection, XXE (`<!DOCTYPE`/`<!ENTITY`) hard blocking, and `<w:altChunk>`/`<w:del>` stripping.
  - Extensible `registerExtractor(ext, fn)` registry for custom PDF/OCR integrations.
- **`source_hash` Freshness & Incremental Indexing**: SHA-256 content hashing skips unchanged files during re-index and detects live disk edits during reads.
- **Mandatory Bounded Pagination**: `kb_read` always enforces `offset`/`limit` bounds and emits `truncated` + `nextOffset`.
- **Strict `kbOnlyMode` Confinement**: `realpath` root confinement + built-in protected credential path exclusions.
- **Zero-Coupling Sibling Discovery**: Automatically registers evidence spans into `ctx.get('governanceEvidence')` (`dsh-grounding-guard`) and logs events into `ctx.get('governanceAudit')` (`dsh-audit-ledger`) when present.

## Install

```bash
dsh plugin add github:Octo-o-o-o/dsh-local-kb
```

## Honest Boundaries

- Binary PDF/OCR parsing is intentionally excluded from the zero-native core; plug in PDF/OCR via `registerExtractor('.pdf', fn)`.
- Deterministic lexical/substring retrieval (no implicit remote embedding calls).

## License

[Apache-2.0](./LICENSE) — Copyright 2026 OctoLab (`Octo-o-o-o`).
