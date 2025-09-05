// table.ts
/* eslint-disable sonarjs/different-types-comparison */
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable no-shadow */
import type { Table, DbOptions, DocType, Key, SearchOptions, MutationResult } from './table.types'
import { getWhereQuery, type Where } from './where'

const DELETE_IN_CHUNK = 500 // keep well below SQLite's default 999 parameter limit

export async function createTable<Document extends DocType>(options: DbOptions<Document>): Promise<Table<Document>> {
  const { backend, tableName, indexes, key } = options
  const hasUserKey = key !== undefined

  // Schema
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

        // Fast path: UPDATE first
        await db.execute(`UPDATE ${tableName} SET data = ? WHERE key = ?`, [json, id])
        const updated = await getChanges(db)
        if (updated === 1) return { key: id, op: 'update' }

        // No row updated => try INSERT
        try {
          await db.execute(`INSERT INTO ${tableName} (key, data) VALUES (?, ?)`, [id, json])
          return { key: id, op: 'insert' }
        } catch {
          await db.execute(`UPDATE ${tableName} SET data = ? WHERE key = ?`, [json, id])
          return { key: id, op: 'update' }
        }
      }

      // ROWID mode
      await db.execute(`INSERT INTO ${tableName} (data) VALUES (?)`, [json])
      const rows = await db.select<Array<{ id: number }>>(`SELECT last_insert_rowid() AS id`)
      const rowid = rows[0]?.id
      if (typeof rowid !== 'number') throw new Error('Failed to retrieve last_insert_rowid()')
      const result: MutationResult = { key: rowid, op: 'insert' }
      return result
    },

    // --- FIXED: include rowid ---
    async get<Selected = Document>(
      keyValue: Key,
      selector: (document: Document, meta: { rowid: number }) => Selected = (d, _m) => d as unknown as Selected,
    ) {
      const whereKey = hasUserKey ? `key = ?` : `rowid = ?`
      const result = await backend.select<Array<{ data: string; rowid: number }>>(
        `SELECT rowid, data FROM ${tableName} WHERE ${whereKey}`,
        [keyValue],
      )
      if (result.length === 0) return
      const [item] = result
      const { data, rowid } = item
      const document = JSON.parse(data) as Document
      return selector(document, { rowid }) as Selected
    },

    async delete(keyValue: Key) {
      const whereKey = hasUserKey ? `key = ?` : `rowid = ?`
      await backend.execute(`DELETE FROM ${tableName} WHERE ${whereKey}`, [keyValue])
      const changed = await backend.select<Array<{ c: number }>>(`SELECT changes() AS c`)
      if ((changed[0]?.c ?? 0) > 0) {
        return { key: keyValue, op: 'delete' }
      }
      return
    },

    // --- FIXED: include rowid in search ---
    async *search<Selected = Document>(options: SearchOptions<Document, Selected> = {}): AsyncIterableIterator<Selected> {
      const {
        sorBy,
        order = 'asc',
        limit,
        offset = 0,
        where,
        select = (document, _meta) => document as unknown as Selected,
        stepSize = 100,
      } = options

      let baseQuery = `SELECT rowid, data FROM ${tableName}`
      if (where) baseQuery += ' ' + getWhereQuery(where)

      let yielded = 0
      let currentOffset = offset
      while (true) {
        let query = baseQuery

        if (sorBy) {
          query += ` ORDER BY json_extract(data, '$.${String(sorBy)}') COLLATE NOCASE ${order.toUpperCase()}`
        } else {
          query += hasUserKey ? ` ORDER BY key COLLATE NOCASE ${order.toUpperCase()}` : ` ORDER BY rowid ${order.toUpperCase()}`
        }

        const batchLimit = limit ? Math.min(stepSize, limit - yielded) : stepSize
        query += ` LIMIT ${batchLimit} OFFSET ${currentOffset}`

        const results = await backend.select<Array<{ rowid: number; data: string }>>(query)
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

    async count(options: { where?: Where<Document> } = {}) {
      const { where } = options
      let query = `SELECT COUNT(*) as count FROM ${tableName}`
      if (where) query += ' ' + getWhereQuery(where)
      const result = await backend.select<Array<{ count: number }>>(query)
      return result[0]?.count ?? 0
    },

    async deleteBy(where: Where<Document>) {
      const whereQuery = getWhereQuery(where)
      const keyCol = hasUserKey ? 'key' : 'rowid'

      const results: MutationResult[] = []
      await backend.transaction(async (tx) => {
        const rows = await tx.select<Array<{ k: Key }>>(`SELECT ${keyCol} AS k, rowid FROM ${tableName} ${whereQuery}`)
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
    },

    async batchSet(documents: Document[]) {
      const mutations: MutationResult[] = []
      await backend.transaction(async (tx) => {
        for (const document of documents) {
          const m = await table.set(document, tx)
          mutations.push(m)
        }
      })
      return mutations
    },
  }

  return table
}
