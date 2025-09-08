// table.ts (performance-optimized with PRAGMA opt-out)
/* eslint-disable sonarjs/different-types-comparison */
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable no-shadow */

import type { Table, DbOptions, DocType, Key, SearchOptions, MutationResult } from './table.types'
import { getWhereQuery, type Where } from './where'

const DELETE_IN_CHUNK = 500 // fallback chunk size for legacy delete path
export const DEFAULT_STEP_SIZE = 100

function withAnd(baseHasWhere: boolean, clause: string) {
  return (baseHasWhere ? ' AND ' : ' WHERE ') + clause
}
export async function createTable<Document extends DocType>(options: DbOptions<Document>): Promise<Table<Document>> {
  const { backend, tableName, indexes, key, disablePragmaOptimization, order: defaultOrder = 'asc' } = options
  const hasUserKey = key !== undefined

  // --- Apply performance PRAGMAs unless explicitly disabled ---
  // These significantly speed up write-heavy workloads on SQLite.
  if (!disablePragmaOptimization) {
    await backend.execute(`PRAGMA journal_mode=WAL;`)
    await backend.execute(`PRAGMA synchronous=NORMAL;`)
    await backend.execute(`PRAGMA temp_store=MEMORY;`)
    await backend.execute(`PRAGMA cache_size=-20000;`)
  }

  // --- Schema ---
  if (hasUserKey) {
    await backend.execute(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
    `)
  } else {
    await backend.execute(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        data TEXT NOT NULL
      );
    `)
  }

  // JSON expression indexes for fields under data
  for (const index of indexes ?? []) {
    const idx = String(index)
    await backend.execute(`CREATE INDEX IF NOT EXISTS idx_${tableName}_${idx} ON ${tableName} (json_extract(data, '$.${idx}'));`)
  }

  function getKeyFromDocument(document: Document): Key | undefined {
    return hasUserKey ? (document[key as keyof Document] as unknown as Key | undefined) : undefined
  }

  async function getChanges(conn: typeof backend): Promise<number> {
    const r = await conn.select<Array<{ c: number }>>(`SELECT changes() AS c`)
    return r[0]?.c ?? 0
  }

  const table: Table<Document> = {
    backend,

    // -------- Upsert optimized: no exceptions on hot path --------
    async set(document, backendOverride) {
      const db = backendOverride ?? backend
      const json = JSON.stringify(document)

      if (hasUserKey) {
        const id = getKeyFromDocument(document)
        if (id === undefined || id === null) {
          throw new Error(
            `Document is missing the configured key "${String(key)}". Provide it or create the table without "key".`,
          )
        }

        // Try a single INSERT first; if row exists, do a single UPDATE.
        await db.execute(`INSERT INTO ${tableName} (key, data) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`, [id, json])
        const inserted = await getChanges(db)
        if (inserted === 1) {
          return { key: id, op: 'insert' } as MutationResult
        }

        await db.execute(`UPDATE ${tableName} SET data = ? WHERE key = ?`, [json, id])
        return { key: id, op: 'update' } as MutationResult
      }

      // ROWID mode (implicit integer key)
      await db.execute(`INSERT INTO ${tableName} (data) VALUES (?)`, [json])
      const rows = await db.select<Array<{ id: number }>>(`SELECT last_insert_rowid() AS id`)
      const rowid = rows[0]?.id
      if (typeof rowid !== 'number') throw new Error('Failed to retrieve last_insert_rowid()')
      return { key: rowid, op: 'insert' } as MutationResult
    },

    // -------- get() returns selector(document, { rowid }) --------
    async get<Selected = Document>(
      keyValue: Key,
      selector: (document: Document, meta: { rowid: number }) => Selected = (d, _m) => d as unknown as Selected,
    ) {
      const whereKey = hasUserKey ? `key = ?` : `rowid = ?`
      const result = await backend.select<Array<{ data: string; rowid: number }>>(
        `SELECT rowid, data FROM ${tableName} WHERE ${whereKey} LIMIT 1`,
        [keyValue],
      )
      if (result.length === 0) return
      const [item] = result
      if (!item || typeof item.data !== 'string' || typeof item.rowid !== 'number') return
      const { data, rowid } = item
      const document = JSON.parse(data) as Document
      return selector(document, { rowid }) as Selected
    },

    // -------- delete(key) with a single change check --------
    async delete(keyValue: Key) {
      const whereKey = hasUserKey ? `key = ?` : `rowid = ?`
      await backend.execute(`DELETE FROM ${tableName} WHERE ${whereKey}`, [keyValue])
      const changed = await backend.select<Array<{ c: number }>>(`SELECT changes() AS c`)
      if ((changed[0]?.c ?? 0) > 0) {
        return { key: keyValue, op: 'delete' } as MutationResult
      }
      return
    },

    // -------- High-throughput search --------
    // Keyset pagination when sorting by primary (key/rowid); OFFSET fallback for JSON sort.
    async *search<Selected = Document>(options: SearchOptions<Document, Selected> = {}): AsyncIterableIterator<Selected> {
      const order = (options.order ?? defaultOrder ?? 'asc').toLowerCase() as 'asc' | 'desc'
      const asc = order !== 'desc'

      const { limit, where, sortBy, stepSize = DEFAULT_STEP_SIZE } = options
      const offset = options.offset ?? 0
      const select = options.select ?? ((document, _meta) => document as unknown as Selected)

      const baseHasWhere = Boolean(where)
      const baseWhere = baseHasWhere ? ' ' + getWhereQuery(where as Where<Document>) : ''

      let yielded = 0

      // --- Fast path: default sort (no sortBy) => keyset pagination ---
      if (!sortBy) {
        const batch = Math.min(stepSize, limit ?? stepSize)

        if (hasUserKey) {
          // TEXT primary key keyset pagination; we read key directly from column (no JSON parse for cursor)
          let cursor: string | undefined
          let skipped = 0

          // honor initial offset via iterative windows (avoids OFFSET scans)
          while (skipped < offset) {
            const need = Math.min(batch, offset - skipped)
            // eslint-disable-next-line sonarjs/no-nested-conditional
            const clause = cursor === undefined ? '' : withAnd(baseHasWhere, `key ${asc ? '>' : '<'} ?`)
            const q =
              `SELECT key, rowid, data FROM ${tableName}${baseWhere}${clause} ` +
              `ORDER BY key ${asc ? 'ASC' : 'DESC'} LIMIT ${need}`
            const params: unknown[] = []
            if (cursor !== undefined) params.push(cursor)
            const rows = await backend.select<Array<{ key: string; rowid: number; data: string }>>(q, params)
            if (rows.length === 0) return
            cursor = rows.at(-1)?.key ?? cursor
            skipped += rows.length
          }

          while (!limit || yielded < limit) {
            const need = limit ? Math.min(batch, limit - yielded) : batch
            // eslint-disable-next-line sonarjs/no-nested-conditional
            const clause = cursor === undefined ? '' : withAnd(baseHasWhere, `key ${asc ? '>' : '<'} ?`)
            const q =
              `SELECT key, rowid, data FROM ${tableName}${baseWhere}${clause} ` +
              `ORDER BY key ${asc ? 'ASC' : 'DESC'} LIMIT ${need}`
            const params: unknown[] = []
            if (cursor !== undefined) params.push(cursor)
            const rows = await backend.select<Array<{ key: string; rowid: number; data: string }>>(q, params)
            if (rows.length === 0) break

            for (const { key: k, rowid, data } of rows) {
              if (limit && yielded >= limit) return
              const document = JSON.parse(data) as Document
              cursor = k
              yield select(document, { rowId: rowid }) as Selected
              yielded++
            }
          }
          return
        } else {
          // ROWID keyset pagination
          let cursor: number | undefined
          let skipped = 0

          // initial offset without OFFSET
          while (skipped < offset) {
            const need = Math.min(batch, offset - skipped)
            // eslint-disable-next-line sonarjs/no-nested-conditional
            const clause = cursor === undefined ? '' : withAnd(baseHasWhere, `rowid ${asc ? '>' : '<'} ?`)
            const q =
              `SELECT rowid, data FROM ${tableName}${baseWhere}${clause} ` +
              `ORDER BY rowid ${asc ? 'ASC' : 'DESC'} LIMIT ${need}`
            const params: unknown[] = []
            if (cursor !== undefined) params.push(cursor)
            const rows = await backend.select<Array<{ rowid: number; data: string }>>(q, params)
            if (rows.length === 0) return
            cursor = rows.at(-1)?.rowid ?? cursor
            skipped += rows.length
          }

          while (!limit || yielded < limit) {
            const need = limit ? Math.min(batch, limit - yielded) : batch
            // eslint-disable-next-line sonarjs/no-nested-conditional
            const clause = cursor === undefined ? '' : withAnd(baseHasWhere, `rowid ${asc ? '>' : '<'} ?`)
            const q =
              `SELECT rowid, data FROM ${tableName}${baseWhere}${clause} ` +
              `ORDER BY rowid ${asc ? 'ASC' : 'DESC'} LIMIT ${need}`
            const params: unknown[] = []
            if (cursor !== undefined) params.push(cursor)
            const rows = await backend.select<Array<{ rowid: number; data: string }>>(q, params)
            if (rows.length === 0) break

            for (const { rowid, data } of rows) {
              if (limit && yielded >= limit) return
              const document = JSON.parse(data) as Document
              cursor = rowid
              yield select(document, { rowId: rowid }) as Selected
              yielded++
            }
          }
          return
        }
      }

      // --- Fallback path: custom JSON sort (OFFSET unavoidable) ---
      let baseOrderBy: string
      if (sortBy) {
        baseOrderBy = ` ORDER BY json_extract(data, '$.${String(sortBy)}') COLLATE NOCASE ${asc ? 'ASC' : 'DESC'}`
      } else if (hasUserKey) {
        baseOrderBy = ` ORDER BY key ${asc ? 'ASC' : 'DESC'}`
      } else {
        baseOrderBy = ` ORDER BY rowid ${asc ? 'ASC' : 'DESC'}`
      }

      let currentOffset = offset
      while (true) {
        const batchLimit = limit ? Math.min(stepSize, limit - yielded) : stepSize
        const q = `SELECT rowid, data FROM ${tableName}${baseWhere}${baseOrderBy} LIMIT ${batchLimit} OFFSET ${currentOffset}`
        const results = await backend.select<Array<{ rowid: number; data: string }>>(q)
        if (results.length === 0) break

        for (const { rowid, data } of results) {
          if (limit && yielded >= limit) return
          const document = JSON.parse(data) as Document
          yield select(document, { rowId: rowid }) as Selected
          yielded++
        }

        if (results.length < batchLimit || (limit && yielded >= limit)) break
        currentOffset += results.length
      }
    },

    // -------- COUNT (simple and fast) --------
    async count(options: { where?: Where<Document> } = {}) {
      const { where } = options
      let query = `SELECT COUNT(*) as count FROM ${tableName}`
      if (where) query += ' ' + getWhereQuery(where)
      const result = await backend.select<Array<{ count: number }>>(query)
      return result[0]?.count ?? 0
    },

    // -------- One-shot DELETE using RETURNING (with fallback) --------
    async deleteBy(where: Where<Document>) {
      const whereQuery = getWhereQuery(where)
      const keyCol = hasUserKey ? 'key' : 'rowid'

      try {
        // Modern SQLite (3.35+) supports RETURNING, which is fast and single-pass.
        const rows = await backend.select<Array<{ k: Key }>>(`DELETE FROM ${tableName} ${whereQuery} RETURNING ${keyCol} AS k`)
        if (!rows?.length) return []
        return rows.map((r) => ({ key: r.k, op: 'delete' as const }))
      } catch {
        // Fallback path for older SQLite/drivers
        const results: MutationResult[] = []
        await backend.transaction(async (tx) => {
          const rows = await tx.select<Array<{ k: Key }>>(`SELECT ${keyCol} AS k FROM ${tableName} ${whereQuery}`)
          if (rows.length === 0) return
          const allKeys = rows.map((r) => r.k)
          for (let index = 0; index < allKeys.length; index += DELETE_IN_CHUNK) {
            const chunk = allKeys.slice(index, index + DELETE_IN_CHUNK)
            const placeholders = chunk.map(() => '?').join(',')
            await tx.execute(`DELETE FROM ${tableName} WHERE ${keyCol} IN (${placeholders})`, chunk as unknown as unknown[])
          }
          for (const k of allKeys) results.push({ key: k, op: 'delete' })
        })
        return results
      }
    },

    // -------- Batch writes (single transaction) --------
    async batchSet(documents: Document[]) {
      const mutations: MutationResult[] = []
      await backend.transaction(async (tx) => {
        for (const document of documents) {
          const m = await table.set(document!, tx)
          mutations.push(m)
        }
      })
      return mutations
    },
  }

  return table
}
