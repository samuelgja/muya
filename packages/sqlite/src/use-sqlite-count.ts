import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, type DependencyList } from 'react'
import type { SyncTable } from './create-sqlite'
import type { DocType } from './table/table.types'
import type { Where } from './table/where'

/**
 * A React hook to count the number of items in a SyncTable reactively.
 * It updates the count when items are inserted or deleted, but ignores updates.
 * Supports filtering the count using a `where` clause.
 * @param state The SyncTable instance to observe.
 * @param options Optional filtering options.
 * @param options.where A `where` clause to filter the count.
 * @param deps Dependency list to control when to re-run the effect.
 * @returns The current count of items in the table.
 */
export function useSqliteCount<Document extends DocType>(
  state: SyncTable<Document>,
  options: { where?: Where<Document> } = {},
  deps: DependencyList = [],
): number {
  const countRef = useRef(0)
  const [, rerender] = useReducer((c: number) => c + 1, 0)

  const updateCount = useCallback(async () => {
    const newCount = await state.count(options)
    countRef.current = newCount
    rerender()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    updateCount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useLayoutEffect(() => {
    const unsubscribe = state.subscribe((item) => {
      const { mutations, removedAll } = item
      if (removedAll) {
        countRef.current = 0
        rerender()
        return
      }
      if (!mutations) {
        return
      }

      let shouldUpdate = false
      for (const mutation of mutations) {
        const { op } = mutation
        if (op === 'insert' || op === 'delete') {
          shouldUpdate = true
          break
        }
      }

      if (shouldUpdate) {
        updateCount()
      }
    })

    return () => {
      unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return countRef.current
}
