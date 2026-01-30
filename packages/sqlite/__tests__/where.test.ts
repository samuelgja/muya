import { createTable } from '../src/table'
import { bunMemoryBackend } from '../src/table/bun-backend'
import { type Where } from '../src/table/where'

describe('where clauses', () => {
  const backend = bunMemoryBackend()

  it('should handle where where array of conditions', async () => {
    const tableNestedOptional = await createTable<{ id: string; content?: string }>({
      backend,
      tableName: 'TestTableNestedOptional',
      key: 'id',
      indexes: ['content'],
    })

    await tableNestedOptional.set({ id: '1', content: 'The quick brown fox' })
    await tableNestedOptional.set({ id: '2', content: 'The jumps over the lazy dog' })
    await tableNestedOptional.set({ id: '3' }) // No `content` field

    const results: { id: string; content?: string }[] = []
    for await (const doc of tableNestedOptional.search({
      where: { content: { like: ['The%'] } },
    })) {
      results.push(doc)
    }
    expect(results.length).toBe(2)
    expect(results[0].id).toBe('1')
  })
  it('should create nested index for optional nested fields', async () => {
    type TestDoc = { id: string; info?: { content?: string } }
    const tableNestedOptional = await createTable<TestDoc>({
      backend,
      tableName: 'TestTableNestedOptional',
      key: 'id',
      indexes: ['fts:info.content'],
    })

    await tableNestedOptional.set({ id: '1', info: { content: 'The quick brown fox' } })
    await tableNestedOptional.set({ id: '2', info: { content: 'jumps over the lazy dog' } })
    await tableNestedOptional.set({ id: '3' }) // No `info` field

    const results: TestDoc[] = []
    for await (const doc of tableNestedOptional.search({
      where: { info: { content: { like: ['The%'] } } },
    })) {
      results.push(doc)
    }
    expect(results.length).toBe(1)
    expect(results[0].id).toBe('1')

    const results2: TestDoc[] = []
    for await (const doc of tableNestedOptional.search({
      where: { OR: [{ info: { content: { like: ['The%'] } } }, { info: { content: { like: ['jumps%'] } } }] },
    })) {
      results2.push(doc)
    }
    expect(results2.length).toBe(2)

    const results3: TestDoc[] = []
    for await (const doc of tableNestedOptional.search({
      where: { info: { content: 'nonexistent' } },
    })) {
      results3.push(doc)
    }
    expect(results3.length).toBe(0)
  })
  it('should handle FTS queries', async () => {
    const tableFts = await createTable<{ id: string; content: string }>({
      backend,
      tableName: 'TestTableFts',
      key: 'id',
      indexes: ['fts:content'],
    })

    await tableFts.set({ id: '1', content: 'The quick brown fox' })
    await tableFts.set({ id: '2', content: 'Jumps over the lazy dog' })
    await tableFts.set({ id: '3', content: 'Another document' })

    const results: { id: string; content: string }[] = []
    for await (const doc of tableFts.search({
      where: { content: { fts: 'quick' } },
    })) {
      results.push(doc)
    }
    expect(results.length).toBe(1)
    expect(results[0].id).toBe('1')
  })

  it('should handle nested where conditions', async () => {
    const tableNested = await createTable<{ id: string; info: { content: string } }>({
      backend,
      tableName: 'TestTableNested',
      key: 'id',
      indexes: ['info.content'],
    })

    await tableNested.set({ id: '1', info: { content: 'Nested quick brown fox' } })
    await tableNested.set({ id: '2', info: { content: 'Nested jumps over the lazy dog' } })

    const results: { id: string; info: { content: string } }[] = []
    for await (const doc of tableNested.search({
      where: { info: { content: { like: 'Nested%' } } },
    })) {
      results.push(doc)
    }
    expect(results.length).toBe(2)
  })

  it('should handle complex operators', async () => {
    const tableComplex = await createTable<{ id: string; value: number }>({
      backend,
      tableName: 'TestTableComplex',
      key: 'id',
      indexes: ['value'],
    })

    await tableComplex.set({ id: '1', value: 10 })
    await tableComplex.set({ id: '2', value: 20 })
    await tableComplex.set({ id: '3', value: 30 })

    const results: { id: string; value: number }[] = []
    for await (const doc of tableComplex.search({
      where: { value: { gt: 15, lt: 25 } },
      sortBy: 'value',
    })) {
      results.push(doc)
    }
    expect(results.length).toBe(1)
    expect(results[0].id).toBe('2')
  })

  it('should handle NOT conditions', async () => {
    const tableNot = await createTable<{ id: string; value: string }>({
      backend,
      tableName: 'TestTableNot',
      key: 'id',
      indexes: ['value'],
    })

    await tableNot.set({ id: '1', value: 'apple' })
    await tableNot.set({ id: '2', value: 'banana' })
    await tableNot.set({ id: '3', value: 'cherry' })

    const results: { id: string; value: string }[] = []
    for await (const doc of tableNot.search({
      where: { NOT: { value: 'banana' } },
    })) {
      results.push(doc)
    }
    expect(results.length).toBe(2)
    expect(results.map((doc) => doc.value)).toEqual(['apple', 'cherry'])
  })

  it('should handle AND conditions', async () => {
    const tableAnd = await createTable<{ id: string; category: string; price: number }>({
      backend,
      tableName: 'TestTableAnd',
      key: 'id',
      indexes: ['category', 'price'],
    })

    await tableAnd.set({ id: '1', category: 'fruit', price: 10 })
    await tableAnd.set({ id: '2', category: 'fruit', price: 20 })
    await tableAnd.set({ id: '3', category: 'vegetable', price: 15 })

    const results: { id: string; category: string; price: number }[] = []
    for await (const doc of tableAnd.search({
      where: { AND: [{ category: 'fruit' }, { price: { lt: 15 } }] },
    })) {
      results.push(doc)
    }
    expect(results.length).toBe(1)
    expect(results[0].id).toBe('1')
  })

  it('should handle OR conditions', async () => {
    const tableOr = await createTable<{ id: string; type: string }>({
      backend,
      tableName: 'TestTableOr',
      key: 'id',
      indexes: ['type'],
    })

    await tableOr.set({ id: '1', type: 'A' })
    await tableOr.set({ id: '2', type: 'B' })
    await tableOr.set({ id: '3', type: 'C' })

    const results: { id: string; type: string }[] = []
    for await (const doc of tableOr.search({
      where: { OR: [{ type: 'A' }, { type: 'C' }] },
    })) {
      results.push(doc)
    }
    expect(results.length).toBe(2)
    expect(results.map((doc) => doc.type)).toEqual(['A', 'C'])
  })

  it('should handle nested AND/OR/NOT conditions', async () => {
    const tableNestedLogic = await createTable<{ id: string; category: string; price: number }>({
      backend,
      tableName: 'TestTableNestedLogic',
      key: 'id',
      indexes: ['category', 'price'],
    })

    await tableNestedLogic.set({ id: '1', category: 'fruit', price: 10 })
    await tableNestedLogic.set({ id: '2', category: 'fruit', price: 20 })
    await tableNestedLogic.set({ id: '3', category: 'fruit', price: 15 })

    const whereClause: Where<{ category: string; price: number }> = {
      AND: [
        { category: { is: 'fruit' } },
        {
          OR: [{ price: { lt: 15 } }, { price: { is: 15 } }],
        },
      ],
    }

    const allData: { id: string; category: string; price: number }[] = []
    for await (const doc of tableNestedLogic.search({})) {
      allData.push(doc)
    }
    expect(allData.length).toBe(3)

    const results: { id: string; category: string; price: number }[] = []
    for await (const doc of tableNestedLogic.search({
      where: whereClause,
    })) {
      results.push(doc)
    }

    expect(results.length).toBe(2)
  })

  it('should handle in operator with multiple values', async () => {
    const tableIn = await createTable<{ id: string; status: string }>({
      backend,
      tableName: 'TestTableIn',
      key: 'id',
      indexes: ['status'],
    })

    await tableIn.set({ id: '1', status: 'active' })
    await tableIn.set({ id: '2', status: 'pending' })
    await tableIn.set({ id: '3', status: 'inactive' })
    await tableIn.set({ id: '4', status: 'active' })

    const results: { id: string; status: string }[] = []
    for await (const doc of tableIn.search({
      where: { status: { in: ['active', 'pending'] } },
    })) {
      results.push(doc)
    }
    expect(results.length).toBe(3)
    expect(results.map((d) => d.id).toSorted((a, b) => a.localeCompare(b))).toEqual(['1', '2', '4'])
  })

  it('should handle in operator with empty array (matches nothing)', async () => {
    const tableInEmpty = await createTable<{ id: string; status: string }>({
      backend,
      tableName: 'TestTableInEmpty',
      key: 'id',
      indexes: ['status'],
    })

    await tableInEmpty.set({ id: '1', status: 'active' })
    await tableInEmpty.set({ id: '2', status: 'pending' })

    const results: { id: string; status: string }[] = []
    for await (const doc of tableInEmpty.search({
      where: { status: { in: [] } },
    })) {
      results.push(doc)
    }
    expect(results.length).toBe(0)
  })

  it('should handle in operator on nested fields', async () => {
    type NestedDoc = { id: string; document: { documentId: string; title: string } }
    const tableNestedIn = await createTable<NestedDoc>({
      backend,
      tableName: 'TestTableNestedIn',
      key: 'id',
      indexes: ['document.documentId'],
    })

    await tableNestedIn.set({ id: '1', document: { documentId: 'doc-1', title: 'First' } })
    await tableNestedIn.set({ id: '2', document: { documentId: 'doc-2', title: 'Second' } })
    await tableNestedIn.set({ id: '3', document: { documentId: 'doc-3', title: 'Third' } })

    const results: NestedDoc[] = []
    for await (const doc of tableNestedIn.search({
      where: { document: { documentId: { in: ['doc-1', 'doc-3'] } } },
    })) {
      results.push(doc)
    }
    expect(results.length).toBe(2)
    expect(results.map((d) => d.id).toSorted((a, b) => a.localeCompare(b))).toEqual(['1', '3'])
  })

  it('should handle notIn operator', async () => {
    const tableNotIn = await createTable<{ id: string; category: string }>({
      backend,
      tableName: 'TestTableNotIn',
      key: 'id',
      indexes: ['category'],
    })

    await tableNotIn.set({ id: '1', category: 'A' })
    await tableNotIn.set({ id: '2', category: 'B' })
    await tableNotIn.set({ id: '3', category: 'C' })

    const results: { id: string; category: string }[] = []
    for await (const doc of tableNotIn.search({
      where: { category: { notIn: ['A', 'C'] } },
    })) {
      results.push(doc)
    }
    expect(results.length).toBe(1)
    expect(results[0].category).toBe('B')
  })

  it('should handle notIn operator with empty array (matches everything)', async () => {
    const tableNotInEmpty = await createTable<{ id: string; category: string }>({
      backend,
      tableName: 'TestTableNotInEmpty',
      key: 'id',
      indexes: ['category'],
    })

    await tableNotInEmpty.set({ id: '1', category: 'A' })
    await tableNotInEmpty.set({ id: '2', category: 'B' })

    const results: { id: string; category: string }[] = []
    for await (const doc of tableNotInEmpty.search({
      where: { category: { notIn: [] } },
    })) {
      results.push(doc)
    }
    // Empty notIn should match everything (nothing is excluded)
    expect(results.length).toBe(2)
  })
})
