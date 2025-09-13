/* eslint-disable sonarjs/cognitive-complexity */
import { useCallback, useLayoutEffect, useReducer, useRef, type DependencyList } from 'react'
import type { SyncTable } from './create-sqlite'
import type { DocType, Key, SqlSeachOptions } from './table/table.types'
import { DEFAULT_PAGE_SIZE } from './table'
const MAX_ITERATIONS = 10_000

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
  readonly keysIndex: Map<Key, number>
  readonly isResetting?: boolean
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
    if (itemsRef.current === undefined) {
      itemsRef.current = []
    }
    if (shouldReset === true) {
      reset()
    }

    const { current: iterator } = iteratorRef
    if (!iterator) {
      return true
    }
    let isDone = false

    for (let index = 0; index < pageSize; index++) {
      const result = await iterator.next()
      if (result.done) {
        iteratorRef.current = undefined
        isDone = true
        break
      }
      if (keysIndex.current.has(result.value.meta.key)) {
        // eslint-disable-next-line sonarjs/updated-loop-counter
        index += -1
        continue
      }
      itemsRef.current.push(select ? select(result.value.doc) : (result.value.doc as unknown as Selected))
      keysIndex.current.set(result.value.meta.key, itemsRef.current.length - 1)
    }
    itemsRef.current = [...itemsRef.current]
    return isDone
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
      const removeIndexes = new Set<number>()
      for (const mutation of mutations) {
        const { key, op } = mutation
        switch (op) {
          case 'insert': {
            newLength += 1
            break
          }
          case 'delete': {
            if (itemsRef.current && itemsRef.current.length > 0 && keysIndex.current.has(key)) {
              const index = keysIndex.current.get(key)
              if (index === undefined) break
              removeIndexes.add(index)
              hasUpdate = true
            }
            break
          }
          case 'update': {
            if (keysIndex.current.has(key)) {
              const index = keysIndex.current.get(key)
              if (index !== undefined && itemsRef.current) {
                itemsRef.current[index] = (await state.get(key, select)) as Selected
                itemsRef.current = [...itemsRef.current]
                hasUpdate = true
              }
            } else {
              // Handle updates to non-visible items
              const updatedItem = await state.get(key, select)
              if (updatedItem) {
                itemsRef.current = [...(itemsRef.current ?? []), updatedItem]
                keysIndex.current.set(key, itemsRef.current.length - 1)
                hasUpdate = true
              }
            }
            break
          }
        }
      }

      if (removeIndexes.size > 0 && itemsRef.current && itemsRef.current.length > 0) {
        const newIndex = new Map<Key, number>()
        itemsRef.current = itemsRef.current?.filter((_, index) => {
          return !removeIndexes.has(index)
        })
        let newIdx = 0
        for (const [key, index] of keysIndex.current) {
          if (removeIndexes.has(index)) {
            continue
          }
          newIndex.set(key, newIdx)
          newIdx++
        }
        keysIndex.current = newIndex
      }

      const isLengthChanged = oldLength !== newLength
      const isChanged = isLengthChanged || hasUpdate
      if (!isChanged) return
      if (isLengthChanged) {
        await fillNextPage(true)
        let iterations = 0
        while ((itemsRef.current?.length ?? 0) < newLength && iterations < MAX_ITERATIONS) {
          await fillNextPage(false)
          iterations++
        }
        if (iterations === MAX_ITERATIONS) {
          // Optionally log a warning to help with debugging
          // eslint-disable-next-line no-console
          console.warn('Reached maximum iterations in fillNextPage loop. Possible duplicate or data issue.')
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
    reset()
    nextPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const resetCb = useCallback(async () => {
    reset()
    await nextPage()
  }, [nextPage, reset])

  return [itemsRef.current, { nextPage, reset: resetCb, keysIndex: keysIndex.current }] as [
    (undefined extends Selected ? Document[] : Selected[]) | undefined,
    SqLiteActions,
  ]
}
