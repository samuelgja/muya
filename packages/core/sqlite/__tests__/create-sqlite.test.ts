import { createSqliteState } from '../create-sqlite'
import { bunMemoryBackend } from '../table/bun-backend'

const backend = bunMemoryBackend()
interface Person {
  id: string
  name: string
  age: number
}

describe('create-sqlite-state', () => {
  it('should batchSet and update multiple documents', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'State2', key: 'id' })
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
    const sql = createSqliteState<Person>({ backend, tableName: 'State3', key: 'id' })
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

  it('should deleteBy with in operator on nested field', async () => {
    interface Document {
      id: string
      document: {
        documentId: string
        title: string
      }
    }
    const sql = createSqliteState<Document>({ backend, tableName: 'State3Nested', key: 'id' })
    await sql.batchSet([
      { id: '1', document: { documentId: 'doc-1', title: 'First' } },
      { id: '2', document: { documentId: 'doc-2', title: 'Second' } },
      { id: '3', document: { documentId: 'doc-3', title: 'Third' } },
    ])

    const deleted = await sql.deleteBy({ document: { documentId: { in: ['doc-1', 'doc-3'] } } })

    expect(deleted.length).toBe(2)
    const remaining = []
    for await (const doc of sql.search()) remaining.push(doc)
    expect(remaining.map((d) => d.id)).toEqual(['2'])
  })

  it('should deleteBy with in operator on simple field', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'State3In', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
      { id: '3', name: 'Carol', age: 40 },
    ])

    const deleted = await sql.deleteBy({ id: { in: ['1', '3'] } })

    expect(deleted.length).toBe(2)
    const remaining = []
    for await (const person of sql.search()) remaining.push(person)
    expect(remaining.map((p) => p.id)).toEqual(['2'])
  })

  it('should deleteBy with empty in array', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'State3EmptyIn', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
    ])

    const deleted = await sql.deleteBy({ id: { in: [] } })

    expect(deleted.length).toBe(0)
    const remaining = []
    for await (const person of sql.search()) remaining.push(person)
    expect(remaining.length).toBe(2)
  })

  it('should deleteBy with single item in array on nested field', async () => {
    interface Document {
      id: string
      document: {
        documentId: string
        title: string
      }
    }
    const sql = createSqliteState<Document>({ backend, tableName: 'State3SingleNested', key: 'id' })
    await sql.batchSet([
      { id: '1', document: { documentId: 'doc-1', title: 'First' } },
      { id: '2', document: { documentId: 'doc-2', title: 'Second' } },
    ])

    const deleted = await sql.deleteBy({ document: { documentId: { in: ['doc-1'] } } })

    expect(deleted.length).toBe(1)
    const remaining = []
    for await (const doc of sql.search()) remaining.push(doc)
    expect(remaining.map((d) => d.id)).toEqual(['2'])
  })

  it('should get by key and with selector', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'State4', key: 'id' })
    await sql.set({ id: '1', name: 'Alice', age: 30 })
    const doc = await sql.get('1')
    expect(doc).toEqual({ id: '1', name: 'Alice', age: 30 })
    const name = await sql.get('1', (d) => d.name)
    expect(name).toBe('Alice')
    const missing = await sql.get('999')
    expect(missing).toBeUndefined()
  })

  it('should count documents with and without where', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'State5', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
      { id: '3', name: 'Carol', age: 40 },
    ])
    expect(await sql.count()).toBe(3)
    expect(await sql.count({ where: { age: { gt: 30 } } })).toBe(1)
  })

  it('should support search with options', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'State6', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
      { id: '3', name: 'Carol', age: 40 },
    ])
    const results = []
    for await (const p of sql.search({ where: { age: { lt: 35 } } })) results.push(p)
    expect(results.map((p) => p.id)).toEqual(['1', '2'])
  })
})

interface Product {
  id: string
  name: string
  category: string
  price: number
}

describe('groupBy', () => {
  it('should group by a simple field and count', async () => {
    const sql = createSqliteState<Product>({ backend, tableName: 'GroupBy1', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Apple', category: 'fruit', price: 1 },
      { id: '2', name: 'Banana', category: 'fruit', price: 2 },
      { id: '3', name: 'Carrot', category: 'vegetable', price: 1 },
      { id: '4', name: 'Orange', category: 'fruit', price: 3 },
      { id: '5', name: 'Broccoli', category: 'vegetable', price: 2 },
    ])

    const grouped = await sql.groupBy('category')

    expect(grouped).toHaveLength(2)
    const fruitGroup = grouped.find((g) => g.key === 'fruit')
    const vegetableGroup = grouped.find((g) => g.key === 'vegetable')
    expect(fruitGroup?.count).toBe(3)
    expect(vegetableGroup?.count).toBe(2)
  })

  it('should group by with where clause filter', async () => {
    const sql = createSqliteState<Product>({ backend, tableName: 'GroupBy2', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Apple', category: 'fruit', price: 1 },
      { id: '2', name: 'Banana', category: 'fruit', price: 5 },
      { id: '3', name: 'Carrot', category: 'vegetable', price: 1 },
      { id: '4', name: 'Orange', category: 'fruit', price: 3 },
      { id: '5', name: 'Broccoli', category: 'vegetable', price: 6 },
    ])

    // Only group items with price > 2
    const grouped = await sql.groupBy('category', { where: { price: { gt: 2 } } })

    expect(grouped).toHaveLength(2)
    const fruitGroup = grouped.find((g) => g.key === 'fruit')
    const vegetableGroup = grouped.find((g) => g.key === 'vegetable')
    expect(fruitGroup?.count).toBe(2) // Banana (5), Orange (3)
    expect(vegetableGroup?.count).toBe(1) // Broccoli (6)
  })

  it('should group by numeric field', async () => {
    const sql = createSqliteState<Product>({ backend, tableName: 'GroupBy3', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Apple', category: 'fruit', price: 1 },
      { id: '2', name: 'Banana', category: 'fruit', price: 2 },
      { id: '3', name: 'Carrot', category: 'vegetable', price: 1 },
      { id: '4', name: 'Orange', category: 'fruit', price: 1 },
    ])

    const grouped = await sql.groupBy('price')

    expect(grouped).toHaveLength(2)
    const price1 = grouped.find((g) => g.key === 1)
    const price2 = grouped.find((g) => g.key === 2)
    expect(price1?.count).toBe(3)
    expect(price2?.count).toBe(1)
  })

  it('should return empty array for empty table', async () => {
    const sql = createSqliteState<Product>({ backend, tableName: 'GroupBy4', key: 'id' })

    const grouped = await sql.groupBy('category')

    expect(grouped).toEqual([])
  })

  it('should handle null/undefined values in grouped field', async () => {
    interface ItemWithOptional {
      id: string
      name: string
      tag?: string
    }
    const sql = createSqliteState<ItemWithOptional>({ backend, tableName: 'GroupBy5', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'A', tag: 'red' },
      { id: '2', name: 'B', tag: 'blue' },
      { id: '3', name: 'C' }, // no tag
      { id: '4', name: 'D', tag: 'red' },
    ])

    const grouped = await sql.groupBy('tag')

    // Should have 3 groups: red, blue, and null/undefined
    expect(grouped.length).toBeGreaterThanOrEqual(2)
    const redGroup = grouped.find((g) => g.key === 'red')
    const blueGroup = grouped.find((g) => g.key === 'blue')
    expect(redGroup?.count).toBe(2)
    expect(blueGroup?.count).toBe(1)
  })

  it('should verify count matches sum of grouped counts', async () => {
    const sql = createSqliteState<Product>({ backend, tableName: 'GroupBy6', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Apple', category: 'fruit', price: 1 },
      { id: '2', name: 'Banana', category: 'fruit', price: 2 },
      { id: '3', name: 'Carrot', category: 'vegetable', price: 1 },
      { id: '4', name: 'Orange', category: 'fruit', price: 3 },
      { id: '5', name: 'Broccoli', category: 'vegetable', price: 2 },
    ])

    const totalCount = await sql.count()
    const grouped = await sql.groupBy('category')
    const sumOfCounts = grouped.reduce((sum, group) => sum + group.count, 0)

    expect(totalCount).toBe(5)
    expect(sumOfCounts).toBe(totalCount)
  })

  it('should verify count with where matches grouped count with same where', async () => {
    const sql = createSqliteState<Product>({ backend, tableName: 'GroupBy7', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Apple', category: 'fruit', price: 1 },
      { id: '2', name: 'Banana', category: 'fruit', price: 5 },
      { id: '3', name: 'Carrot', category: 'vegetable', price: 1 },
      { id: '4', name: 'Orange', category: 'fruit', price: 3 },
      { id: '5', name: 'Broccoli', category: 'vegetable', price: 6 },
    ])

    const whereClause = { price: { gt: 2 } }
    const filteredCount = await sql.count({ where: whereClause })
    const grouped = await sql.groupBy('category', { where: whereClause })
    const sumOfCounts = grouped.reduce((sum, group) => sum + group.count, 0)

    expect(filteredCount).toBe(3) // Banana (5), Orange (3), Broccoli (6)
    expect(sumOfCounts).toBe(filteredCount)
  })

  it('should have proper TypeScript inference for key type', async () => {
    const sql = createSqliteState<Product>({ backend, tableName: 'GroupBy8', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Apple', category: 'fruit', price: 1 },
      { id: '2', name: 'Banana', category: 'fruit', price: 2 },
    ])

    // Group by string field - key should be string
    const categoryGroups = await sql.groupBy('category')
    const categoryKey: string = categoryGroups[0].key // TypeScript should infer string
    expect(typeof categoryKey).toBe('string')

    // Group by number field - key should be number
    const priceGroups = await sql.groupBy('price')
    const priceKey: number = priceGroups[0].key // TypeScript should infer number
    expect(typeof priceKey).toBe('number')
  })

  it('should infer nested field types correctly', async () => {
    interface NestedProduct {
      id: string
      details: {
        category: string
        info: {
          rating: number
        }
      }
    }
    const sql = createSqliteState<NestedProduct>({ backend, tableName: 'GroupBy9', key: 'id' })
    await sql.batchSet([
      { id: '1', details: { category: 'A', info: { rating: 5 } } },
      { id: '2', details: { category: 'A', info: { rating: 3 } } },
      { id: '3', details: { category: 'B', info: { rating: 4 } } },
    ])

    // Group by nested string field
    const categoryGroups = await sql.groupBy('details.category')
    const nestedKey: string = categoryGroups[0].key
    expect(typeof nestedKey).toBe('string')
    expect(categoryGroups).toHaveLength(2)

    // Group by deeply nested number field
    const ratingGroups = await sql.groupBy('details.info.rating')
    const ratingKey: number = ratingGroups[0].key
    expect(typeof ratingKey).toBe('number')
    expect(ratingGroups).toHaveLength(3)
  })
})
