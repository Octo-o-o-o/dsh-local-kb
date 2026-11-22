/**
 * Official dsh@0.2.2-rc.5 Host entrypoint for `dsh-local-kb`.
 *
 * Provides `governanceKb` service, registers DSH read-only agent tools
 * (`kb_list_roots`, `kb_search`, `kb_read`) adhering to DSH's canonical
 * `ToolDefinition` (`output: { schema, render }`) contract, auto-registers
 * read evidence into optional `governanceEvidence` (`dsh-grounding-guard`),
 * and logs index/read/denial audit events into optional `governanceAudit`
 * (`dsh-audit-ledger`).
 */
import { LocalKbStore } from '../storage/kb-sqlite.js'
import type { GovernanceKbService, KbExtractorFn, KbReadOptions, LocalKbConfig } from '../core/types.js'

export * from '../core/types.js'
export * from '../core/ooxml-extract.js'
export * from '../core/extractors.js'
export * from '../core/cjk-tokenizer.js'
export * from '../core/path-guard.js'
export { LocalKbStore } from '../storage/kb-sqlite.js'

interface OptionalAuditService {
  recordEvent?(input: Record<string, unknown>): unknown
}

interface OptionalEvidenceService {
  registerEvidence?(input: {
    readonly sessionId: string
    readonly sourceType: 'kb'
    readonly locator: string
    readonly title?: string
    readonly excerpt: string
    readonly fullText?: string
    readonly sha256?: string
    readonly truncated?: boolean
    readonly nextOffset?: number
    readonly auditability?: 'auditable' | 'partial' | 'unverified'
  }): { readonly id: string }
}

interface DshToolsServiceLike {
  register?(definition: {
    readonly name: string
    readonly description: string
    readonly parameters: Record<string, unknown>
    readonly output: {
      readonly schema: Record<string, unknown>
      readonly render: (args: unknown, value: unknown) => { readonly type: 'text'; readonly text: string }[]
    }
    readonly isConcurrencySafe?: (args: unknown) => boolean
    readonly execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
  }): () => void
}

interface OfficialHostConnection {
  readonly fetch: {
    register(route: {
      readonly path: string
      readonly methods: readonly ('GET' | 'HEAD' | 'POST')[]
      readonly requestBody: 'buffered' | 'streaming'
      readonly fetch: (request: Request) => Promise<Response>
    }): () => Promise<void> | void
  }
}

interface CordisLikeContext {
  get(key: string): unknown
  provide?(key: string, value: unknown): void
  inject?(deps: readonly string[], callback: (ctx: CordisLikeContext) => void): () => void
  effect?(run: () => void | (() => void | Promise<void>), label?: string): void
}

export const name = 'dsh-local-kb'

function resolveSessionId(exec?: Record<string, unknown>): string {
  const agent = exec?.agent as { session?: { id?: string } } | undefined
  if (agent?.session?.id) return agent.session.id
  if (typeof exec?.sessionId === 'string') return exec.sessionId
  return 'default-session'
}

export function apply(ctx: CordisLikeContext, config: LocalKbConfig = {}): GovernanceKbService {
  const store = new LocalKbStore(config)

  const recordAudit = (input: Record<string, unknown>) => {
    const audit = ctx.get('governanceAudit') as OptionalAuditService | undefined
    try {
      audit?.recordEvent?.(input)
    } catch {
      /* optional sibling */
    }
  }

  const registerEvidenceSpan = (input: {
    readonly sessionId: string
    readonly locator: string
    readonly excerpt: string
    readonly fullText?: string
    readonly sha256: string
    readonly truncated: boolean
    readonly nextOffset?: number
  }): string | undefined => {
    const evSvc = ctx.get('governanceEvidence') as OptionalEvidenceService | undefined
    try {
      const rec = evSvc?.registerEvidence?.({
        sessionId: input.sessionId,
        sourceType: 'kb',
        locator: input.locator,
        excerpt: input.excerpt,
        fullText: input.fullText,
        sha256: input.sha256,
        truncated: input.truncated,
        nextOffset: input.nextOffset,
        auditability: input.truncated ? 'partial' : 'auditable',
      })
      return rec?.id
    } catch {
      return undefined
    }
  }

  const service: GovernanceKbService = {
    addRoot: (rootPath: string, label?: string) => {
      const rec = store.addRoot(rootPath, label)
      recordAudit({
        stream: 'governance',
        eventName: 'kb.root_added',
        actorType: 'user',
        actorId: 'local-owner',
        resourceType: 'kb_root',
        resourceId: rec.rootPath,
        outcome: 'success',
      })
      return rec
    },
    removeRoot: (rootPath: string) => {
      const ok = store.removeRoot(rootPath)
      recordAudit({
        stream: 'governance',
        eventName: 'kb.root_removed',
        actorType: 'user',
        actorId: 'local-owner',
        resourceType: 'kb_root',
        resourceId: rootPath,
        outcome: ok ? 'success' : 'failure',
      })
      return ok
    },
    listRoots: () => store.listRoots(),
    indexRoot: async (rootPath: string) => {
      const summary = await store.indexRoot(rootPath)
      recordAudit({
        stream: 'governance',
        eventName: 'kb.indexed',
        actorType: 'system',
        actorId: 'dsh-local-kb',
        resourceType: 'kb_root',
        resourceId: summary.rootPath,
        outcome: 'success',
        payload: {
          scanned: summary.scanned,
          indexed: summary.indexed,
          skippedUnchanged: summary.skippedUnchanged,
          removed: summary.removed,
          blockedCount: summary.blocked.length,
        },
      })
      return summary
    },
    listDocuments: (rootPath?: string) => store.listDocuments(rootPath),
    search: (query, opts) => {
      const res = store.search(query, opts)
      const sessionId = opts?.sessionId ?? 'default-session'
      for (const hit of res.hits.slice(0, 5)) {
        registerEvidenceSpan({
          sessionId,
          locator: `${hit.relPath}#chunk-${hit.chunkIndex}`,
          excerpt: hit.excerpt,
          fullText: hit.excerpt,
          sha256: hit.sourceHash,
          truncated: true,
          nextOffset: hit.charEnd,
        })
      }
      recordAudit({
        stream: 'governance',
        eventName: 'kb.search',
        actorType: 'agent',
        actorId: sessionId,
        resourceType: 'kb_index',
        outcome: 'success',
        payload: { queryLength: query.length, hitCount: res.hits.length, truncated: res.truncated },
      })
      return res
    },
    read: async (targetPath: string, opts: KbReadOptions = {}) => {
      const sessionId = opts.sessionId ?? 'default-session'
      try {
        const res = await store.read(targetPath, opts)
        const evidenceId = registerEvidenceSpan({
          sessionId,
          locator: res.relPath,
          excerpt: res.content.slice(0, 2_000),
          fullText: res.content,
          sha256: res.sourceHash,
          truncated: res.truncated,
          nextOffset: res.nextOffset,
        })
        recordAudit({
          stream: 'governance',
          eventName: 'kb.read',
          actorType: 'agent',
          actorId: sessionId,
          resourceType: 'kb_document',
          resourceId: res.relPath,
          outcome: 'success',
          payload: {
            sourceHash: res.sourceHash,
            offset: res.offset,
            limit: res.limit,
            truncated: res.truncated,
            reindexed: res.reindexed,
          },
        })
        return evidenceId ? { ...res, evidenceId } : res
      } catch (err) {
        recordAudit({
          stream: 'security',
          eventName: 'kb.read_denied',
          actorType: 'agent',
          actorId: sessionId,
          resourceType: 'kb_document',
          resourceId: targetPath,
          outcome: 'denied',
          payload: { reason: err instanceof Error ? err.message : String(err) },
        })
        throw err
      }
    },
    registerExtractor: (ext: string, fn: KbExtractorFn) => store.registerExtractor(ext, fn),
    getSupportedExtensions: () => store.extractors.listSupportedExtensions(),
    getConfig: () => ({
      kbOnlyMode: store.kbOnlyMode,
      defaultReadLimit: store.defaultReadLimit,
      maxReadLimit: store.maxReadLimit,
      dbPath: store.dbPath,
    }),
    close: () => store.close(),
  }

  ctx.provide?.('governanceKb', service)

  // Register official DSH agent tools (`kb_list_roots`, `kb_search`, `kb_read`)
  const toolDisposers: (() => void)[] = []
  const registerKbTools = (tools: DshToolsServiceLike, target: (() => void)[]) => {
    if (!tools || typeof tools.register !== 'function') return
    target.push(
      tools.register({
        name: 'kb_list_roots',
        description: 'List authorized local knowledge base roots and indexed document counts.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        output: {
          schema: {
            type: 'object',
            properties: {
              roots: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    rootPath: { type: 'string' },
                    label: { type: 'string' },
                    addedAt: { type: 'string' },
                    documentCount: { type: 'number' },
                  },
                  required: ['rootPath', 'label', 'addedAt', 'documentCount'],
                  additionalProperties: false,
                },
              },
            },
            required: ['roots'],
            additionalProperties: false,
          },
          render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
        },
        isConcurrencySafe: () => true,
        execute: async () => ({ roots: service.listRoots() }),
      }),
    )

    target.push(
      tools.register({
        name: 'kb_search',
        description: 'Deterministic FTS5 search across authorized local KB documents (supports 2+ char CJK and ASCII substrings).',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query (Chinese/CJK 2+ chars or ASCII keywords).' },
            limit: { type: 'number', description: 'Max hits to return (1..50, default 10).' },
            rootPath: { type: 'string', description: 'Optional KB root filter.' },
          },
          required: ['query'],
          additionalProperties: false,
        },
        output: {
          schema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              totalHits: { type: 'number' },
              truncated: { type: 'boolean' },
              hits: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    docId: { type: 'string' },
                    rootPath: { type: 'string' },
                    relPath: { type: 'string' },
                    absPath: { type: 'string' },
                    sourceHash: { type: 'string' },
                    stale: { type: 'boolean' },
                    chunkIndex: { type: 'number' },
                    charStart: { type: 'number' },
                    charEnd: { type: 'number' },
                    excerpt: { type: 'string' },
                    matchSource: { type: 'string' },
                  },
                  required: ['docId', 'relPath', 'sourceHash', 'stale', 'excerpt'],
                  additionalProperties: true,
                },
              },
            },
            required: ['query', 'totalHits', 'truncated', 'hits'],
            additionalProperties: false,
          },
          render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
        },
        isConcurrencySafe: () => true,
        execute: async (rawArgs, exec) => {
          const args = (rawArgs ?? {}) as { query?: string; limit?: number; rootPath?: string }
          return service.search(String(args.query ?? ''), {
            limit: typeof args.limit === 'number' ? args.limit : undefined,
            rootPath: typeof args.rootPath === 'string' ? args.rootPath : undefined,
            sessionId: resolveSessionId(exec),
          })
        },
      }),
    )

    target.push(
      tools.register({
        name: 'kb_read',
        description:
          'Read a bounded paginated slice of an authorized local KB document with source_hash freshness verification and mandatory truncated/nextOffset flags.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path inside a KB root or confined absolute path.' },
            offset: { type: 'number', description: 'Start character offset (default 0).' },
            limit: { type: 'number', description: 'Max characters to return (bounded by maxReadLimit).' },
          },
          required: ['path'],
          additionalProperties: false,
        },
        output: {
          schema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              relPath: { type: 'string' },
              rootPath: { type: 'string' },
              extractor: { type: 'string' },
              sourceHash: { type: 'string' },
              stale: { type: 'boolean' },
              reindexed: { type: 'boolean' },
              offset: { type: 'number' },
              limit: { type: 'number' },
              totalChars: { type: 'number' },
              truncated: { type: 'boolean' },
              nextOffset: { type: 'number' },
              content: { type: 'string' },
              evidenceId: { type: 'string' },
            },
            required: ['relPath', 'sourceHash', 'offset', 'limit', 'totalChars', 'truncated', 'content'],
            additionalProperties: true,
          },
          render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
        },
        isConcurrencySafe: () => true,
        execute: async (rawArgs, exec) => {
          const args = (rawArgs ?? {}) as { path?: string; offset?: number; limit?: number }
          return await service.read(String(args.path ?? ''), {
            offset: typeof args.offset === 'number' ? args.offset : undefined,
            limit: typeof args.limit === 'number' ? args.limit : undefined,
            sessionId: resolveSessionId(exec),
          })
        },
      }),
    )
  }

  if (typeof ctx.inject === 'function') {
    ctx.inject(['tools'], (scope) => {
      const ts = scope.get('tools') as DshToolsServiceLike | undefined
      if (!ts) return
      const local: (() => void)[] = []
      registerKbTools(ts, local)
      scope.effect?.(() => () => {
        for (const d of local) {
          try { d() } catch { /* ignore */ }
        }
      }, 'dsh-local-kb: tools')
    })
  } else {
    const ts = ctx.get('tools') as DshToolsServiceLike | undefined
    if (ts) registerKbTools(ts, toolDisposers)
  }

  // Authenticated Host RPC: /api/dshLocalKb
  let disposeRoute: (() => Promise<void> | void) | undefined
  const registerConnectionRoute = (connection: OfficialHostConnection): (() => Promise<void> | void) | undefined => {
    if (!connection?.fetch?.register) return undefined
    return connection.fetch.register({
      path: '/api/dshLocalKb',
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async (request: Request) => {
        let body: Record<string, unknown>
        try {
          body = (await request.json()) as Record<string, unknown>
        } catch {
          return new Response('body is not JSON', { status: 400 })
        }
        const rpcId = typeof body?.rpcId === 'string' ? body.rpcId : '00000000-0000-0000-0000-000000000000'
        const isDshEnvelope = body?.type === 'client-request' && body?.payload && typeof body.payload === 'object'
        const envelope = (isDshEnvelope ? body.payload : body) as { method?: unknown; payload?: Record<string, unknown> }
        const method = typeof envelope.method === 'string' ? envelope.method : 'status'
        const payload = (envelope.payload && typeof envelope.payload === 'object' ? envelope.payload : {}) as Record<string, unknown>

        const dispatch = async (): Promise<
          { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string; readonly details: object } }
        > => {
          try {
            if (method === 'status') {
              return {
                ok: true,
                value: {
                  config: service.getConfig(),
                  roots: service.listRoots(),
                  supportedExtensions: service.getSupportedExtensions(),
                },
              }
            }
            if (method === 'listRoots') {
              return { ok: true, value: { roots: service.listRoots() } }
            }
            if (method === 'addRoot') {
              const rootPath = String(payload.rootPath ?? '')
              const label = typeof payload.label === 'string' ? payload.label : undefined
              const root = service.addRoot(rootPath, label)
              const summary = payload.indexNow === false ? null : await service.indexRoot(root.rootPath)
              return { ok: true, value: { root, summary } }
            }
            if (method === 'removeRoot') {
              return { ok: true, value: { removed: service.removeRoot(String(payload.rootPath ?? '')) } }
            }
            if (method === 'indexRoot') {
              return { ok: true, value: await service.indexRoot(String(payload.rootPath ?? '')) }
            }
            if (method === 'listDocuments') {
              return {
                ok: true,
                value: {
                  documents: service.listDocuments(typeof payload.rootPath === 'string' ? payload.rootPath : undefined),
                },
              }
            }
            if (method === 'search') {
              return {
                ok: true,
                value: service.search(String(payload.query ?? ''), {
                  limit: typeof payload.limit === 'number' ? payload.limit : undefined,
                  rootPath: typeof payload.rootPath === 'string' ? payload.rootPath : undefined,
                }),
              }
            }
            if (method === 'read') {
              return {
                ok: true,
                value: await service.read(String(payload.path ?? ''), {
                  offset: typeof payload.offset === 'number' ? payload.offset : undefined,
                  limit: typeof payload.limit === 'number' ? payload.limit : undefined,
                }),
              }
            }
            return {
              ok: false,
              error: { code: 'dsh-local-kb/not-found', message: `Unknown method: ${method}`, details: {} },
            }
          } catch (err) {
            return {
              ok: false,
              error: { code: 'dsh-local-kb/error', message: err instanceof Error ? err.message : String(err), details: {} },
            }
          }
        }

        return Response.json({ type: 'server-response', rpcId, result: await dispatch() })
      },
    })
  }

  if (typeof ctx.inject === 'function') {
    ctx.inject(['connection'], (scope) => {
      const conn = scope.get('connection') as OfficialHostConnection | undefined
      if (!conn) return
      const disposer = registerConnectionRoute(conn)
      if (disposer) scope.effect?.(() => disposer, 'dsh-local-kb: connection route')
    })
  } else {
    const conn = ctx.get('connection') as OfficialHostConnection | undefined
    if (conn) disposeRoute = registerConnectionRoute(conn)
  }

  ctx.effect?.(() => {
    return async () => {
      for (const d of toolDisposers) d()
      await disposeRoute?.()
      store.close()
    }
  }, 'dsh-local-kb: cleanup')

  return service
}
