// table.types.ts
import type { Backend } from './backend'
import type { Where } from './where'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DocType = { [key: string]: any }
export type KeyTypeAvailable = 'string' | 'number'

export interface DbOptions<Document extends DocType> {
  readonly sorBy?: keyof Document
  readonly order?: 'asc' | 'desc'
  readonly tableName: string
  readonly indexes?: Array<keyof Document>
  readonly backend: Backend
  /**
   * Optional key. If omitted, the table uses implicit SQLite ROWID as the key.
   */
  readonly key?: keyof Document
}

interface DbNotGeneric {
  readonly backend: Backend
}

export interface SearchOptions<Document extends DocType, Selected = Document> {
  readonly sorBy?: keyof Document
  readonly order?: 'asc' | 'desc'
  readonly limit?: number
  readonly offset?: number
  readonly where?: Where<Document>
  readonly stepSize?: number
  /**
   * Naive projection. Prefer specialized queries for heavy fan-out graphs.
   */
  readonly select?: (document: Document, meta: { rowId: number }) => Selected
}

export type Key = string | number

export type MutationOp = 'insert' | 'update' | 'delete'
export interface MutationResult {
  key: Key
  op: MutationOp
}

export interface Table<Document extends DocType> extends DbNotGeneric {
  readonly set: (document: Document, backendOverride?: Backend) => Promise<MutationResult>
  readonly batchSet: (documents: Document[]) => Promise<MutationResult[]>
  readonly get: <Selected = Document>(key: Key, selector?: (document: Document) => Selected) => Promise<Selected | undefined>

  readonly delete: (key: Key) => Promise<MutationResult | undefined>
  readonly search: <Selected = Document>(options?: SearchOptions<Document, Selected>) => AsyncIterableIterator<Selected>
  readonly count: (options?: { where?: Where<Document> }) => Promise<number>
  readonly deleteBy: (where: Where<Document>) => Promise<MutationResult[]>
}
