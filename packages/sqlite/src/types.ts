import type { Backend } from './table'
import type {
  DbOptions,
  DocType,
  DotPath,
  GetFieldType,
  GroupByOptions,
  GroupByResult,
  Key,
  MutationResult,
  SearchOptions,
  SqlSeachOptions,
} from './table/table.types'
import type { Where } from './table/where'

export interface CreateSqliteOptions<Document extends DocType> extends Omit<DbOptions<Document>, 'backend'> {
  readonly backend: Backend | Promise<Backend>
}

export interface MutationItems<Doc> {
  mutations?: MutationResult<Doc>[]
  removedAll?: boolean
}

export interface SyncTable<Document extends DocType> {
  readonly subscribe: (listener: (mutation: MutationItems<Document>) => void) => () => void
  readonly set: (document: Document) => Promise<MutationResult<Document>>
  readonly batchSet: (documents: Document[]) => Promise<MutationResult<Document>[]>
  readonly batchDelete: (keys: Key[]) => Promise<MutationResult<Document>[]>
  readonly get: <Selected = Document>(key: Key, selector?: (document: Document) => Selected) => Promise<Selected | undefined>
  readonly delete: (key: Key) => Promise<MutationResult<Document> | undefined>
  readonly search: <Selected = Document>(options?: SearchOptions<Document, Selected>) => AsyncIterableIterator<Selected>
  readonly count: (options?: { where?: Where<Document> }) => Promise<number>
  readonly deleteBy: (where: Where<Document>) => Promise<MutationResult<Document>[]>
  readonly clear: () => Promise<void>
  readonly groupBy: <Field extends DotPath<Document>>(
    field: Field,
    options?: GroupByOptions<Document>,
  ) => Promise<Array<GroupByResult<GetFieldType<Document, Field>>>>
}

export interface UseSearchOptions<Document extends DocType, Selected = Document> extends SqlSeachOptions<Document> {
  /**
   * Naive projection. Prefer specialized queries for heavy fan-out graphs.
   */
  readonly select?: (document: Document) => Selected
  /**
   * Optional cache key. When set, the loaded data + the live `state.subscribe`
   * listener are kept in a global cache and reused across unmount/remount
   * cycles. On remount with the same cacheKey, the first render already shows
   * the cached data (no `isLoading` flicker). The push subscription kept the
   * cache fresh while no consumer was mounted.
   *
   * cacheKey is the LITERAL cache identity. Deps changes do not create new
   * entries - they trigger `refetch()` on the same engine. To get per-deps
   * caching (TanStack queryKey style), include deps in the cacheKey yourself:
   * `cacheKey: 'search:' + filter`.
   */
  readonly cacheKey?: string
  /**
   * Idle ms to keep a cached entry alive after the last consumer unmounts.
   * - Default: 5 minutes (300_000)
   * - `Infinity`: never auto-expire (clear manually with `clearSqliteCache`)
   * - `0`: dispose immediately on last unmount (still cached during remount races)
   *
   * Only meaningful when `cacheKey` is set.
   */
  readonly gcTime?: number
}

/**
 * Reactive query result. Loading-state matrix:
 *
 * | Phase                                    | data    | status    | isLoading | isFetching | isStale |
 * |------------------------------------------|---------|-----------|-----------|------------|---------|
 * | Initial mount, never loaded              | `null`  | `pending` | **true**  | `true`     | `false` |
 * | First load complete                      | `[…]`   | `success` | `false`   | `false`    | `false` |
 * | Cache hit on remount (no refetch needed) | `[…]`   | `success` | `false`   | `false`    | `false` |
 * | Refetching (deps change / refetch / next)| `[…]`   | `success` | `false`   | **true**   | **true**|
 * | Errored on first load                    | `null`  | `error`   | `false`   | `false`    | `false` |
 * | Errored after had data                   | `[…]`   | `error`   | `false`   | `false`    | `false` |
 *
 * Consumer rule of thumb:
 * - `isLoading` → show full-page spinner / skeleton (only fires once, ever)
 * - `isStale` → dim the rendered list / inline refresh indicator
 * - `isError` + `error` → show error UI with a retry button (`refetch()`)
 * - `hasNextPage` → enable Load more button
 */
export interface UseSqliteResult<T> {
  /**
   * The current rows. `null` until the first load completes, then a stable
   * array reference that changes only on a successful (re)load or a visible
   * mutation. Safe to use as a React memo dependency.
   */
  readonly data: readonly T[] | null
  /**
   * `'pending'` until the first load finishes, then `'success'` (or `'error'`
   * if the most recent load threw). Once `'success'`, never flips back to
   * `'pending'` even during refetch — use `isFetching` / `isStale` for that.
   */
  readonly status: 'pending' | 'error' | 'success'
  /**
   * `true` ONLY on the very first load when `data` is still `null`. Use this
   * to gate a full-page spinner / skeleton. Never flips to `true` again after
   * data has loaded once. Equivalent to `status === 'pending' && data === null`.
   */
  readonly isLoading: boolean
  /**
   * `true` whenever any IO is in flight against the table — initial load,
   * `fetchNextPage()`, `refetch()`, deps-change-triggered refetch, or the
   * mutation-driven refill. Rarely needed directly: `isLoading` covers the
   * "no data yet" case and `isStale` covers the "data present but updating"
   * case.
   */
  readonly isFetching: boolean
  /**
   * `true` when data is already present but a refresh is in flight. The
   * canonical "dim the list" signal. Equivalent to `isFetching && data !== null`.
   */
  readonly isStale: boolean
  /** Sugar for `status === 'error'`. */
  readonly isError: boolean
  /** The most recent error if the last load threw, otherwise `null`. */
  readonly error: Error | null
  /**
   * `false` once the iterator is exhausted (lookahead-accurate — we peek one
   * row past `pageSize` so this flips on the same call that loaded the final
   * page, not on a follow-up empty fetch). Use to gate a "Load more" button.
   */
  readonly hasNextPage: boolean
  /**
   * Pull and append the next page. No-op when `hasNextPage === false` or
   * the engine is disposed. Concurrent calls serialize into a queue so 9
   * fire-and-forget calls load 9 sequential pages in order.
   *
   * Returns a Promise so consumers can drive `useTransition`:
   * `startTransition(async () => { await result.fetchNextPage() })`.
   */
  readonly fetchNextPage: () => Promise<void>
  /**
   * Discard current results and re-run the query from scratch. Cancels any
   * in-flight pull via the engine's epoch token. Old `data` stays visible
   * (`isStale = true`) until the new data lands. Same transition pattern as
   * `fetchNextPage`.
   */
  readonly refetch: () => Promise<void>
}
