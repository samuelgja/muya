/* eslint-disable sonarjs/cognitive-complexity */
import { useCallback, useLayoutEffect, useReducer, useRef, useState, type DependencyList } from 'react'
import type { SyncTable } from './create-sqlite'
import type { DocType, Key, SqlSeachOptions } from './table/table.types'
import { DEFAULT_PAGE_SIZE } from './table'
import { shallow } from '../utils/shallow'
const MAX_ITERATIONS = 10_000

/**
 * Shallow compare two dependency arrays
 * @param previousDeps Previous deps array
 * @param nextDeps Next deps array
 * @returns True if arrays have same length and all items are strictly equal
 */
function shallowEqualDeps(previousDeps: DependencyList, nextDeps: DependencyList): boolean {
  if (previousDeps.length !== nextDeps.length) return false
  for (const [index, previousDep] of previousDeps.entries()) {
    if (!Object.is(previousDep, nextDeps[index])) return false
  }
  return true
}

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
  /**
   * Map of document keys to their index in the results array.
   */
  readonly keysIndex: Map<Key, number>
  /**
   * True when deps changed but fresh data hasn't loaded yet.
   * Use this to show stale/dimmed UI while new results are loading.
   */
  readonly isStale: boolean
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
): [(undefined extends Selected ? Document[] : Selected[]) | null, SqLiteActions] {
  const { select, pageSize = DEFAULT_PAGE_SIZE } = options

  const itemsRef = useRef<null | (Document | Selected)[]>(null)
  const [, rerender] = useReducer((c: number) => c + 1, 0)
  const keysIndex = useRef(new Map<Key, number>())
  const iteratorRef = useRef<AsyncIterableIterator<{ doc: Document; meta: { key: Key } }> | null>(null)

  // Track "settled" deps - the deps value when data last finished loading
  // isStale is derived: true when current deps differ from settled deps
  const [settledDeps, setSettledDeps] = useState<DependencyList | null>(null)
  const isStale = settledDeps === null || !shallowEqualDeps(settledDeps, deps)

  const updateIterator = useCallback(() => {
    // eslint-disable-next-line sonarjs/no-unused-vars
    const { select: _ignore, ...resetOptions } = options
    iteratorRef.current = state.search({ select: (doc, meta) => ({ doc, meta }), ...resetOptions })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, ...deps])

  const resetDataAndUpdateIterator = useCallback(() => {
    itemsRef.current = []
    keysIndex.current.clear()
    updateIterator()
  }, [updateIterator])

  const fillNextPage = useCallback(async (shouldReset: boolean) => {
    if (itemsRef.current === null) {
      itemsRef.current = []
    }
    if (shouldReset === true) {
      resetDataAndUpdateIterator()
    }

    const { current: iterator } = iteratorRef
    if (!iterator) {
      return true
    }
    let isDone = false

    for (let index = 0; index < pageSize; index++) {
      const result = await iterator.next()
      if (result.done) {
        iteratorRef.current = null
        isDone = true
        break
      }
      if (keysIndex.current.has(result.value.meta.key)) {
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
        resetDataAndUpdateIterator()
      }
      if (!mutations) {
        return
      }

      const oldLength = itemsRef.current?.length ?? 0
      let newLength = oldLength
      let hasUpdate = false
      const removeIndexes = new Set<number>()
      for (const mutation of mutations) {
        const { key, op, document } = mutation
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
                const newItem = select ? select(document as Document) : (document as unknown as Selected)
                const previousItem = itemsRef.current[index]

                // 🆕 Only update & rerender if shallow comparison fails
                if (!shallow(previousItem, newItem)) {
                  itemsRef.current[index] = newItem
                  itemsRef.current = [...itemsRef.current]
                  hasUpdate = true
                }
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
    // Capture current deps for this effect invocation
    const currentDeps = deps
    resetDataAndUpdateIterator()
    nextPage().then(() => {
      // Mark these deps as settled when data finishes loading
      setSettledDeps(currentDeps)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const resetCb = useCallback(async () => {
    // Set settledDeps to null to make isStale=true during reset
    setSettledDeps(null)
    resetDataAndUpdateIterator()
    await nextPage()
    // After data loads, mark current deps as settled
    setSettledDeps(deps)
  }, [nextPage, resetDataAndUpdateIterator, deps])

  return [itemsRef.current, { nextPage, reset: resetCb, keysIndex: keysIndex.current, isStale }] as [
    (undefined extends Selected ? Document[] : Selected[]) | null,
    SqLiteActions,
  ]
}
