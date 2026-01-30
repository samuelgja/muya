import type { Backend } from './backend'
import type { FtsTokenizerOptions } from './tokenizer'
import type { Where } from './where'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DocType = { [key: string]: any }
export type KeyTypeAvailable = 'string' | 'number'

export interface SqlSeachOptions<Document extends DocType> {
  readonly sortBy?: DotPath<Document>
  readonly order?: 'asc' | 'desc'
  readonly limit?: number
  readonly offset?: number
  readonly where?: Where<Document>
  readonly pageSize?: number
}

// Expand all nested keys into dot-paths
export type DotPrefix<T extends string> = T extends '' ? '' : `.${T}`

type Previous = [never, 0, 1, 2, 3, 4, 5]

type DotPathRaw<T, D extends number = 5> = [D] extends [never]
  ? never
  : T extends object
    ? {
        [K in Extract<keyof T, string>]: T[K] extends object ? K | `${K}.${DotPathRaw<T[K], Previous[D]>}` : K
      }[Extract<keyof T, string>]
    : never

export type DotPath<T> = DotPathRaw<MakeAllFieldAsRequired<T>>

/**
 * Extract the value type at a given dot path
 * e.g., GetFieldType<{ user: { name: string } }, 'user.name'> = string
 */
export type GetFieldType<T, Path extends string> = Path extends `${infer First}.${infer Rest}`
  ? First extends keyof T
    ? GetFieldType<T[First], Rest>
    : never
  : Path extends keyof T
    ? T[Path]
    : never

// Built-in FTS5 tokenizers
export type FtsTokenizer =
  | 'porter' // English stemming
  | 'simple' // basic ASCII tokenizer
  | 'icu' // requires SQLite compiled with ICU extension
  | 'unicode61' // Unicode-aware tokenizer with diacritic removal and custom token chars
  | FtsTokenizerOptions

export interface FtsType<Document extends DocType> {
  readonly type: 'fts'
  readonly path: DotPath<Document>
  readonly tokenizer?: FtsTokenizer
}
export type IndexDeclaration<Document extends DocType> =
  | DotPath<Document> // normal JSON path index
  | `fts:${DotPath<Document>}` // full-text index
  | FtsType<Document> // full-text index with options

export interface DbOptions<Document extends DocType> {
  readonly tableName: string
  readonly indexes?: Array<IndexDeclaration<Document>>
  readonly backend: Backend
  readonly key?: DotPath<Document>
  readonly disablePragmaOptimization?: boolean
}

export interface SearchOptions<Document extends DocType, Selected = Document> extends SqlSeachOptions<Document> {
  readonly select?: (document: Document, meta: { rowId: number; key: Key }) => Selected
}

interface DbNotGeneric {
  readonly backend: Backend
}

export type Key = string | number

export type MutationOp = 'insert' | 'update' | 'delete'

interface MutationResultBase<T> {
  key: Key
  op: MutationOp
  document?: T
}
interface MutationResultDelete<T> extends MutationResultBase<T> {
  key: Key
  op: 'delete'
}

interface MutationResultUpdateInsert<T> extends MutationResultBase<T> {
  key: Key
  op: 'update' | 'insert'
  document: T
}

export type MutationResult<T> = MutationResultDelete<T> | MutationResultUpdateInsert<T>

export interface GroupByResult<K> {
  readonly key: K
  readonly count: number
}

export interface GroupByOptions<Document extends DocType> {
  readonly where?: Where<Document>
}

export interface Table<Document extends DocType> extends DbNotGeneric {
  readonly set: (document: Document, backendOverride?: Backend) => Promise<MutationResult<Document>>
  readonly batchSet: (documents: Document[]) => Promise<MutationResult<Document>[]>
  readonly batchDelete: (keys: Key[]) => Promise<MutationResult<Document>[]>
  readonly get: <Selected = Document>(key: Key, selector?: (document: Document) => Selected) => Promise<Selected | undefined>

  readonly delete: (key: Key, backendOverride?: Backend) => Promise<MutationResult<Document> | undefined>
  readonly search: <Selected = Document>(options?: SearchOptions<Document, Selected>) => AsyncIterableIterator<Selected>
  readonly count: (options?: { where?: Where<Document> }) => Promise<number>
  readonly deleteBy: (where: Where<Document>) => Promise<MutationResult<Document>[]>
  readonly clear: () => Promise<void>
  readonly groupBy: <Field extends DotPath<Document>>(
    field: Field,
    options?: GroupByOptions<Document>,
  ) => Promise<Array<GroupByResult<GetFieldType<Document, Field>>>>
}

export type MakeAllFieldAsRequired<T> = {
  [K in keyof T]-?: T[K] extends object ? MakeAllFieldAsRequired<T[K]> : T[K]
}
