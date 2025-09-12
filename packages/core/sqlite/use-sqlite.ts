import { useCallback, useDebugValue, useEffect, useId, useLayoutEffect, useMemo, type DependencyList } from 'react'
import type { SyncTable } from './create-sqlite'
import type { DocType } from './table/table.types'
import { isError, isPromise } from '../utils/is'
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector'
import type { SqlSeachOptions } from './select-sql'

export interface SqLiteActions {
  readonly next: () => Promise<boolean>
  readonly reset: () => Promise<void>
}

export interface UseSearchOptions<Document extends DocType, Selected = Document> extends SqlSeachOptions<Document> {
  /**
   * Naive projection. Prefer specialized queries for heavy fan-out graphs.
   */
  readonly select?: (document: Document) => Selected
}

/**
 * Generate a cache key based on the search options to uniquely identify the query
 * @param options The search options to generate the key from
 * @returns A string representing the unique cache key for the given search options
 */
function generateCacheKey(options: UseSearchOptions<DocType, unknown>): string {
  const { limit, offset, order, sortBy, where, stepSize, select } = options
  let key = ''
  if (limit !== undefined) {
    key += `l${limit}`
  }
  if (offset !== undefined) {
    key += `o${offset}`
  }
  if (order !== undefined) {
    key += `r${order}`
  }
  if (sortBy !== undefined) {
    key += `s${sortBy}`
  }
  if (where !== undefined) {
    key += `w${JSON.stringify(where)}`
  }
  if (stepSize !== undefined) {
    key += `t${stepSize}`
  }
  if (select !== undefined) {
    key += `f${select.toString()}`
  }
  return key
}

/**
 * React hook to subscribe to a SyncTable and get its current snapshot, with optional search options and selector for derived state
 * @param state The SyncTable to subscribe to
 * @param options Optional search options to filter and sort the documents
 * @param deps Dependency list to control when to update the search options
 * @returns A tuple containing the current array of documents (or selected documents) and an object with actions to interact with the SyncTable
 * @throws If the value is a Promise or an Error, it will be thrown to be handled by an error boundary or suspense
 */
export function useSqliteValue<Document extends DocType, Selected = Document>(
  state: SyncTable<Document>,
  options: UseSearchOptions<Document, Selected> = {},
  deps: DependencyList = [],
): [undefined extends Selected ? Document[] : Selected[], SqLiteActions] {
  const { select } = options

  const searchId = useMemo(() => generateCacheKey({ ...options, select: undefined }), [options])
  const componentId = useId()

  useLayoutEffect(() => {
    state.updateSearchOptions(searchId, { ...options, select: undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    return () => {
      state.clear(searchId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selector = useCallback(
    (documents: Document[]) => {
      // eslint-disable-next-line unicorn/no-array-callback-reference
      return select ? documents.map(select) : (documents as unknown as Selected[])
    },
    [select],
  )

  const subscribe = useCallback(
    (onStorageChange: () => void) => {
      return state.subscribe(searchId, componentId, onStorageChange)
    },
    [state, searchId, componentId],
  )

  const getSnapshot = useCallback(() => {
    return state.getSnapshot(searchId)
  }, [state, searchId])

  const value = useSyncExternalStoreWithSelector<Document[], Selected[]>(subscribe, getSnapshot, getSnapshot, selector)

  useDebugValue(value)
  if (isPromise(value)) {
    throw value
  }
  if (isError(value)) {
    throw value
  }

  const actions = useMemo((): SqLiteActions => {
    return {
      next: () => state.next(searchId),
      reset: () => state.refresh(searchId),
    }
  }, [searchId, state])
  return [value as undefined extends Selected ? Document[] : Selected[], actions]
}
