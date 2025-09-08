import { useCallback, useDebugValue, useId, useLayoutEffect, useMemo, type DependencyList } from 'react'
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

export function useSqliteValue<Document extends DocType, Selected = Document>(
  state: SyncTable<Document>,
  options: UseSearchOptions<Document, Selected> = {},
  deps: DependencyList = [],
): [undefined extends Selected ? Document[] : Selected[], SqLiteActions] {
  const { select } = options

  const id = useId()

  useLayoutEffect(() => {
    state.updateSearchOptions(id, { ...options, select: undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const selector = useCallback(
    (documents: Document[]) => {
      // eslint-disable-next-line unicorn/no-array-callback-reference
      return select ? documents.map(select) : (documents as unknown as Selected[])
    },
    [select],
  )

  const subscribe = useCallback(
    (onStorageChange: () => void) => {
      return state.subscribe(id, onStorageChange)
    },
    [state, id],
  )

  const getSnapshot = useCallback(() => {
    return state.getSnapshot(id)
  }, [state, id])

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
      next: () => state.next(id),
      reset: () => state.refresh(id),
    }
  }, [id, state])
  return [value as undefined extends Selected ? Document[] : Selected[], actions]
}
