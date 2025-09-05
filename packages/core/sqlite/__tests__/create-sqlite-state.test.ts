import { createSqliteState } from '../create-sqlite-state'
import { bunMemoryBackend } from '../table/bun-backend'

const backend = bunMemoryBackend()
interface Person {
  id: string
  name: string
  age: number
}

describe('create-sqlite-state', () => {
  it('should batchSet and update multiple documents', async () => {
    const sql = await createSqliteState<Person>({ backend, tableName: 'State2', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
    ])
    const all = []
    for await (const p of sql.search()) all.push(p)
    expect(all).toHaveLength(2)
    // update both
    await sql.batchSet([
      { id: '1', name: 'Alice2', age: 31 },
      { id: '2', name: 'Bob2', age: 26 },
    ])
    const updated = []
    for await (const p of sql.search()) updated.push(p)
    expect(updated).toEqual([
      { id: '1', name: 'Alice2', age: 31 },
      { id: '2', name: 'Bob2', age: 26 },
    ])
  })

  it('should deleteBy condition', async () => {
    const sql = await createSqliteState<Person>({ backend, tableName: 'State3', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
      { id: '3', name: 'Carol', age: 40 },
    ])
    const deleted = await sql.deleteBy({ age: { gt: 30 } })
    expect(deleted.length).toBe(1)
    const all = []
    for await (const p of sql.search()) all.push(p)
    expect(all.map((p) => p.id)).toEqual(['1', '2'])
  })

  it('should get by key and with selector', async () => {
    const sql = await createSqliteState<Person>({ backend, tableName: 'State4', key: 'id' })
    await sql.set({ id: '1', name: 'Alice', age: 30 })
    const doc = await sql.get('1')
    expect(doc).toEqual({ id: '1', name: 'Alice', age: 30 })
    const name = await sql.get('1', (d) => d.name)
    expect(name).toBe('Alice')
    const missing = await sql.get('999')
    expect(missing).toBeUndefined()
  })

  it('should count documents with and without where', async () => {
    const sql = await createSqliteState<Person>({ backend, tableName: 'State5', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
      { id: '3', name: 'Carol', age: 40 },
    ])
    expect(await sql.count()).toBe(3)
    expect(await sql.count({ where: { age: { gt: 30 } } })).toBe(1)
  })

  it('should support search with options', async () => {
    const sql = await createSqliteState<Person>({ backend, tableName: 'State6', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
      { id: '3', name: 'Carol', age: 40 },
    ])
    const results = []
    for await (const p of sql.search({ where: { age: { lt: 35 } } })) results.push(p)
    expect(results.map((p) => p.id)).toEqual(['1', '2'])
  })

  it('should notify listeners via registerSearch/subscribe and cleanup', async () => {
    const sql = await createSqliteState<Person>({ backend, tableName: 'State7', key: 'id' })
    const searchId = 'test-search'
    let notified = 0
    const unregister = sql.registerSearch(searchId, {})
    const unsub = sql.subscribe(searchId, () => {
      notified++
    })
    await sql.set({ id: '1', name: 'Alice', age: 30 })
    // Wait for async notification
    await new Promise((done) => setTimeout(done, 10))
    expect(notified).toBeGreaterThan(0)
    unsub()
    unregister()
    // After cleanup, further changes should not notify
    notified = 0
    await sql.set({ id: '2', name: 'Bob', age: 25 })
    await new Promise((done) => setTimeout(done, 10))
    expect(notified).toBe(0)
  })

  it('should cleanup state and listeners on destroy', async () => {
    const sql = await createSqliteState<Person>({ backend, tableName: 'State8', key: 'id' })
    const searchId = 'destroy-search'
    let notified = 0
    sql.registerSearch(searchId, {})
    sql.subscribe(searchId, () => {
      notified++
    })
    await sql.set({ id: '1', name: 'Alice', age: 30 })
    await new Promise((done) => setTimeout(done, 10))
    expect(notified).toBeGreaterThan(0)
    sql.destroy()
    notified = 0
    await sql.set({ id: '2', name: 'Bob', age: 25 })
    await new Promise((done) => setTimeout(done, 10))
    expect(notified).toBe(0)
  })
})
