/**
 * Official dsh@0.2.2-rc.5 Client entrypoint for `dsh-local-kb`.
 */
import { KbPanel, type KbRpcCaller } from './KbPanel.js'

interface LocaleApi {
  register(namespace: string, locale: string, dictionary: Record<string, string>): () => void
  bind(namespace: string): (key: string) => string
}

interface SlotsApi {
  inject(key: string, callback: () => unknown): () => void
  register(options: Record<string, unknown>, component: unknown): () => void
}

interface ConnectionClientApi {
  readonly rpc: {
    call<T = unknown>(
      channel: string,
      endpoint: string,
      payload?: unknown,
    ): Promise<{ ok: true; value: T } | { ok: false; error: { code: string; message: string } }>
  }
}

interface ClientContext {
  effect(run: () => void | (() => void), label?: string): void
  locale: LocaleApi
  slots: SlotsApi
  connection: ConnectionClientApi
}

const NS = 'dshLocalKb'
const PANEL_ID = 'dsh-local-kb'

function KbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="2" width="11" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.2 5.5H10.8M5.2 8H10.8M5.2 10.5H8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export const inject = ['slots', 'locale', 'layout', 'connection']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const disposeZh = ctx.locale.register(NS, 'zh', {
      nav: '本地知识库',
      title: '本地确定性知识库 (FTS5 + 安全 OOXML)',
      subtitle: 'Node 26 内置 node:sqlite 双索引 · DOCX/XLSX/PPTX 安全解析 · source_hash 鲜度校验 · 强制分页',
      'action.refresh': '刷新',
      'action.addAndIndex': '添加并建立索引',
      'action.reindex': '增量重索引',
      'action.search': '确定性检索',
      'section.roots': '授权知识库根目录 (kbOnlyMode)',
      'section.search': 'FTS5 CJK + Trigram 检索测试',
      'placeholder.root': '输入本地文件夹绝对路径，例如 C:\\Docs\\Specs',
      'placeholder.query': '输入 2 字以上中文词或英文关键字…',
      'empty.roots': '尚未登记知识库根目录',
      'empty.hits': '暂无检索命中',
    })
    const disposeEn = ctx.locale.register(NS, 'en', {
      nav: 'Local KB',
      title: 'Local Deterministic Knowledge Base',
      subtitle: 'Node 26 node:sqlite dual FTS5 · Safe OOXML (DOCX/XLSX/PPTX) · source_hash freshness · bounded reads',
      'action.refresh': 'Refresh',
      'action.addAndIndex': 'Add & Index',
      'action.reindex': 'Re-index',
      'action.search': 'Search',
      'section.roots': 'Authorized KB Roots (kbOnlyMode)',
      'section.search': 'FTS5 CJK + Trigram Search Preview',
      'placeholder.root': 'Absolute directory path, e.g. /Users/alice/docs',
      'placeholder.query': 'Enter 2+ char CJK terms or ASCII keywords...',
      'empty.roots': 'No KB roots registered yet',
      'empty.hits': 'No search hits yet',
    })
    return () => {
      disposeZh()
      disposeEn()
    }
  }, 'dsh-local-kb: dictionaries')

  const t = ctx.locale.bind(NS)
  const rpc: KbRpcCaller = {
    async call<T = any>(method: string, payload?: Record<string, unknown>): Promise<T> {
      const res = await ctx.connection.rpc.call<T>('/api', 'dshLocalKb', {
        method,
        payload: payload ?? {},
      })
      if (!res.ok) throw new Error(res.error?.message ?? `RPC failed: ${method}`)
      return res.value
    },
  }

  ctx.slots.inject('main', () =>
    ctx.slots.register(
      {
        name: 'main',
        key: PANEL_ID,
        locale: NS,
        inject: () => ({ rpc, t }),
      },
      KbPanel,
    ),
  )

  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      {
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 65,
        locale: NS,
        label: () => t('nav'),
      },
      KbIcon,
    ),
  )
}
