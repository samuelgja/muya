import { STATE_SCHEDULER } from '../create'
import { getId } from '../utils/id'
import type { Backend } from './table'
import { createTable } from './table/table'
import type { DbOptions, DocType, Key, MutationResult, SearchOptions, Table } from './table/table.types'
import type { Where } from './table/where'

export interface CreateSqliteOptions<Document extends DocType> extends Omit<DbOptions<Document>, 'backend'> {
  readonly backend: Backend | Promise<Backend>
}

export interface MutationItems {
  mutations?: MutationResult[]
  removedAll?: boolean
}

export interface SyncTable<Document extends DocType> {
  readonly subscribe: (listener: (mutation: MutationItems) => void) => () => void
  readonly set: (document: Document) => Promise<MutationResult>
  readonly batchSet: (documents: Document[]) => Promise<MutationResult[]>
  readonly get: <Selected = Document>(key: Key, selector?: (document: Document) => Selected) => Promise<Selected | undefined>

  readonly delete: (key: Key) => Promise<MutationResult | undefined>
  readonly search: <Selected = Document>(options?: SearchOptions<Document, Selected>) => AsyncIterableIterator<Selected>
  readonly count: (options?: { where?: Where<Document> }) => Promise<number>
  readonly deleteBy: (where: Where<Document>) => Promise<MutationResult[]>
  readonly clear: () => void
}

/**
 * Create a SyncTable that wraps a Table and provides reactive capabilities
 * @param options Options to create the SyncTable, including the backend and table name
 * @returns A SyncTable instance with methods to interact with the underlying Table and manage reactive searches
 */
export function createSqliteState<Document extends DocType>(options: CreateSqliteOptions<Document>): SyncTable<Document> {
  let cachedTable: Table<Document> | undefined
  /**
   * Get or create the underlying table
   * @returns The Table instance
   */
  async function getTable() {
    if (!cachedTable) {
      const { backend, ...rest } = options
      const resolvedBackend = backend instanceof Promise ? await backend : backend
      cachedTable = await createTable<Document>({ backend: resolvedBackend, ...rest })
    }
    return cachedTable
  }

  const id = getId()
  STATE_SCHEDULER.add(id, {
    onScheduleDone(unknownItems) {
      if (!unknownItems) {
        return
      }
      const items = unknownItems as MutationItems[]
      const merged: MutationItems = {}
      for (const item of items) {
        if (item.removedAll) {
          merged.removedAll = true
        }
        if (item.mutations) {
          if (!merged.mutations) {
            merged.mutations = []
          }
          merged.mutations.push(...item.mutations)
        }
      }
      for (const listener of listeners) {
        listener(merged)
      }
    },
  })

  /**
   * Notify all subscribers of changes
   * @param item The mutation items to notify subscribers about
   */
  function handleChanges(item: MutationItems) {
    STATE_SCHEDULER.schedule(id, item)
  }

  const listeners = new Set<(mutation: MutationItems) => void>()

  const state: SyncTable<Document> = {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    clear() {
      cachedTable?.clear()
      handleChanges({ removedAll: true })
    },
    async set(document) {
      const table = await getTable()
      const changes = await table.set(document)
      handleChanges({ mutations: [changes] })
      return changes
    },
    async batchSet(documents) {
      const table = await getTable()
      const changes = await table.batchSet(documents)
      handleChanges({ mutations: changes })
      return changes
    },
    async delete(key) {
      const table = await getTable()
      const changes = await table.delete(key)
      if (changes) {
        handleChanges({ mutations: [changes] })
      }
      return changes
    },
    async deleteBy(where) {
      const table = await getTable()
      const changes = await table.deleteBy(where)
      handleChanges({ mutations: changes })
      return changes
    },
    async get(key, selector) {
      const table = await getTable()
      return table.get(key, selector)
    },
    async *search(searchOptions = {}) {
      const table = await getTable()
      for await (const item of table.search(searchOptions)) {
        yield item
      }
    },
    async count(countOptions) {
      const table = await getTable()
      return await table.count(countOptions)
    },
  }

  return state
}
