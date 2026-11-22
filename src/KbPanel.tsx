import { useCallback, useEffect, useState } from 'react'
import styles from './kb.module.css'
import type { KbRootRecord, KbSearchHit } from './core/types.js'

export interface KbRpcCaller {
  call<T = any>(method: string, payload?: Record<string, unknown>): Promise<T>
}

export function KbPanel({
  rpc,
  t,
}: {
  readonly rpc: KbRpcCaller
  readonly t: (key: string) => string
}) {
  const [roots, setRoots] = useState<readonly KbRootRecord[]>([])
  const [newRootPath, setNewRootPath] = useState('')
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<readonly KbSearchHit[]>([])
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await rpc.call<{ roots: KbRootRecord[] }>('listRoots')
      setRoots(res.roots ?? [])
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : String(err))
    }
  }, [rpc])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleAddRoot = async () => {
    if (!newRootPath.trim()) return
    setBusy(true)
    try {
      const res = await rpc.call<{ summary?: { indexed: number; skippedUnchanged: number } }>('addRoot', {
        rootPath: newRootPath.trim(),
        indexNow: true,
      })
      setNewRootPath('')
      setStatusMsg(`Indexed ${res.summary?.indexed ?? 0} file(s), skipped ${res.summary?.skippedUnchanged ?? 0}.`)
      await refresh()
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleReindex = async (rootPath: string) => {
    setBusy(true)
    try {
      const summary = await rpc.call<{ indexed: number; skippedUnchanged: number; removed: number }>('indexRoot', {
        rootPath,
      })
      setStatusMsg(`Reindexed ${rootPath}: +${summary.indexed}, unchanged ${summary.skippedUnchanged}, -${summary.removed}.`)
      await refresh()
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleSearch = async () => {
    if (!query.trim()) return
    setBusy(true)
    try {
      const res = await rpc.call<{ hits: KbSearchHit[] }>('search', { query: query.trim(), limit: 15 })
      setHits(res.hits ?? [])
      setStatusMsg(`Found ${res.hits?.length ?? 0} hit(s).`)
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t('title')}</h2>
          <p className={styles.subtitle}>{t('subtitle')}</p>
        </div>
        <button type="button" className={styles.btn} onClick={refresh} disabled={busy}>
          {t('action.refresh')}
        </button>
      </div>

      {statusMsg && <div className={styles.row}>{statusMsg}</div>}

      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>{t('section.roots')}</h3>
        <div className={styles.formRow}>
          <input
            className={styles.input}
            value={newRootPath}
            onChange={(e) => setNewRootPath(e.target.value)}
            placeholder={t('placeholder.root')}
          />
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAddRoot} disabled={busy}>
            {t('action.addAndIndex')}
          </button>
        </div>

        {roots.length === 0 ? (
          <div className={styles.empty}>{t('empty.roots')}</div>
        ) : (
          <div className={styles.list}>
            {roots.map((r) => (
              <div key={r.rootPath} className={styles.row}>
                <div>
                  <div>
                    <strong>{r.label}</strong> <span className={styles.badge}>{r.documentCount} docs</span>
                  </div>
                  <div className={styles.mono}>{r.rootPath}</div>
                </div>
                <button type="button" className={styles.btn} onClick={() => handleReindex(r.rootPath)} disabled={busy}>
                  {t('action.reindex')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>{t('section.search')}</h3>
        <div className={styles.formRow}>
          <input
            className={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('placeholder.query')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSearch()
            }}
          />
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSearch} disabled={busy}>
            {t('action.search')}
          </button>
        </div>

        {hits.length === 0 ? (
          <div className={styles.empty}>{t('empty.hits')}</div>
        ) : (
          <div className={styles.list}>
            {hits.map((h) => (
              <div key={`${h.docId}:${h.chunkIndex}`} className={styles.row}>
                <div>
                  <div>
                    <strong>{h.relPath}</strong>{' '}
                    <span className={`${styles.badge} ${h.stale ? (styles.badgeStale ?? '') : ''}`}>
                      {h.stale ? 'stale' : h.matchSource}
                    </span>{' '}
                    <span className={styles.mono}>
                      [{h.charStart}..{h.charEnd}] · {h.sourceHash.slice(0, 10)}
                    </span>
                  </div>
                  <div className={styles.mono}>{h.excerpt.slice(0, 220)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
