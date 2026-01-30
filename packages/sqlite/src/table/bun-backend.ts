import { Database, type Statement } from 'bun:sqlite'
import type { Backend } from './backend'
import { MapDeque } from './map-deque'

/**
 * Create an in-memory SQLite backend using Bun's SQLite implementation
 * @returns A Backend instance for in-memory SQLite operations
 */
export function bunMemoryBackend(): Backend {
  const db = Database.open(':memory:')
  const prepares = new MapDeque<string, Statement>(100)
  /**
   * Get or prepare a SQLite statement, caching it for future use
   * @param query The SQL query string
   * @returns The prepared SQLite statement
   */
  function getStatement(query: string): Statement {
    if (prepares.has(query)) {
      return prepares.get(query)!
    }
    const stmt = db.prepare(query)
    prepares.set(query, stmt)
    return stmt
  }

  const backend: Backend = {
    execute: async (query, params = []) => {
      const q = getStatement(query)
      const result = q.run(...(params as never[]))
      return {
        rowsAffected: result.changes,
        changes: result.changes,
      }
    },
    transaction: async (callback) => {
      return db.transaction(() => callback(backend))()
    },
    path: db.filename,
    select: async (query, params = []) => {
      const q = getStatement(query)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = q.all(...(params as never[])) as Array<Record<string, any>>
      return result as never
    },
  }
  return backend
}
