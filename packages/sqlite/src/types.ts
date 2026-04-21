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
}

export interface UseSqliteResult<T> {
  readonly data: readonly T[] | null
  readonly status: 'pending' | 'error' | 'success'
  /** True only on initial load (no data yet, query in flight). */
  readonly isLoading: boolean
  /** True during any in-flight fetch (initial, fetchNextPage, refetch). */
  readonly isFetching: boolean
  /** True when deps changed but the new query has not finished yet. */
  readonly isStale: boolean
  readonly isError: boolean
  readonly error: Error | null
  /** False once the iterator is exhausted (lookahead-accurate). */
  readonly hasNextPage: boolean
  /**
   * Pull and append the next page. No-op when `hasNextPage === false`.
   * Concurrent calls serialize into a queue so each pull loads a sequential
   * page. Returns a Promise so consumers can drive `useTransition`:
   * `startTransition(async () => { await result.fetchNextPage() })`.
   */
  readonly fetchNextPage: () => Promise<void>
  /**
   * Discard current results and re-run the query from scratch.
   * Same transition pattern as `fetchNextPage`.
   */
  readonly refetch: () => Promise<void>
}
