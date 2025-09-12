import type { SqlSeachOptions } from '../select-sql'
import type { Backend } from './backend'
import type { FtsTokenizerOptions } from './tokenizer'
import type { Where } from './where'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DocType = { [key: string]: any }
export type KeyTypeAvailable = 'string' | 'number'

// Expand all nested keys into dot-paths
export type DotPrefix<T extends string> = T extends '' ? '' : `.${T}`

type Previous = [never, 0, 1, 2, 3, 4, 5]

export type DotPath<T, D extends number = 5> = [D] extends [never]
  ? never
  : T extends object
    ? {
        [K in Extract<keyof T, string>]: T[K] extends object ? K | `${K}.${DotPath<T[K], Previous[D]>}` : K
      }[Extract<keyof T, string>]
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
  readonly clear: () => Promise<void>
}
