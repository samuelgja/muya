/* eslint-disable sonarjs/cognitive-complexity */
import { useCallback, useLayoutEffect, useReducer, useRef, type DependencyList } from 'react'
import type { SyncTable } from './create-sqlite'
import type { DocType, Key, SqlSeachOptions } from './table/table.types'
import { DEFAULT_PAGE_SIZE } from './table'

export interface SqLiteActions {
  /**
   * Load the next page of results and return if isDone to show more results.
   * @returns isDone: boolean
   */
  readonly nextPage: () => Promise<boolean>
  /**
   * Reset the pagination and load the first page of results.
   * @returns void
   */
  readonly reset: () => Promise<void>
}

export interface UseSearchOptions<Document extends DocType, Selected = Document> extends SqlSeachOptions<Document> {
  /**
   * Naive projection. Prefer specialized queries for heavy fan-out graphs.
   */
  readonly select?: (document: Document) => Selected
}

/**
 * A React hook to perform paginated searches on a SyncTable and reactively update the results.
 * It supports pagination, resetting the search, and selecting specific fields from the documents.
 * @param state The SyncTable instance to perform searches on.
 * @param options Options to customize the search behavior, including pagination size and selection function.
 * @param deps Dependency list to control when to re-run the search and reset the iterator.
 * @returns A tuple containing the current list of results and an object with actions to manage pagination and resetting.
 */
export function useSqliteValue<Document extends DocType, Selected = Document>(
  state: SyncTable<Document>,
  options: UseSearchOptions<Document, Selected> = {},
  deps: DependencyList = [],
): [(undefined extends Selected ? Document[] : Selected[]) | undefined, SqLiteActions] {
  const { select, pageSize = DEFAULT_PAGE_SIZE } = options

  // const [items, setItems] = useState<undefined | (Document | Selected)[]>()
  const itemsRef = useRef<undefined | (Document | Selected)[]>()
  const [, rerender] = useReducer((c: number) => c + 1, 0)
  const keysIndex = useRef(new Map<Key, number>())
  const iteratorRef = useRef<AsyncIterableIterator<{ doc: Document; meta: { key: Key } }>>()

  const updateIterator = useCallback(() => {
    // eslint-disable-next-line sonarjs/no-unused-vars
    const { select: _ignore, ...resetOptions } = options
    iteratorRef.current = state.search({ select: (doc, meta) => ({ doc, meta }), ...resetOptions })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, ...deps])

  const reset = useCallback(() => {
    itemsRef.current = []
    keysIndex.current.clear()
    updateIterator()
  }, [updateIterator])

  const fillNextPage = useCallback(async (shouldReset: boolean) => {
    if (shouldReset === true) {
      reset()
    }

    const { current: iterator } = iteratorRef
    if (!iterator) {
      return true
    }

    for (let index = 0; index < pageSize; index++) {
      const result = await iterator.next()
      result.value
      if (result.done) {
        iteratorRef.current = undefined
        break
      }
      if (!itemsRef.current) {
        itemsRef.current = []
      }
      if (keysIndex.current.has(result.value.meta.key)) {
        continue
      }
      itemsRef.current.push(select ? select(result.value.doc) : (result.value.doc as unknown as Selected))
      keysIndex.current.set(result.value.meta.key, itemsRef.current.length - 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nextPage = useCallback(async () => {
    const isDone = await fillNextPage(false)
    rerender()
    return isDone
  }, [fillNextPage])

  useLayoutEffect(() => {
    const unsubscribe = state.subscribe(async (item) => {
      const { mutations, removedAll } = item
      if (removedAll) {
        reset()
      }
      if (!mutations) {
        return
      }

      const oldLength = itemsRef.current?.length ?? 0
      let newLength = oldLength
      let hasUpdate = false
      for (const mutation of mutations) {
        const { key, op } = mutation
        switch (op) {
          case 'insert': {
            newLength += 1
            break
          }
          case 'delete': {
            if (itemsRef.current && keysIndex.current.has(key)) {
              const index = keysIndex.current.get(key)
              if (index === undefined) break
              itemsRef.current.splice(index, 1)
              keysIndex.current.delete(key)
              hasUpdate = true
            }
            break
          }
          case 'update': {
            if (itemsRef.current && keysIndex.current.has(key)) {
              const index = keysIndex.current.get(key)
              if (index === undefined) break
              itemsRef.current[index] = (await state.get(key, select)) as Selected
              hasUpdate = true
            }
            break
          }
        }
      }

      const isLengthChanged = oldLength !== newLength
      const isChanged = isLengthChanged || hasUpdate
      if (!isChanged) return
      if (isLengthChanged) {
        await fillNextPage(true)

        // here we ensure that if the length changed, we fill the next page
        while ((itemsRef.current?.length ?? 0) < newLength) {
          await fillNextPage(false)
        }
      }
      rerender()
    })
    return () => {
      unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  useLayoutEffect(() => {
    updateIterator()
    itemsRef.current = undefined
    keysIndex.current.clear()
    if (itemsRef.current === undefined) {
      nextPage()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const resetCb = useCallback(async () => {
    reset()
    await nextPage()
  }, [nextPage, reset])

  return [itemsRef.current, { nextPage, reset: resetCb }] as [
    (undefined extends Selected ? Document[] : Selected[]) | undefined,
    SqLiteActions,
  ]
}
