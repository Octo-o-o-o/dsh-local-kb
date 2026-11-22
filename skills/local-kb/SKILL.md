---
name: local-kb
description: Search and paginate local indexed knowledge base documents with source_hash freshness verification and evidence bus registration.
---

# Local Deterministic KB Skill

When `dsh-local-kb` is installed, use its tools for local document retrieval:

1. **`kb_list_roots`**: Discover which local directories are authorized and indexed.
2. **`kb_search`**: Perform deterministic FTS5 search (supports 2+ char Chinese/CJK terms and ASCII substrings). Inspect `sourceHash`, `stale`, and `charStart/charEnd`.
3. **`kb_read`**: Read document excerpts with explicit `offset` and `limit`. Always inspect `truncated` and `nextOffset` — if `truncated: true`, continue reading before making exhaustive statements.
4. **Confinement (`kbOnlyMode`)**: Never attempt to read outside registered KB roots or protected credential paths; reads automatically register verifiable evidence spans when `dsh-grounding-guard` is installed.
