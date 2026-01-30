import { STATE_SCHEDULER, getId } from 'muya'
import type { Backend } from './table'
import { createTable } from './table/table'
import type {
  DbOptions,
  DocType,
  DotPath,
  GetFieldType,
  GroupByOptions,
  GroupByResult,
  Key,
  MutationResult,
  SearchOptions,
  Table,
} from './table/table.types'
import type { Where } from './table/where'

export interface CreateSqliteOptions<Document extends DocType> extends Omit<DbOptions<Document>, 'backend'> {
  readonly backend: Backend | Promise<Backend>
}

export interface MutationItems<Doc> {
  mutations?: MutationResult<Doc>[]
  removedAll?: boolean
}

export interface SyncTable<Document extends DocType> {
  readonly subscribe: (listener: (mutation: MutationItems<Document>) => void) => () => void
  readonly set: (document: Document) => Promise<MutationResult<Document>>
  readonly batchSet: (documents: Document[]) => Promise<MutationResult<Document>[]>
  readonly batchDelete: (keys: Key[]) => Promise<MutationResult<Document>[]>
  readonly get: <Selected = Document>(key: Key, selector?: (document: Document) => Selected) => Promise<Selected | undefined>

  readonly delete: (key: Key) => Promise<MutationResult<Document> | undefined>
  readonly search: <Selected = Document>(options?: SearchOptions<Document, Selected>) => AsyncIterableIterator<Selected>
  readonly count: (options?: { where?: Where<Document> }) => Promise<number>
  readonly deleteBy: (where: Where<Document>) => Promise<MutationResult<Document>[]>
  readonly clear: () => Promise<void>
  readonly groupBy: <Field extends DotPath<Document>>(
    field: Field,
    options?: GroupByOptions<Document>,
  ) => Promise<Array<GroupByResult<GetFieldType<Document, Field>>>>
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
    onScheduleDone(unknownItems: unknown) {
      if (!unknownItems) {
        return
      }
      const items = unknownItems as MutationItems<Document>[]
      const merged: MutationItems<Document> = {}
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
  function handleChanges(item: MutationItems<Document>) {
    STATE_SCHEDULER.schedule(id, item)
  }

  const listeners = new Set<(mutation: MutationItems<Document>) => void>()

  const state: SyncTable<Document> = {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async clear() {
      const table = await getTable()
      handleChanges({ removedAll: true })
      return table.clear()
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
    async batchDelete(keys) {
      const table = await getTable()
      const changes = await table.batchDelete(keys)
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
    async groupBy(field, groupByOptions) {
      const table = await getTable()
      return await table.groupBy(field, groupByOptions)
    },
  }

  return state
}
