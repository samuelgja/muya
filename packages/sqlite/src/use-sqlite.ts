/* eslint-disable sonarjs/cognitive-complexity */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type DependencyList,
} from 'react'
import { shallow } from 'muya'
import { DEFAULT_PAGE_SIZE } from './table'
import type { DocType, Key } from './table/table.types'
import type { SyncTable, UseSearchOptions, UseSqliteResult } from './types'

export type { UseSearchOptions, UseSqliteResult } from './types'

// Items pulled from the iterator before yielding back to the macro-task queue.
// Only kicks in for large pageSize loads to avoid penalising the common case.
const ITERATOR_YIELD_EVERY = 256
const ITERATOR_YIELD_THRESHOLD = 256

interface YieldGlobals {
  readonly scheduler?: { readonly yield?: () => Promise<void> }
  readonly MessageChannel?: typeof MessageChannel
}

/**
 * Fast macro-task yield. Prefers `scheduler.yield()` (Chromium 129+),
 * then MessageChannel.postMessage (sub-ms), then setTimeout(0).
 * @returns A promise that resolves on the next macro-task tick
 */
function yieldToMain(): Promise<void> {
  const globals = globalThis as unknown as YieldGlobals
  if (typeof globals.scheduler?.yield === 'function') return globals.scheduler.yield()
  if (typeof globals.MessageChannel === 'function') {
    return new Promise((resolve) => {
      const channel = new globals.MessageChannel!()
      channel.port1.addEventListener('message', () => {
        channel.port1.close()
        resolve()
      })
      channel.port1.start()
      channel.port2.postMessage(null)
    })
  }
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * Shallow array compare via Object.is per element.
 * @param previous Previous deps array
 * @param next Next deps array
 * @returns True if both arrays match length and every element
 */
function shallowEqualDeps(previous: DependencyList, next: DependencyList): boolean {
  if (previous.length !== next.length) return false
  for (const [index, item] of previous.entries()) {
    if (!Object.is(item, next[index])) return false
  }
  return true
}

interface Snapshot<T> {
  readonly data: readonly T[] | null
  readonly status: 'pending' | 'error' | 'success'
  readonly error: Error | null
  readonly isFetching: boolean
  readonly hasNextPage: boolean
}

const INITIAL_SNAPSHOT: Snapshot<never> = {
  data: null,
  status: 'pending',
  error: null,
  isFetching: false,
  hasNextPage: true,
}

/**
 * Per-hook-instance external store backing `useSyncExternalStore`.
 * Holds an immutable Snapshot and notifies React on any change.
 */
class HookStore<T> {
  private readonly listeners = new Set<() => void>()
  snapshot: Snapshot<T> = INITIAL_SNAPSHOT as Snapshot<T>

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): Snapshot<T> => this.snapshot

  /**
   * Merge a partial change into the snapshot and notify subscribers
   * only if at least one field actually changed (preserves snapshot
   * identity for `useSyncExternalStore`).
   * @param partial Partial snapshot to merge
   */
  set(partial: Partial<Snapshot<T>>): void {
    let changed = false
    for (const key of Object.keys(partial) as Array<keyof Snapshot<T>>) {
      if (this.snapshot[key] !== partial[key]) {
        changed = true
        break
      }
    }
    if (!changed) return
    this.snapshot = { ...this.snapshot, ...partial }
    for (const listener of this.listeners) listener()
  }
}

interface IteratorEntry<Document> {
  doc: Document
  meta: { key: Key }
}

/**
 * Reactive paginated SQLite query. Returns a TanStack-style result object
 * with explicit loading/fetching/stale/error flags. Subscribes to the
 * underlying SyncTable so visible rows stay in sync with mutations.
 *
 * Internally backed by `useSyncExternalStore` for concurrent-mode safety,
 * with epoch-based cancellation that aborts stale iterators on deps change.
 * @param state The SyncTable instance to query
 * @param options Search options (where, sortBy, pageSize, select, ...)
 * @param deps Dependency array - changing any element re-runs the query
 * @returns A snapshot result with data, status flags, and pagination actions
 */
export function useSqliteValue<Document extends DocType, Selected = Document>(
  state: SyncTable<Document>,
  options: UseSearchOptions<Document, Selected> = {},
  deps: DependencyList = [],
): UseSqliteResult<undefined extends Selected ? Document : Selected> {
  type Out = undefined extends Selected ? Document : Selected

  // Lazy per-instance store.
  const storeRef = useRef<HookStore<Out> | null>(null)
  if (storeRef.current === null) storeRef.current = new HookStore<Out>()
  const store = storeRef.current

  // Latest-options ref so async work always reads current select / pageSize
  // without re-creating the iterator (fixes the prior stale-closure bug).
  const latestOptions = useRef(options)
  latestOptions.current = options

  // Internal mutable buckets - never read by render code, only by effects.
  const itemsRef = useRef<Out[]>([])
  const keysIndexRef = useRef(new Map<Key, number>())
  const iteratorRef = useRef<AsyncIterator<IteratorEntry<Document>> | null>(null)
  // One-item lookahead so `hasNextPage` is accurate without an extra empty
  // fetch round-trip. Cleared on iterator reset.
  const lookaheadRef = useRef<IteratorEntry<Document> | null>(null)
  // Serialization queue: concurrent fetchNextPage calls chain so each pull
  // sees a consistent iterator + lookahead state (no torn shared access).
  const fetchQueueRef = useRef<Promise<void>>(Promise.resolve())
  const epochRef = useRef(0)
  const settledDepsRef = useRef<DependencyList | null>(null)

  /**
   * Cancel and release any in-flight iterator. Safe to call multiple times.
   */
  const closeIterator = useCallback(async (): Promise<void> => {
    const iterator = iteratorRef.current
    iteratorRef.current = null
    lookaheadRef.current = null
    if (iterator?.return) {
      try {
        await iterator.return()
      } catch {
        // Iterator close errors are not actionable.
      }
    }
  }, [])

  /**
   * Start a fresh iterator using the latest options.
   */
  const openIterator = useCallback((): void => {
    // eslint-disable-next-line sonarjs/no-unused-vars
    const { select: _ignore, ...rest } = latestOptions.current
    iteratorRef.current = state.search<IteratorEntry<Document>>({
      ...rest,
      select: (doc, meta) => ({ doc, meta }),
    }) as AsyncIterator<IteratorEntry<Document>>
  }, [state])

  /**
   * Drain `pageSize` items (or until exhausted) into itemsRef.
   * Yields to the macro-task queue periodically when pageSize is large
   * so the browser can paint and process input.
   * Aborts cleanly if the epoch advances mid-pull.
   * @param epoch Epoch token captured at the start of the pull
   * @returns done (iterator exhausted) and aborted (epoch advanced)
   */
  const pullPage = useCallback(async (epoch: number): Promise<{ done: boolean; aborted: boolean }> => {
    const iterator = iteratorRef.current
    if (!iterator) return { done: true, aborted: false }

    const currentOptions = latestOptions.current
    const pageSize = currentOptions.pageSize ?? DEFAULT_PAGE_SIZE
    const { select } = currentOptions
    const shouldYield = pageSize > ITERATOR_YIELD_THRESHOLD

    /**
     * Append a (doc, key) pair to itemsRef if the key isn't already visible.
     * @param entry Iterator entry to push
     */
    const push = (entry: IteratorEntry<Document>): void => {
      const { key } = entry.meta
      if (keysIndexRef.current.has(key)) return
      const item = select ? (select(entry.doc) as Out) : (entry.doc as unknown as Out)
      itemsRef.current.push(item)
      keysIndexRef.current.set(key, itemsRef.current.length - 1)
    }

    let done = false
    let pulled = 0

    // Drain a buffered lookahead (one row peeked at the end of the prior page).
    if (lookaheadRef.current) {
      push(lookaheadRef.current)
      lookaheadRef.current = null
      pulled++
    }

    while (pulled < pageSize) {
      if (shouldYield && pulled > 0 && pulled % ITERATOR_YIELD_EVERY === 0) {
        await yieldToMain()
        if (epochRef.current !== epoch) return { done: false, aborted: true }
      }
      const result = await iterator.next()
      if (epochRef.current !== epoch) return { done: false, aborted: true }
      if (result.done) {
        iteratorRef.current = null
        done = true
        break
      }
      if (keysIndexRef.current.has(result.value.meta.key)) continue
      push(result.value)
      pulled++
    }

    // Lookahead probe: if we filled the page, peek one more so the next
    // hasNextPage flag is accurate without forcing an extra empty fetch.
    if (!done && pulled === pageSize) {
      const probe = await iterator.next()
      if (epochRef.current !== epoch) return { done: false, aborted: true }
      if (probe.done) {
        iteratorRef.current = null
        done = true
      } else {
        lookaheadRef.current = probe.value
      }
    }

    return { done, aborted: false }
  }, [])

  /**
   * Reset all internal state and load the first page for a given deps snapshot.
   * @param epoch Epoch token captured at the start of the load
   * @param currentDeps Deps captured at the start; settled only if still active
   */
  const loadInitial = useCallback(
    async (epoch: number, currentDeps: DependencyList): Promise<void> => {
      await closeIterator()
      if (epochRef.current !== epoch) return

      itemsRef.current = []
      keysIndexRef.current = new Map()
      openIterator()

      store.set({ isFetching: true, error: null })

      try {
        const { aborted, done } = await pullPage(epoch)
        if (aborted) return
        settledDepsRef.current = currentDeps
        store.set({
          data: [...itemsRef.current],
          status: 'success',
          isFetching: false,
          hasNextPage: !done,
          error: null,
        })
      } catch (error_) {
        if (epochRef.current !== epoch) return
        store.set({
          status: 'error',
          error: error_ instanceof Error ? error_ : new Error(String(error_)),
          isFetching: false,
        })
      }
    },
    [closeIterator, openIterator, pullPage, store],
  )

  const fetchNextPage = useCallback((): Promise<void> => {
    // Chain onto the queue so concurrent callers load sequential pages
    // rather than racing over shared iterator / lookahead state.
    const work = fetchQueueRef.current.then(async () => {
      if (!iteratorRef.current) return // iterator not yet started or already exhausted
      const epoch = epochRef.current
      store.set({ isFetching: true })
      try {
        const { aborted, done } = await pullPage(epoch)
        if (aborted) return
        store.set({
          data: [...itemsRef.current],
          isFetching: false,
          hasNextPage: !done,
        })
      } catch (error_) {
        if (epochRef.current !== epoch) return
        store.set({
          status: 'error',
          error: error_ instanceof Error ? error_ : new Error(String(error_)),
          isFetching: false,
        })
      }
    })
    // Swallow queue-internal rejections so a single failed pull doesn't
    // poison every subsequent fetchNextPage call.
    fetchQueueRef.current = work.catch(() => {})
    return work
  }, [pullPage, store])

  const refetch = useCallback(async (): Promise<void> => {
    const epoch = ++epochRef.current
    await loadInitial(epoch, deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadInitial, ...deps])

  // Subscribe to mutations. useLayoutEffect so we never miss events between
  // commit and paint. The handler keeps the visible window in sync.
  useLayoutEffect(() => {
    const unsubscribe = state.subscribe(async (mutationItem) => {
      const { mutations, removedAll } = mutationItem
      const epoch = epochRef.current

      if (removedAll) {
        const newEpoch = ++epochRef.current
        await loadInitial(newEpoch, settledDepsRef.current ?? [])
        return
      }
      if (!mutations) return

      const { select } = latestOptions.current
      const oldLength = itemsRef.current.length
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
            if (oldLength > 0 && keysIndexRef.current.has(key)) {
              const index = keysIndexRef.current.get(key)
              if (index === undefined) break
              removeIndexes.add(index)
              hasUpdate = true
            }
            break
          }
          case 'update': {
            if (keysIndexRef.current.has(key)) {
              const index = keysIndexRef.current.get(key)
              if (index === undefined) break
              const newItem = select ? (select(document as Document) as Out) : (document as unknown as Out)
              const previousItem = itemsRef.current[index]
              if (!shallow(previousItem, newItem)) {
                itemsRef.current[index] = newItem
                hasUpdate = true
              }
            } else {
              const fetched = await state.get<Out>(key, select as ((d: Document) => Out) | undefined)
              if (epochRef.current !== epoch) return
              if (fetched) {
                itemsRef.current.push(fetched)
                keysIndexRef.current.set(key, itemsRef.current.length - 1)
                hasUpdate = true
              }
            }
            break
          }
        }
      }

      if (removeIndexes.size > 0) {
        itemsRef.current = itemsRef.current.filter((_, index) => !removeIndexes.has(index))
        const rebuilt = new Map<Key, number>()
        let nextIdx = 0
        for (const [key, index] of keysIndexRef.current) {
          if (removeIndexes.has(index)) continue
          rebuilt.set(key, nextIdx++)
        }
        keysIndexRef.current = rebuilt
      }

      const isLengthChanged = oldLength !== newLength
      if (!isLengthChanged && !hasUpdate) return

      if (isLengthChanged) {
        // Insert path: rebuild the visible window by re-pulling from offset 0.
        // This is O(visible_set) per insert - acceptable for small windows,
        // documented limitation for large ones (use virtualization).
        const refillEpoch = ++epochRef.current
        await closeIterator()
        if (epochRef.current !== refillEpoch) return
        itemsRef.current = []
        keysIndexRef.current = new Map()
        openIterator()
        let totalDone = false
        while (itemsRef.current.length < newLength && !totalDone) {
          const { aborted, done } = await pullPage(refillEpoch)
          if (aborted) return
          totalDone = done
        }
        store.set({
          data: [...itemsRef.current],
          hasNextPage: !totalDone,
        })
      } else {
        store.set({ data: [...itemsRef.current] })
      }
    })
    return () => {
      unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, loadInitial])

  // Deps-driven (re)load. useEffect (not useLayoutEffect) lets the browser
  // paint the placeholder before the load starts.
  useEffect(() => {
    const epoch = ++epochRef.current
    void loadInitial(epoch, deps)
    const cancelEpoch = epochRef
    return () => {
      // Cancel any in-flight pull and release the iterator.
      cancelEpoch.current++
      void closeIterator()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)

  // Stale = deps drifted from what was last successfully settled.
  const isStale = settledDepsRef.current === null || !shallowEqualDeps(settledDepsRef.current, deps)

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
      fetchNextPage,
      refetch,
    }),
    [snapshot, isStale, fetchNextPage, refetch],
  )
}
