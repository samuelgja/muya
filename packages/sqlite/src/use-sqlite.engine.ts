/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable sonarjs/cognitive-complexity */
import { shallow } from 'muya'
import { DEFAULT_PAGE_SIZE, type Where } from './table'
import type { DocType, Key } from './table/table.types'
import type { MutationItems, SyncTable, UseSearchOptions } from './types'

const ITERATOR_YIELD_EVERY = 256
const ITERATOR_YIELD_THRESHOLD = 256
const DEFAULT_GC_TIME = 5 * 60_000
const DEFAULT_MAX_ENTRIES_PER_TABLE = 100

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

export interface Snapshot<T> {
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

interface IteratorEntry<Document> {
  doc: Document
  meta: { key: Key }
}

/**
 * Engine for a single (state × cacheKey × deps) query. Owns the iterator,
 * the items buffer, the React-facing snapshot, and the subscription to
 * the underlying SyncTable. Shared across multiple hook mounts via
 * retain/release refcounting.
 */
export class QueryEngine<Document extends DocType, Out> {
  private readonly listeners = new Set<() => void>()
  private snapshotValue: Snapshot<Out> = INITIAL_SNAPSHOT as Snapshot<Out>

  private items: Out[] = []
  private keysIndex = new Map<Key, number>()
  private iterator: AsyncIterator<IteratorEntry<Document>> | null = null
  private lookahead: IteratorEntry<Document> | null = null
  private fetchQueue: Promise<void> = Promise.resolve()
  // Mutation handlers serialize through this queue so back-to-back
  // mutations cannot race over the refill loop's shared state.
  private mutationQueue: Promise<void> = Promise.resolve()
  private epoch = 0

  private refCount = 0
  private gcTimer: ReturnType<typeof setTimeout> | null = null
  private unsubscribe: (() => void) | null = null
  private disposed = false

  private currentOptions: UseSearchOptions<Document, Out>

  constructor(
    private readonly state: SyncTable<Document>,
    options: UseSearchOptions<Document, Out>,
    private readonly cacheBucket: Map<string, CachedDisposable> | null,
    readonly cacheKey: string | null,
  ) {
    this.currentOptions = options
  }

  /**
   * External-store subscribe for `useSyncExternalStore`.
   * @param listener Callback invoked when the snapshot reference changes
   * @returns Unsubscribe function
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * External-store snapshot getter. Same reference until something changes.
   * @returns The current immutable snapshot
   */
  getSnapshot = (): Snapshot<Out> => this.snapshotValue

  /**
   * Replace per-render options without touching iterator state. Async work
   * (pullPage, mutation handler) reads from this so the latest select /
   * pageSize wins even when the engine was created earlier.
   * @param options Latest options from the consumer
   */
  updateOptions(options: UseSearchOptions<Document, Out>): void {
    this.currentOptions = options
  }

  /** Subscribe to the table and kick off the first load. */
  start(): void {
    if (this.unsubscribe || this.disposed) return
    this.unsubscribe = this.state.subscribe((mutation) => {
      // Chain onto the mutation queue so concurrent mutation events process
      // sequentially - prevents stale `oldLength` reads when a refill is mid-flight.
      const work = this.mutationQueue.then(() => this.handleMutation(mutation))
      this.mutationQueue = work.catch(() => {})
    })
    // Publish `isFetching: true` synchronously so consumers see the pending
    // state in the same render that triggered start() (matters for sync act()).
    this.setSnapshot({ isFetching: true, error: null })
    void this.loadInitial(++this.epoch)
  }

  /** Increment refcount for a new mounted consumer; cancels any pending GC. */
  retain(): void {
    this.refCount++
    if (this.gcTimer) {
      clearTimeout(this.gcTimer)
      this.gcTimer = null
    }
  }

  /**
   * Decrement refcount. When the last consumer leaves, schedule disposal
   * after `gcTime` ms. `gcTime: Infinity` keeps the engine alive until
   * manually cleared. `gcTime: 0` disposes immediately.
   * @param gcTime Idle ms before tearing down. Defaults to 5 minutes.
   */
  release(gcTime: number = DEFAULT_GC_TIME): void {
    this.refCount = Math.max(0, this.refCount - 1)
    if (this.refCount > 0) return
    // Uncached engines have no cache to live in - dispose immediately.
    if (this.cacheKey === null) {
      this.dispose()
      return
    }
    if (gcTime === Number.POSITIVE_INFINITY) return
    if (gcTime <= 0) {
      this.dispose()
      return
    }
    this.gcTimer = setTimeout(() => this.dispose(), gcTime)
  }

  /** Tear down: drop the iterator, unsubscribe, remove from cache. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.gcTimer) {
      clearTimeout(this.gcTimer)
      this.gcTimer = null
    }
    this.unsubscribe?.()
    this.unsubscribe = null
    void this.closeIterator()
    if (this.cacheBucket && this.cacheKey) {
      this.cacheBucket.delete(this.cacheKey)
    }
    allEngines.delete(this)
    this.listeners.clear()
  }

  /**
   * Pull and append the next page. Concurrent calls serialize into a queue
   * so each pull sees consistent iterator + lookahead state.
   * @returns Promise resolving when this caller's page is loaded
   */
  fetchNextPage(): Promise<void> {
    if (this.disposed) return this.fetchQueue
    // Publish synchronously so `isFetching` flips true in the same render
    // that called fetchNextPage (matters for sync act()).
    this.setSnapshot({ isFetching: true })
    const work = this.fetchQueue.then(async () => {
      if (!this.iterator || this.disposed) return
      const { epoch } = this
      try {
        const { aborted, done } = await this.pullPage(epoch)
        if (aborted) return
        this.setSnapshot({
          data: [...this.items],
          isFetching: false,
          hasNextPage: !done,
        })
      } catch (error_) {
        if (this.epoch !== epoch || this.disposed) return
        this.setSnapshot({
          status: 'error',
          error: this.normaliseError(error_),
          isFetching: false,
        })
      }
    })
    this.fetchQueue = work.catch(() => {})
    return work
  }

  /**
   * Discard current results and re-run the query from scratch.
   * Publishes `isFetching: true` synchronously so React renders the pending
   * state in the same tick the consumer triggered the refetch.
   * @returns Promise resolving when the new initial page is loaded
   */
  refetch(): Promise<void> {
    if (this.disposed) return Promise.resolve()
    this.setSnapshot({ isFetching: true, error: null })
    return this.loadInitial(++this.epoch)
  }

  // ---- Internals ----

  private setSnapshot(partial: Partial<Snapshot<Out>>): void {
    let changed = false
    for (const key of Object.keys(partial) as Array<keyof Snapshot<Out>>) {
      if (this.snapshotValue[key] !== partial[key]) {
        changed = true
        break
      }
    }
    if (!changed) return
    this.snapshotValue = { ...this.snapshotValue, ...partial }
    for (const listener of this.listeners) listener()
  }

  private normaliseError(value: unknown): Error {
    return value instanceof Error ? value : new Error(String(value))
  }

  private async closeIterator(): Promise<void> {
    const { iterator } = this
    this.iterator = null
    this.lookahead = null
    const returnFunction = iterator?.return
    if (returnFunction) {
      try {
        await returnFunction.call(iterator)
      } catch {
        // Iterator close errors are not actionable.
      }
    }
  }

  private openIterator(): void {
    // eslint-disable-next-line sonarjs/no-unused-vars
    const { select: _ignore, cacheKey: _ck, gcTime: _gc, ...rest } = this.currentOptions
    this.iterator = this.state.search<IteratorEntry<Document>>({
      ...rest,
      select: (doc, meta) => ({ doc, meta }),
    }) as AsyncIterator<IteratorEntry<Document>>
  }

  private push(entry: IteratorEntry<Document>): void {
    const { key } = entry.meta
    if (this.keysIndex.has(key)) return
    const { select } = this.currentOptions
    const item = select ? (select(entry.doc) as Out) : (entry.doc as unknown as Out)
    this.items.push(item)
    this.keysIndex.set(key, this.items.length - 1)
  }

  private async pullPage(epoch: number): Promise<{ done: boolean; aborted: boolean }> {
    const { iterator } = this
    if (!iterator) return { done: true, aborted: false }

    const pageSize = this.currentOptions.pageSize ?? DEFAULT_PAGE_SIZE
    const shouldYield = pageSize > ITERATOR_YIELD_THRESHOLD

    let done = false
    let pulled = 0

    if (this.lookahead) {
      this.push(this.lookahead)
      this.lookahead = null
      pulled++
    }

    while (pulled < pageSize) {
      if (shouldYield && pulled > 0 && pulled % ITERATOR_YIELD_EVERY === 0) {
        await yieldToMain()
        if (this.epoch !== epoch || this.disposed) return { done: false, aborted: true }
      }
      const result = await iterator.next()
      if (this.epoch !== epoch || this.disposed) return { done: false, aborted: true }
      if (result.done) {
        this.iterator = null
        done = true
        break
      }
      if (this.keysIndex.has(result.value.meta.key)) continue
      this.push(result.value)
      pulled++
    }

    if (!done && pulled === pageSize) {
      const probe = await iterator.next()
      if (this.epoch !== epoch || this.disposed) return { done: false, aborted: true }
      if (probe.done) {
        this.iterator = null
        done = true
      } else {
        this.lookahead = probe.value
      }
    }

    return { done, aborted: false }
  }

  private async loadInitial(epoch: number): Promise<void> {
    await this.closeIterator()
    if (this.epoch !== epoch || this.disposed) return

    this.items = []
    this.keysIndex = new Map()
    this.openIterator()

    this.setSnapshot({ isFetching: true, error: null })

    try {
      const { aborted, done } = await this.pullPage(epoch)
      if (aborted) return
      this.setSnapshot({
        data: [...this.items],
        status: 'success',
        isFetching: false,
        hasNextPage: !done,
        error: null,
      })
    } catch (error_) {
      if (this.epoch !== epoch || this.disposed) return
      this.setSnapshot({
        status: 'error',
        error: this.normaliseError(error_),
        isFetching: false,
      })
    }
  }

  private async handleMutation(item: MutationItems<Document>): Promise<void> {
    if (this.disposed) return
    const { mutations, removedAll } = item
    const { epoch } = this

    if (removedAll) {
      await this.loadInitial(++this.epoch)
      return
    }
    if (!mutations) return

    const { select } = this.currentOptions
    const oldLength = this.items.length
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
          if (oldLength > 0 && this.keysIndex.has(key)) {
            const index = this.keysIndex.get(key)
            if (index === undefined) break
            removeIndexes.add(index)
            hasUpdate = true
          }
          break
        }
        case 'update': {
          if (this.keysIndex.has(key)) {
            const index = this.keysIndex.get(key)
            if (index === undefined) break
            const newItem = select ? (select(document as Document) as Out) : (document as unknown as Out)
            const previousItem = this.items[index]
            if (!shallow(previousItem, newItem)) {
              this.items[index] = newItem
              hasUpdate = true
            }
          } else {
            const fetched = await this.state.get<Out>(key, select as ((d: Document) => Out) | undefined)
            if (this.epoch !== epoch || this.disposed) return
            if (fetched) {
              this.items.push(fetched)
              this.keysIndex.set(key, this.items.length - 1)
              hasUpdate = true
            }
          }
          break
        }
      }
    }

    if (removeIndexes.size > 0) {
      this.items = this.items.filter((_, index) => !removeIndexes.has(index))
      const rebuilt = new Map<Key, number>()
      let nextIdx = 0
      for (const [key, index] of this.keysIndex) {
        if (removeIndexes.has(index)) continue
        rebuilt.set(key, nextIdx++)
      }
      this.keysIndex = rebuilt
    }

    const isLengthChanged = oldLength !== newLength
    if (!isLengthChanged && !hasUpdate) return

    if (isLengthChanged) {
      const refillEpoch = ++this.epoch
      await this.closeIterator()
      if (this.epoch !== refillEpoch || this.disposed) return
      this.items = []
      this.keysIndex = new Map()
      this.openIterator()
      let totalDone = false
      while (this.items.length < newLength && !totalDone) {
        const { aborted, done } = await this.pullPage(refillEpoch)
        if (aborted) return
        totalDone = done
      }
      this.setSnapshot({
        data: [...this.items],
        hasNextPage: !totalDone,
      })
    } else {
      this.setSnapshot({ data: [...this.items] })
    }
  }
}

// ---- Count engine ----

export interface CountSnapshot {
  readonly count: number | null
  readonly status: 'pending' | 'error' | 'success'
  readonly error: Error | null
  readonly isFetching: boolean
}

const INITIAL_COUNT_SNAPSHOT: CountSnapshot = {
  count: null,
  status: 'pending',
  error: null,
  isFetching: false,
}

interface CountOptions<Document extends DocType> {
  readonly where?: Where<Document>
}

/**
 * Reactive row-counter engine. Tracks `state.count(options)` and re-runs
 * it on every insert/delete (updates are ignored - they don't change count).
 * Same lifecycle contract as QueryEngine: retain/release(gcTime)/dispose.
 */
export class CountEngine<Document extends DocType> {
  private readonly listeners = new Set<() => void>()
  private snapshotValue: CountSnapshot = INITIAL_COUNT_SNAPSHOT
  private currentOptions: CountOptions<Document>

  private refCount = 0
  private gcTimer: ReturnType<typeof setTimeout> | null = null
  private unsubscribe: (() => void) | null = null
  private disposed = false
  private epoch = 0

  constructor(
    private readonly state: SyncTable<Document>,
    options: CountOptions<Document>,
    private readonly cacheBucket: Map<string, CachedDisposable> | null,
    readonly cacheKey: string | null,
  ) {
    this.currentOptions = options
  }

  /**
   * External-store subscribe.
   * @param listener Callback when snapshot changes
   * @returns Unsubscribe function
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * External-store snapshot getter.
   * @returns The current count snapshot
   */
  getSnapshot = (): CountSnapshot => this.snapshotValue

  /**
   * Replace per-render options without restarting the subscription.
   * @param options Latest options from the consumer
   */
  updateOptions(options: CountOptions<Document>): void {
    this.currentOptions = options
  }

  /** Subscribe to the table and kick off the first count. */
  start(): void {
    if (this.unsubscribe || this.disposed) return
    this.unsubscribe = this.state.subscribe((mutation) => {
      const { mutations, removedAll } = mutation
      if (removedAll) {
        void this.runCount()
        return
      }
      if (!mutations) return
      for (const m of mutations) {
        if (m.op === 'insert' || m.op === 'delete') {
          void this.runCount()
          return
        }
      }
    })
    void this.runCount()
  }

  retain(): void {
    this.refCount++
    if (this.gcTimer) {
      clearTimeout(this.gcTimer)
      this.gcTimer = null
    }
  }

  release(gcTime: number = DEFAULT_GC_TIME): void {
    this.refCount = Math.max(0, this.refCount - 1)
    if (this.refCount > 0) return
    if (this.cacheKey === null) {
      this.dispose()
      return
    }
    if (gcTime === Number.POSITIVE_INFINITY) return
    if (gcTime <= 0) {
      this.dispose()
      return
    }
    this.gcTimer = setTimeout(() => this.dispose(), gcTime)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.gcTimer) {
      clearTimeout(this.gcTimer)
      this.gcTimer = null
    }
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.cacheBucket && this.cacheKey) {
      this.cacheBucket.delete(this.cacheKey)
    }
    allEngines.delete(this)
    this.listeners.clear()
  }

  /**
   * Re-run the count query.
   * @returns Promise resolving when the count is updated
   */
  refetch(): Promise<void> {
    return this.runCount()
  }

  private async runCount(): Promise<void> {
    if (this.disposed) return
    const epoch = ++this.epoch
    this.setSnapshot({ isFetching: true, error: null })
    try {
      const next = await this.state.count(this.currentOptions)
      if (this.epoch !== epoch || this.disposed) return
      this.setSnapshot({
        count: next,
        status: 'success',
        isFetching: false,
        error: null,
      })
    } catch (error_) {
      if (this.epoch !== epoch || this.disposed) return
      this.setSnapshot({
        status: 'error',
        error: error_ instanceof Error ? error_ : new Error(String(error_)),
        isFetching: false,
      })
    }
  }

  private setSnapshot(partial: Partial<CountSnapshot>): void {
    let changed = false
    for (const key of Object.keys(partial) as Array<keyof CountSnapshot>) {
      if (this.snapshotValue[key] !== partial[key]) {
        changed = true
        break
      }
    }
    if (!changed) return
    this.snapshotValue = { ...this.snapshotValue, ...partial }
    for (const listener of this.listeners) listener()
  }
}

// ---- Global cache (shared across QueryEngine + CountEngine) ----

interface CachedDisposable {
  readonly cacheKey: string | null
  dispose: () => void
}

type EngineBucket = Map<string, CachedDisposable>

const cache = new WeakMap<object, EngineBucket>()
// Strong references for full-cache iteration in clearSqliteCache(). Entries
// self-remove on dispose so this set never outgrows live cached engines.
const allEngines = new Set<CachedDisposable>()

let maxEntriesPerTable = DEFAULT_MAX_ENTRIES_PER_TABLE

/**
 * Override the LRU cap on cached entries per SyncTable. Default 100.
 * @param limit New per-table cap. Use Infinity to disable LRU eviction.
 */
export function setSqliteCacheMaxEntries(limit: number): void {
  maxEntriesPerTable = Math.max(1, limit)
}

/**
 * Get the engine bucket for a SyncTable, creating an empty one if absent.
 * @param state The state acting as a WeakMap key
 * @returns The bucket map for this state
 */
function getBucket(state: object): EngineBucket {
  let bucket = cache.get(state)
  if (!bucket) {
    bucket = new Map()
    cache.set(state, bucket)
  }
  return bucket
}

/**
 * LRU-evict the oldest entries until the bucket fits under the per-table cap.
 * @param bucket Bucket to evict from
 */
function evictIfNeeded(bucket: EngineBucket): void {
  while (bucket.size >= maxEntriesPerTable) {
    const oldestKey = bucket.keys().next().value as string | undefined
    if (oldestKey === undefined) break
    const victim = bucket.get(oldestKey)
    bucket.delete(oldestKey)
    victim?.dispose()
  }
}

/**
 * Get an existing cached query engine or create a new one. Without a cacheKey,
 * returns a fresh non-cached engine that disposes itself on consumer release.
 * @param state The SyncTable to query
 * @param options Search options
 * @param fullKey Cache key (null = no cache)
 * @returns A QueryEngine ready to be retained by the consumer
 */
export function getOrCreateEngine<Document extends DocType, Out>(
  state: SyncTable<Document>,
  options: UseSearchOptions<Document, Out>,
  fullKey: string | null,
): QueryEngine<Document, Out> {
  if (fullKey === null) {
    const engine = new QueryEngine<Document, Out>(state, options, null, null)
    engine.start()
    return engine
  }
  const namespacedKey = 'q:' + fullKey
  const bucket = getBucket(state)
  const existing = bucket.get(namespacedKey)
  if (existing instanceof QueryEngine) {
    bucket.delete(namespacedKey)
    bucket.set(namespacedKey, existing)
    ;(existing as QueryEngine<Document, Out>).updateOptions(options)
    return existing as QueryEngine<Document, Out>
  }
  evictIfNeeded(bucket)
  const engine = new QueryEngine<Document, Out>(state, options, bucket, namespacedKey)
  bucket.set(namespacedKey, engine)
  allEngines.add(engine)
  engine.start()
  return engine
}

/**
 * Count-engine variant of `getOrCreateEngine`. Same cache, same lifecycle.
 * @param state The SyncTable to count
 * @param options Where-clause options
 * @param fullKey Composite cache key (cacheKey + deps hash); null = no cache
 * @returns A CountEngine ready to be retained by the consumer
 */
export function getOrCreateCountEngine<Document extends DocType>(
  state: SyncTable<Document>,
  options: CountOptions<Document>,
  fullKey: string | null,
): CountEngine<Document> {
  if (fullKey === null) {
    const engine = new CountEngine<Document>(state, options, null, null)
    engine.start()
    return engine
  }
  const namespacedKey = 'c:' + fullKey
  const bucket = getBucket(state)
  const existing = bucket.get(namespacedKey)
  if (existing instanceof CountEngine) {
    bucket.delete(namespacedKey)
    bucket.set(namespacedKey, existing)
    ;(existing as CountEngine<Document>).updateOptions(options)
    return existing as CountEngine<Document>
  }
  evictIfNeeded(bucket)
  const engine = new CountEngine<Document>(state, options, bucket, namespacedKey)
  bucket.set(namespacedKey, engine)
  allEngines.add(engine)
  engine.start()
  return engine
}

/**
 * Clear cached query engines.
 * - `clearSqliteCache(state, cacheKey)` - drop one entry
 * - `clearSqliteCache(state)` - drop every entry for this state
 * - `clearSqliteCache()` - drop everything across all states
 * @param state Optional state to scope the clear
 * @param cacheKey Optional cacheKey to scope further
 */
export function clearSqliteCache<Document extends DocType>(state?: SyncTable<Document>, cacheKey?: string): void {
  if (!state) {
    // Snapshot keys first - dispose() mutates the set during iteration.
    const snapshot: CachedDisposable[] = []
    for (const engine of allEngines) snapshot.push(engine)
    for (const engine of snapshot) engine.dispose()
    return
  }
  const bucket = cache.get(state)
  if (!bucket) return
  const snapshot: Array<[string, CachedDisposable]> = []
  for (const entry of bucket.entries()) snapshot.push(entry)
  if (cacheKey === undefined) {
    for (const [, engine] of snapshot) engine.dispose()
    return
  }
  // Match the cacheKey across both query (`q:`) and count (`c:`) namespaces.
  for (const [key, engine] of snapshot) {
    const stripped = key.startsWith('q:') || key.startsWith('c:') ? key.slice(2) : key
    if (stripped === cacheKey || stripped.startsWith(cacheKey + ':')) {
      engine.dispose()
    }
  }
}
