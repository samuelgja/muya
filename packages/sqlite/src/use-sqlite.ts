import { useEffect, useMemo, useRef, useSyncExternalStore, type DependencyList } from 'react'
import type { DocType } from './table/table.types'
import type { SyncTable, UseSearchOptions, UseSqliteResult } from './types'
import { getOrCreateEngine, type QueryEngine } from './use-sqlite.engine'

/**
 * Reactive paginated SQLite query. Returns a TanStack-style result object
 * with explicit loading/fetching/error flags. Subscribes to the underlying
 * SyncTable so visible rows stay in sync with mutations.
 *
 * Backed by `useSyncExternalStore` over a per-instance (or shared, when
 * `cacheKey` is set) `QueryEngine`. Provides epoch-based cancellation,
 * iterator cleanup, and a serialized fetch queue.
 *
 * Set `options.cacheKey` to share the loaded data + live subscription
 * across mount/unmount cycles. See `clearSqliteCache` for invalidation.
 * @param state The SyncTable instance to query
 * @param options Search options (where, sortBy, pageSize, select, cacheKey, gcTime)
 * @param deps Dependency array - changing any element re-runs the query
 * @returns A snapshot result with data, status flags, and pagination actions
 */
export function useSqliteValue<Document extends DocType, Selected = Document>(
  state: SyncTable<Document>,
  options: UseSearchOptions<Document, Selected> = {},
  deps: DependencyList = [],
): UseSqliteResult<undefined extends Selected ? Document : Selected> {
  type Out = undefined extends Selected ? Document : Selected

  const { cacheKey, gcTime } = options

  // Engine identity: cacheKey when cached, null (= per-instance) otherwise.
  // Deps changes never recreate the engine - they trigger refetch via the
  // useEffect below so the cache persists across renders.
  const engine = useMemo<QueryEngine<Document, Out>>(
    () =>
      getOrCreateEngine<Document, Out>(
        state,
        options as UseSearchOptions<Document, Out>,
        cacheKey === undefined ? null : cacheKey,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, cacheKey],
  )

  // Always-fresh options: async work in the engine reads from this on every
  // microtask, so a new `select` or `pageSize` takes effect immediately.
  engine.updateOptions(options as UseSearchOptions<Document, Out>)

  // Refcount the engine. Cached engines persist for `gcTime` after release;
  // uncached engines (cacheKey === null) dispose immediately.
  const lastGcTimeRef = useRef<number | undefined>(gcTime)
  lastGcTimeRef.current = gcTime
  useEffect(() => {
    engine.retain()
    return () => {
      engine.release(lastGcTimeRef.current)
    }
  }, [engine])

  // Refetch when deps change (skip the very first render — the engine
  // already loaded in start()). React handles deps comparison natively
  // via the spread into the dep array.
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

  // Stale = "we have data but a fetch is in flight". Covers refetches
  // triggered by deps change AND by external refetch() calls.
  const isStale = snapshot.isFetching && snapshot.data !== null

  return useMemo<UseSqliteResult<Out>>(
    () => ({
      data: snapshot.data as readonly Out[] | null,
      status: snapshot.status,
      error: snapshot.error,
      isError: snapshot.status === 'error',
      isLoading: snapshot.status === 'pending' && snapshot.data === null,
      isFetching: snapshot.isFetching,
      isStale,
      hasNextPage: snapshot.hasNextPage,
      fetchNextPage: () => engine.fetchNextPage(),
      refetch: () => engine.refetch(),
    }),
    [snapshot, isStale, engine],
  )
}
