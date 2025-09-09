/* eslint-disable sonarjs/redundant-type-aliases */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable no-shadow */
import { createScheduler } from '../scheduler'
import { shallow } from '../utils/shallow'
import { selectSql, type CreateState } from './select-sql'
import type { Backend } from './table'
import { createTable, DEFAULT_STEP_SIZE } from './table/table'
import type { DbOptions, DocType, Key, MutationResult, SearchOptions, Table } from './table/table.types'
import type { Where } from './table/where'

type SearchId = string
const STATE_SCHEDULER = createScheduler()

let stateId = 0
function getStateId() {
  return stateId++
}

export interface CreateSqliteOptions<Document extends DocType> extends Omit<DbOptions<Document>, 'backend'> {
  readonly backend: Backend | Promise<Backend>
}

export interface SyncTable<Document extends DocType> {
  // readonly registerSearch: <Selected = Document>(searchId: SearchId, options: SearchOptions<Document, Selected>) => () => void
  readonly updateSearchOptions: <Selected = Document>(searchId: SearchId, options: SearchOptions<Document, Selected>) => void
  readonly subscribe: (searchId: SearchId, listener: () => void) => () => void
  readonly getSnapshot: (searchId: SearchId) => Document[]
  readonly refresh: (searchId: SearchId) => Promise<void>

  readonly set: (document: Document) => Promise<MutationResult>
  readonly batchSet: (documents: Document[]) => Promise<MutationResult[]>
  readonly get: <Selected = Document>(key: Key, selector?: (document: Document) => Selected) => Promise<Selected | undefined>

  readonly delete: (key: Key) => Promise<MutationResult | undefined>
  readonly search: <Selected = Document>(options?: SearchOptions<Document, Selected>) => AsyncIterableIterator<Selected>
  readonly count: (options?: { where?: Where<Document> }) => Promise<number>
  readonly deleteBy: (where: Where<Document>) => Promise<MutationResult[]>
  readonly destroy: () => void
  readonly next: (searchId: SearchId) => Promise<boolean>

  readonly select: <Params extends unknown[]>(
    compute: (...args: Params) => SearchOptions<Document>,
  ) => CreateState<Document, Params>
}

interface DataItems<Document extends DocType> {
  items: Document[]
  keys: Set<Key>
  options?: SearchOptions<Document, unknown>
}

export function createSqliteState<Document extends DocType>(options: CreateSqliteOptions<Document>): SyncTable<Document> {
  const id = getStateId()
  function getScheduleId(searchId: SearchId) {
    return `state-${id}-search-${searchId}`
  }

  let cachedTable: Table<Document> | undefined
  async function getTable() {
    if (!cachedTable) {
      const { backend, ...rest } = options
      const resolvedBackend = backend instanceof Promise ? await backend : backend
      cachedTable = await createTable<Document>({ backend: resolvedBackend, ...rest })
    }
    return cachedTable
  }

  interface NextResult {
    document: Document
    rowId: number
  }
  // const emitter = createEmitter<Table<Document>>()
  const cachedData = new Map<SearchId, DataItems<Document>>()
  const listeners = new Map<SearchId, () => void>()
  const iterators = new Map<SearchId, AsyncIterableIterator<NextResult>>()

  async function next(searchId: SearchId, data: DataItems<Document>): Promise<boolean> {
    const iterator = iterators.get(searchId)
    const { options = {} } = data
    const { stepSize = DEFAULT_STEP_SIZE } = options
    if (!iterator) return false
    const newItems: Document[] = []

    for (let index = 0; index < stepSize; index++) {
      const result = await iterator.next()
      if (result.done) {
        iterators.delete(searchId)
        break
      }

      if (!data.keys.has(String(result.value.rowId))) {
        newItems.push(result.value.document)
        data.keys.add(String(result.value.rowId))
      }
    }

    if (newItems.length === 0) return false
    if (shallow(data.items, newItems)) return false
    data.items = [...data.items, ...newItems]
    return true
  }

  function notifyListeners(searchId: SearchId) {
    const searchListeners = listeners.get(searchId)
    if (searchListeners) {
      searchListeners()
    }
  }

  async function refreshCache(searchId: SearchId) {
    const table = await getTable()
    const data = cachedData.get(searchId)
    if (!data) return
    const { options } = data
    const iterator = table.search({ ...options, select: (document, { rowId }) => ({ document, rowId }) })
    iterators.set(searchId, iterator)
    data.keys = new Set()
    data.items = []
    await next(searchId, data)
  }
  async function refresh(searchId: SearchId) {
    await refreshCache(searchId)
    notifyListeners(searchId)
  }

  function handleChange(mutationResult: MutationResult) {
    const { key, op } = mutationResult
    // find all cached data with key
    const searchIds = new Set<SearchId>()
    for (const [searchId, { keys }] of cachedData) {
      switch (op) {
        case 'delete':
        case 'update': {
          if (keys.has(String(key))) {
            searchIds.add(searchId)
          }
          break
        }
        case 'insert': {
          // we do not know about the key
          searchIds.add(searchId)
          break
        }
      }
    }
    return searchIds
  }

  async function handleChanges(mutationResults: MutationResult[]) {
    const updateSearchIds = new Set<SearchId>()
    for (const mutationResult of mutationResults) {
      const searchIds = handleChange(mutationResult)
      for (const searchId of searchIds) {
        updateSearchIds.add(searchId)
      }
    }

    // const promises = []
    for (const searchId of updateSearchIds) {
      const scheduleId = getScheduleId(searchId)
      STATE_SCHEDULER.schedule(scheduleId, { searchId })
    }
  }

  const clearSchedulers = new Set<() => void>()

  function registerData(searchId: SearchId, options?: SearchOptions<Document, unknown>) {
    if (!cachedData.has(searchId)) {
      cachedData.set(searchId, { items: [], options, keys: new Set() })
      if (options) {
        refresh(searchId)
      }
    }
    const data = cachedData.get(searchId)!
    if (options) {
      data.options = options
    }
    return data
  }

  const state: SyncTable<Document> = {
    async set(document) {
      const table = await getTable()
      const changes = await table.set(document)
      await handleChanges([changes])
      return changes
    },
    async batchSet(documents) {
      const table = await getTable()
      const changes = await table.batchSet(documents)
      await handleChanges(changes)
      return changes
    },
    async delete(key) {
      const table = await getTable()
      const changes = await table.delete(key)
      if (changes) {
        await handleChanges([changes])
      }
      return changes
    },
    async deleteBy(where) {
      const table = await getTable()
      const changes = await table.deleteBy(where)
      await handleChanges(changes)
      return changes
    },
    async get(key, selector) {
      const table = await getTable()
      return table.get(key, selector)
    },
    async *search(options = {}) {
      const table = await getTable()
      for await (const item of table.search(options)) {
        yield item
      }
    },
    async count(options) {
      const table = await getTable()
      return await table.count(options)
    },

    updateSearchOptions(searchId, options) {
      const data = registerData(searchId, options)
      data.options = options
      const scheduleId = getScheduleId(searchId)
      STATE_SCHEDULER.schedule(scheduleId, { searchId })
    },

    subscribe(searchId, listener) {
      const scheduleId = getScheduleId(searchId)
      const clear = STATE_SCHEDULER.add(scheduleId, {
        onScheduleDone() {
          refresh(searchId)
        },
      })
      clearSchedulers.add(clear)

      if (!listeners.has(searchId)) {
        listeners.set(searchId, listener)
      }
      return () => {
        listeners.delete(searchId)
        clear()
        cachedData.delete(searchId)
      }
    },
    getSnapshot(searchId) {
      const data = registerData(searchId)
      return data.items
    },
    refresh,
    destroy() {
      for (const clear of clearSchedulers) clear()
      cachedData.clear()
      listeners.clear()
    },
    async next(searchId) {
      const data = cachedData.get(searchId)
      if (data) {
        const hasNext = await next(searchId, data)
        if (hasNext) {
          notifyListeners(searchId)
        }
        return hasNext
      }
      return false
    },

    select(compute) {
      return selectSql(state, compute)
    },
  }

  return state
}
