import { createTable } from '../table'
import { bunMemoryBackend } from '../table/bun-backend'

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
    })) {
      results.push(doc)
    }
    expect(results.length).toBe(1)
    expect(results[0].id).toBe('2')
  })
})
