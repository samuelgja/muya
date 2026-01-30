export const IN_MEMORY_DB = ':memory:'

export interface QueryResult {
  /** The number of rows affected by the query. */
  rowsAffected: number
  /**
   * The last inserted `id`.
   *
   * This value is not set for Postgres databases. If the
   * last inserted id is required on Postgres, the `select` function
   * must be used, with a `RETURNING` clause
   * (`INSERT INTO todos (title) VALUES ($1) RETURNING id`).
   */
  lastInsertId?: number
}
export interface Backend {
  execute: (query: string, bindValues?: unknown[]) => Promise<QueryResult>
  select: <T>(query: string, bindValues?: unknown[]) => Promise<T>
  transaction: (callback: (tx: Backend) => Promise<void>) => Promise<void>
  path: string
}
