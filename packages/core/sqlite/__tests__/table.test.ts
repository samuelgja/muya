/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable no-shadow */
/* eslint-disable sonarjs/pseudo-random */
// /* eslint-disable sonarjs/no-unused-vars */
// /* eslint-disable unicorn/prevent-abbreviations */

import { bunMemoryBackend } from '../table/bun-backend'
import { createTable } from '../table/table'

interface Person {
  name: string
  age: number
  city: string
}

interface PersonNested {
  info: {
    name: string
    age: number
    city: string
  }
}
describe('table', () => {
  let backend = bunMemoryBackend()
  let table: ReturnType<typeof createTable<Person>> extends Promise<infer T> ? T : never

  let tableNested: ReturnType<typeof createTable<PersonNested>> extends Promise<infer T> ? T : never

  beforeEach(async () => {
    backend = bunMemoryBackend()
    table = await createTable<Person>({
      backend,
      tableName: 'TestTable',
      key: 'name',
    })
    tableNested = await createTable<PersonNested>({
      backend,
      tableName: 'TestTableNested',
      key: 'info.name',
      indexes: ['info.age', 'info.city'],
    })
  })

  it('should set and get items', async () => {
    const mutation = await table.set({ name: 'Alice', age: 30, city: 'Paris' })
    expect(mutation.key).toBe('Alice')
    expect(mutation.op).toBe('insert')
    const result = await table.get('Alice')
    expect(result).toEqual({ name: 'Alice', age: 30, city: 'Paris' })

    const updateMutation = await table.set({ name: 'Alice', age: 31, city: 'Paris' })
    expect(updateMutation.key).toBe('Alice')
    expect(updateMutation.op).toBe('update')
    const updatedResult = await table.get('Alice')
    expect(updatedResult).toEqual({ name: 'Alice', age: 31, city: 'Paris' })
  })

  it('should set and get nested key', async () => {
    const mutation = await tableNested.set({ info: { name: 'Bob', age: 25, city: 'London' } })
    expect(mutation.key).toBe('Bob')
    expect(mutation.op).toBe('insert')
    const result = await tableNested.get('Bob')
    expect(result).toEqual({ info: { name: 'Bob', age: 25, city: 'London' } })

    const updateMutation = await tableNested.set({ info: { name: 'Bob', age: 26, city: 'London' } })
    expect(updateMutation.key).toBe('Bob')
    expect(updateMutation.op).toBe('update')
    const updatedResult = await tableNested.get('Bob')
    expect(updatedResult).toEqual({ info: { name: 'Bob', age: 26, city: 'London' } })

    // nested where query
    const results: PersonNested[] = []
    for await (const person of tableNested.search({
      where: { info: { city: { like: 'London' } } },
    })) {
      results.push(person)
    }
    expect(results.length).toBe(1)
  })

  it('should count items and count with where', async () => {
    await table.set({ name: 'Alice', age: 30, city: 'Paris' })
    await table.set({ name: 'Bob', age: 25, city: 'London' })
    expect(await table.count()).toBe(2)
    expect(await table.count({ where: { city: 'Paris' } })).toBe(1)
  })

  it('should search with ordering, limit and offset', async () => {
    const people: Person[] = [
      { name: 'Alice', age: 30, city: 'Paris' },
      { name: 'Bob', age: 25, city: 'London' },
      { name: 'Carol', age: 35, city: 'Berlin' },
    ]
    for (const p of people) {
      await table.set(p)
    }
    // sort by age ascending
    const asc = [] as Person[]
    for await (const p of table.search({ sortBy: 'age', order: 'asc' })) asc.push(p)
    expect(asc.map((p) => p.name)).toEqual(['Bob', 'Alice', 'Carol'])
    // limit and offset
    const limited = [] as Person[]
    for await (const p of table.search({ sortBy: 'age', order: 'asc', limit: 2 })) limited.push(p)
    expect(limited.map((p) => p.name)).toEqual(['Bob', 'Alice'])
    const offsetted = [] as Person[]
    for await (const p of table.search({ sortBy: 'age', order: 'asc', offset: 1, limit: 2 })) offsetted.push(p)
    expect(offsetted.map((p) => p.name)).toEqual(['Alice', 'Carol'])
  })

  it('should deleteBy where clause', async () => {
    await table.set({ name: 'Dave', age: 40, city: 'NY' })
    await table.set({ name: 'Eve', age: 45, city: 'NY' })
    await table.set({ name: 'Frank', age: 50, city: 'LA' })
    expect(await table.count()).toBe(3)
    await table.deleteBy({ city: 'NY' })
    expect(await table.count()).toBe(1)
    expect(await table.get('Frank')).toEqual({ name: 'Frank', age: 50, city: 'LA' })
    expect(await table.get('Dave')).toBeUndefined()
  })

  it('should use selector in get and search', async () => {
    await table.set({ name: 'Gary', age: 60, city: 'SF' })
    // selector in get
    const ageOnly = await table.get('Gary', ({ age }) => age)
    expect(ageOnly).toBe(60)
    // selector in search
    const cities: string[] = []
    for await (const city of table.search({ select: ({ city }) => city })) cities.push(city)
    expect(cities).toEqual(['SF'])
  })

  it('should delete items by key', async () => {
    await table.set({ name: 'Helen', age: 28, city: 'Rome' })
    expect(await table.get('Helen')).toBeDefined()
    await table.delete('Helen')
    expect(await table.get('Helen')).toBeUndefined()
  })
  it('should test search with 1000 items', async () => {
    const people: Person[] = []
    for (let index = 0; index < 1000; index++) {
      people.push({
        name: `Person${index}`,
        age: Math.floor(Math.random() * 100),
        city: 'City' + (index % 10),
      })
    }
    for (const p of people) {
      await table.set(p)
    }
    const results: Person[] = []
    for await (const person of table.search({ sortBy: 'age', order: 'asc', limit: 100 })) {
      results.push(person)
    }
    expect(results.length).toBe(100)
  })

  it('should handle operations on an empty table', async () => {
    expect(await table.count()).toBe(0)
    expect(await table.get('NonExistent')).toBeUndefined()
    const results: Person[] = []
    for await (const person of table.search({ sortBy: 'age', order: 'asc' })) {
      results.push(person)
    }
    expect(results.length).toBe(0)
  })

  it('should handle duplicate keys gracefully', async () => {
    await table.set({ name: 'Alice', age: 30, city: 'Paris' })
    await table.set({ name: 'Alice', age: 35, city: 'Berlin' })
    const result = await table.get('Alice')
    expect(result).toEqual({ name: 'Alice', age: 35, city: 'Berlin' })
  })

  it('should handle edge cases in selectors', async () => {
    await table.set({ name: 'Charlie', age: 40, city: 'NY' })
    const nullSelector = await table.get('Charlie', () => null)
    expect(nullSelector).toBeNull()
    const undefinedSelector = await table.get('Charlie', () => void 0)
    expect(undefinedSelector).toBeUndefined()
  })
})
