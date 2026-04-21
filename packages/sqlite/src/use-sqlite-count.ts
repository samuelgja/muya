import { useEffect, useMemo, useRef, useSyncExternalStore, type DependencyList } from 'react'
import type { DocType } from './table/table.types'
import type { Where } from './table/where'
import type { SyncTable } from './types'
import { getOrCreateCountEngine, type CountEngine } from './use-sqlite.engine'

export interface UseSqliteCountOptions<Document extends DocType> {
  readonly where?: Where<Document>
  /**
   * Optional cache key. When set, the count + the live subscription are
   * kept in a global cache and reused across unmount/remount cycles.
   * The full key is `(state, cacheKey, deps)`.
   */
  readonly cacheKey?: string
  /**
   * Idle ms to keep a cached entry alive after the last consumer unmounts.
   * Default 5 minutes. `Infinity` = never expire. `0` = dispose on unmount.
   */
  readonly gcTime?: number
}

/**
 * Reactive row counter. Returns the live count of rows matching `options.where`.
 * Updates when rows are inserted or deleted; ignores in-place updates
 * (which never change the count).
 *
 * Set `options.cacheKey` to share the loaded count across unmount/remount
 * cycles - the underlying subscription stays alive for `gcTime` (default
 * 5 min) so reopening a screen shows the count instantly.
 * @param state The SyncTable instance to observe
 * @param options Filter + cache options
 * @param deps Dependency list - changing any element re-runs the count
 * @returns The current row count (0 until the first count completes)
 */
export function useSqliteCount<Document extends DocType>(
  state: SyncTable<Document>,
  options: UseSqliteCountOptions<Document> = {},
  deps: DependencyList = [],
): number {
  const { cacheKey, gcTime } = options

  const engine = useMemo<CountEngine<Document>>(
    () => getOrCreateCountEngine<Document>(state, options, cacheKey === undefined ? null : cacheKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, cacheKey],
  )

  engine.updateOptions(options)

  const lastGcTimeRef = useRef<number | undefined>(gcTime)
  lastGcTimeRef.current = gcTime
  useEffect(() => {
    engine.retain()
    return () => {
      engine.release(lastGcTimeRef.current)
    }
  }, [engine])

  // Re-run count when deps change (skip first render).
  const initialMountRef = useRef(true)
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false
      return
    }
    void engine.refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, ...deps])

  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)
  return snapshot.count ?? 0
}
