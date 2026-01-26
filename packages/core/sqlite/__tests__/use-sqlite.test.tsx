/* eslint-disable jsdoc/require-jsdoc */
import { act, renderHook } from '@testing-library/react-hooks'
import { createSqliteState } from '../create-sqlite'
import { useSqliteValue } from '../use-sqlite'
import { waitFor } from '@testing-library/react'
import { bunMemoryBackend } from '../table/bun-backend'
import { StrictMode, Suspense, useState } from 'react'
import { DEFAULT_PAGE_SIZE } from '../table/table'

const backend = bunMemoryBackend()
interface Person {
  id: string
  name: string
  age: number
}

function Wrapper({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <StrictMode>
      <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
    </StrictMode>
  )
}

/**
 * Generate mock people for testing
 * @param count Number of people to generate
 * @returns Array of Person objects
 */
function generatePeople(count: number): Person[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `person-${index}`,
    name: `Person ${index}`,
    age: 20 + (index % 60),
  }))
}

describe('use-sqlite-state', () => {
  it('should get basic value states', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'State1', key: 'id' })
    let reRenders = 0
    const { result, rerender } = renderHook(
      () => {
        reRenders++
        const aha = useSqliteValue(sql)
        return aha
      },
      { wrapper: Wrapper },
    )

    // Initial sync render = 1
    expect(reRenders).toBe(1)

    // Wait for initial data load
    await waitFor(() => {
      expect(result.current[0]).toEqual([])
    })
    const initialRenders = reRenders

    act(() => {
      sql.set({ id: '1', name: 'Alice', age: 30 })
    })
    await waitFor(() => {
      expect(result.current[0]).toEqual([{ id: '1', name: 'Alice', age: 30 }])
    })
    const afterFirstSet = reRenders

    act(() => {
      sql.set({ id: '1', name: 'Alice2', age: 30 })
    })
    await waitFor(() => {
      expect(result.current[0]).toEqual([{ id: '1', name: 'Alice2', age: 30 }])
    })

    // delete item
    act(() => {
      sql.delete('1')
    })
    await waitFor(() => {
      expect(result.current[0]).toEqual([])
    })

    // add two items
    act(() => {
      sql.set({ id: '1', name: 'Alice', age: 30 })
      sql.set({ id: '2', name: 'Bob', age: 25 })
    })
    await waitFor(() => {
      expect(result.current[0]?.length).toBe(2)
    })

    const beforeManualRerender = reRenders
    act(() => {
      rerender()
    })
    await waitFor(() => {
      expect(reRenders).toBe(beforeManualRerender + 1)
      expect(result.current[0]?.length).toBe(2)
    })

    // Verify re-renders happened (at least initial + operations)
    expect(afterFirstSet).toBeGreaterThan(initialRenders)
  })

  it('should use where clause changed via state', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'State2', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
      { id: '3', name: 'Carol', age: 40 },
    ])
    let reRenders = 0
    const { result } = renderHook(() => {
      reRenders++
      const [minAge, setMinAge] = useState(20)
      return [useSqliteValue(sql, { where: { age: { gt: minAge } }, sortBy: 'age' }, [minAge]), setMinAge] as const
    })

    await waitFor(() => {
      const names = result.current?.[0][0]?.map((p) => p.name)
      expect(names).toEqual(['Bob', 'Alice', 'Carol'])
    })
    const initialRenders = reRenders

    // change minAge to 29
    act(() => {
      result.current[1](29)
    })
    await waitFor(() => {
      const names = result.current?.[0][0]?.map((p) => p.name)
      expect(names).toEqual(['Alice', 'Carol'])
    })
    // Deps change should trigger re-renders (stale + data load)
    expect(reRenders).toBeGreaterThan(initialRenders)
  })

  it('should handle rapid dependency changes without excessive re-renders', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'RapidDepsChange', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
      { id: '3', name: 'Carol', age: 40 },
      { id: '4', name: 'Dave', age: 35 },
    ])

    let reRenders = 0
    const staleLog: Array<{ render: number; isStale: boolean; filterAge: number; dataLength: number | undefined }> = []

    const { result } = renderHook(() => {
      reRenders++
      const [filterAge, setFilterAge] = useState(20)
      const [data, actions] = useSqliteValue(sql, { where: { age: { gt: filterAge } }, sortBy: 'age' }, [filterAge])
      staleLog.push({ render: reRenders, isStale: actions.isStale, filterAge, dataLength: data?.length })
      return { data, isStale: actions.isStale, setFilterAge }
    })

    await waitFor(() => {
      expect(result.current.data?.length).toBe(4)
      expect(result.current.isStale).toBe(false)
    })
    const beforeRapidChanges = reRenders
    staleLog.length = 0 // Clear log for the interesting part

    // Change deps rapidly: 20 -> 25 -> 30 -> 35 in quick succession (within same act)
    act(() => {
      result.current.setFilterAge(25)
      result.current.setFilterAge(30)
      result.current.setFilterAge(35)
    })

    // isStale should be true immediately after deps change
    expect(result.current.isStale).toBe(true)

    // Wait for final data to load
    await waitFor(() => {
      expect(result.current.isStale).toBe(false)
      // Only Carol (age 40) is > 35
      expect(result.current.data?.length).toBe(1)
      expect(result.current.data?.[0]?.name).toBe('Carol')
    })

    const afterRapidChanges = reRenders
    const rendersForRapidChanges = afterRapidChanges - beforeRapidChanges

    // eslint-disable-next-line no-console
    console.log(`🔄 Rapid dep changes (3 setState calls in 1 act): ${rendersForRapidChanges} renders`)
    // eslint-disable-next-line no-console
    console.log('📋 Stale log:', staleLog)

    // With batched setState, React batches the 3 calls into 1 render with filterAge=35
    // Then we get: 1 render (batched setState) + 1 render (setSettledDeps) = 2 renders
    // This demonstrates the optimization: rapid changes don't cause multiple stale cycles
    expect(rendersForRapidChanges).toBeLessThanOrEqual(4)
  })

  it('should handle sequential dependency changes with proper stale tracking', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'SequentialDepsChange', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
      { id: '3', name: 'Carol', age: 40 },
    ])

    let reRenders = 0
    const { result } = renderHook(() => {
      reRenders++
      const [filterAge, setFilterAge] = useState(20)
      const [data, actions] = useSqliteValue(sql, { where: { age: { gt: filterAge } }, sortBy: 'age' }, [filterAge])
      return { data, isStale: actions.isStale, setFilterAge }
    })

    await waitFor(() => {
      expect(result.current.data?.length).toBe(3)
      expect(result.current.isStale).toBe(false)
    })
    const afterInitialLoad = reRenders

    // First change: 20 -> 25
    act(() => {
      result.current.setFilterAge(25)
    })
    expect(result.current.isStale).toBe(true)

    await waitFor(() => {
      expect(result.current.isStale).toBe(false)
      expect(result.current.data?.length).toBe(2) // Alice (30) and Carol (40)
    })
    const afterFirstChange = reRenders

    // Second change: 25 -> 35
    act(() => {
      result.current.setFilterAge(35)
    })
    expect(result.current.isStale).toBe(true)

    await waitFor(() => {
      expect(result.current.isStale).toBe(false)
      expect(result.current.data?.length).toBe(1) // Only Carol (40)
    })
    const afterSecondChange = reRenders

    // Each dep change should cause ~2 re-renders: 1 for setState + 1 for setSettledDeps
    const rendersPerChange1 = afterFirstChange - afterInitialLoad
    const rendersPerChange2 = afterSecondChange - afterFirstChange

    // eslint-disable-next-line no-console
    console.log(`🔄 Sequential dep changes: ${rendersPerChange1} renders for 1st, ${rendersPerChange2} renders for 2nd`)

    // Should be 2-3 renders per change (setState + data load + setSettledDeps)
    expect(rendersPerChange1).toBeLessThanOrEqual(4)
    expect(rendersPerChange2).toBeLessThanOrEqual(4)
  })

  it('should support like in where clause and update results', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'State3Hook', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Alicia', age: 25 },
      { id: '3', name: 'Bob', age: 40 },
    ])
    let reRenders = 0
    const { result, rerender } = renderHook(
      ({ like }) => {
        reRenders++
        return useSqliteValue(sql, { where: { name: { like } } }, [like])
      },
      { initialProps: { like: '%Ali%' } },
    )
    await waitFor(() => {
      expect(result.current?.[0]?.map((p) => p.name)).toEqual(['Alice', 'Alicia'])
    })
    act(() => {
      rerender({ like: '%Bob%' })
    })
    await waitFor(() => {
      expect(result.current?.[0]?.map((p) => p.name)).toEqual(['Bob'])
    })
    expect(reRenders).toBeGreaterThanOrEqual(2)
  })

  it('should update results when changing order and limit options 1', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'State44Hook', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
      { id: '3', name: 'Carol', age: 40 },
    ])
    const { result, rerender } = renderHook(
      ({ order, limit }) => useSqliteValue(sql, { sortBy: 'age', order, limit }, [order, limit]),
      { initialProps: { order: 'asc' as 'asc' | 'desc', limit: 2 } },
    )
    await waitFor(() => {
      expect(result.current?.[0]?.map((p) => p.name)).toEqual(['Bob', 'Alice'])
    })
    act(() => {
      rerender({ order: 'desc', limit: 2 })
    })
    await waitFor(() => {
      expect(result.current?.[0]?.map((p) => p.name)).toEqual(['Carol', 'Alice'])
    })
    act(() => {
      rerender({ order: 'desc', limit: 1 })
    })
    await waitFor(() => {
      expect(result.current?.[0]?.map((p) => p.name)).toEqual(['Carol'])
    })
  })

  it('should support actions.next and actions.refresh', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'State5Hook', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
    ])
    const { result } = renderHook(() => useSqliteValue(sql, {}, []))
    // actions.next and actions.refresh should be functions
    await waitFor(() => {
      expect(typeof result.current[1].nextPage).toBe('function')
      expect(typeof result.current[1].reset).toBe('function')
    })
  })
  it('should handle thousands of records Here', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'State6Hook', key: 'id' })
    const people: Person[] = []
    const ITEMS_COUNT = 1000
    for (let index = 1; index <= ITEMS_COUNT; index++) {
      people.push({ id: index.toString(), name: `Person${index}`, age: 20 + (index % 50) })
    }
    await sql.batchSet(people)
    const { result } = renderHook(() => useSqliteValue(sql, {}, []))
    await waitFor(() => {
      expect(result.current?.[0]?.length ?? 0).toBe(DEFAULT_PAGE_SIZE)
    })

    // // loop until we have all ITEMS_COUNT items
    for (let index = 0; index < ITEMS_COUNT / DEFAULT_PAGE_SIZE; index++) {
      act(() => {
        result.current[1].nextPage()
      })
      await waitFor(() => {
        expect(result.current?.[0]?.length).toBe(Math.min(DEFAULT_PAGE_SIZE * (index + 2), ITEMS_COUNT))
      })
    }

    act(() => {
      result.current[1].reset()
    })
    await waitFor(() => {
      expect(result.current?.[0]?.length).toBe(DEFAULT_PAGE_SIZE)
    })
  })

  it('should handle thousands of records with single update', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'State6Hook', key: 'id' })
    const people: Person[] = []
    const ITEMS_COUNT = 10_000
    const pageSize = 500
    for (let index = 1; index <= ITEMS_COUNT; index++) {
      people.push({ id: index.toString(), name: `Person${index}`, age: 20 + (index % 50) })
    }
    await sql.batchSet(people)
    let reRenders = 0
    const { result } = renderHook(() => {
      reRenders++
      return useSqliteValue(sql, { pageSize }, [])
    })
    await waitFor(() => {
      expect(result.current?.[0]?.length).toBe(pageSize)
    })
    const initialRenders = reRenders

    act(() => {
      for (let index = 0; index < (ITEMS_COUNT - pageSize) / pageSize; index++) {
        result.current[1].nextPage()
      }
    })

    await waitFor(() => {
      expect(result.current?.[0]?.length).toBe(ITEMS_COUNT)
    })
    const afterPagination = reRenders

    act(() => {
      result.current[1].reset()
    })
    await waitFor(() => {
      expect(result.current?.[0]?.length).toBe(pageSize)
    })

    // Verify pagination and reset caused re-renders
    expect(afterPagination).toBeGreaterThan(initialRenders)
    expect(reRenders).toBeGreaterThan(afterPagination)
  })
  it('should change ordering', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'State7', key: 'id', indexes: ['age'] })
    const people: Person[] = []
    for (let index = 1; index <= 100; index++) {
      people.push({ id: index.toString(), name: `Person${index}`, age: 20 + (index % 50) })
    }
    await sql.batchSet(people)
    const { result, rerender } = renderHook(({ order }) => useSqliteValue(sql, { sortBy: 'age', order }, [order]), {
      initialProps: { order: 'asc' as 'asc' | 'desc' },
    })
    await waitFor(() => {
      expect(result.current?.[0]?.[0]?.age).toBe(20)
    })
    act(() => {
      rerender({ order: 'desc' })
    })
    await waitFor(() => {
      expect(result.current?.[0]?.[0]?.age).toBe(69)
    })
  })

  it('should support selector in options', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'State8', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
      { id: '3', name: 'Carol', age: 40 },
    ])
    const { result } = renderHook(() =>
      useSqliteValue(
        sql,
        {
          sortBy: 'age',
          select: (d) => d.name,
        },
        [],
      ),
    )
    await waitFor(() => {
      expect(result.current[0]).toEqual(['Bob', 'Alice', 'Carol'])
    })
  })
  it('should add 50 documents and then load with another hook', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'State9', key: 'id' })
    let reRenders = 0
    const { result: result1 } = renderHook(() => {
      reRenders++
      return useSqliteValue(
        sql,
        {
          sortBy: 'age',
          order: 'desc',
        },
        [],
      )
    })
    await waitFor(() => {
      // Initially empty
      expect(result1.current?.[0]?.length ?? 0).toBeLessThanOrEqual(1)
    })
    const initialRenders = reRenders

    const people: Person[] = []
    for (let index = 1; index <= 50; index++) {
      people.push({ id: index.toString(), name: `Person${index}`, age: 20 + (index % 50) })
    }
    await sql.batchSet(people)
    await waitFor(() => {
      expect(result1.current?.[0]?.length).toBe(50)
    })
    // Data load should trigger re-renders
    expect(reRenders).toBeGreaterThan(initialRenders)

    const { result: result2 } = renderHook(() => useSqliteValue(sql, {}, []))
    await waitFor(() => {
      expect(result2.current?.[0]?.length).toBe(50)
    })
  })

  it('should handle update of deep fields with deep id', async () => {
    interface DeepItem {
      person: {
        id: string
        name: string
        age: number
      }
    }
    const sql = createSqliteState<DeepItem>({ backend, tableName: 'State10', key: 'person.id' })
    let reRenders = 0
    const { result } = renderHook(() => {
      reRenders++
      return useSqliteValue(sql, { sortBy: 'person.age' }, [])
    })

    await waitFor(() => {
      expect(result.current?.[0]?.length).toBe(0)
    })
    const initialRenders = reRenders

    act(() => {
      sql.set({ person: { id: 'some_id', name: 'Alice', age: 30 } })
    })
    await waitFor(() => {
      expect(result.current[0]).toEqual([{ person: { id: 'some_id', name: 'Alice', age: 30 } }])
    })
    const afterFirstSet = reRenders

    // update deep field
    act(() => {
      sql.set({ person: { id: 'some_id', name: 'Alice', age: 31 } })
    })
    await waitFor(() => {
      expect(result.current[0]).toEqual([{ person: { id: 'some_id', name: 'Alice', age: 31 } }])
    })

    // Each set should trigger re-renders
    expect(afterFirstSet).toBeGreaterThan(initialRenders)
    expect(reRenders).toBeGreaterThan(afterFirstSet)

    // update same field
    act(() => {
      sql.set({ person: { id: 'some_id', name: 'Alice', age: 31 } })
    })
    // should not re-render
    await waitFor(() => {
      expect(result.current[0]).toEqual([{ person: { id: 'some_id', name: 'Alice', age: 31 } }])
    })

    // add another item
  })
  it('should test reset', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'State11', key: 'id' })
    let reRenders = 0

    await sql.set({ id: 'initial', name: 'initial', age: 1 })
    const { result } = renderHook(() => {
      reRenders++
      // eslint-disable-next-line unicorn/prevent-abbreviations
      const res = useSqliteValue(sql, {}, [])
      return res
    })

    await waitFor(() => {
      expect(result.current?.[0]?.length).toBe(1)
    })
    const initialRenders = reRenders

    act(() => {
      sql.set({ id: '1', name: 'Alice', age: 30 })
    })
    await waitFor(() => {
      expect(result.current?.[0]?.length).toBe(2)
    })
    const afterSet = reRenders

    act(() => {
      result.current[1].reset()
    })
    await waitFor(() => {
      expect(result.current?.[0]?.length).toBe(2)
    })

    // Set and reset should trigger re-renders
    expect(afterSet).toBeGreaterThan(initialRenders)
    expect(reRenders).toBeGreaterThan(afterSet)
  })

  it('should handle no items in the database', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'EmptyState', key: 'id' })
    const { result } = renderHook(() => useSqliteValue(sql, {}, []))

    await waitFor(() => {
      expect(result.current[0]).toEqual([])
    })
  })

  it('should handle fewer items than page size', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'FewItemsState', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
    ])

    const { result } = renderHook(() => useSqliteValue(sql, {}, []))

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
      ])
    })
  })

  it('should handle exactly page size items', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'ExactPageSizeState', key: 'id' })
    const items = Array.from({ length: DEFAULT_PAGE_SIZE }, (_, index) => ({
      id: `${index + 1}`,
      name: `Person${index + 1}`,
      age: 20 + (index % 50),
    }))
    await sql.batchSet(items)

    const { result } = renderHook(() => useSqliteValue(sql, {}, []))

    await waitFor(() => {
      expect(result.current[0]?.length).toBe(DEFAULT_PAGE_SIZE)
    })
  })

  it('should have thousands items, and update in middle check', async () => {
    let reRenders = 0
    const sql = createSqliteState<Person>({ backend, tableName: 'ManyItemsState', key: 'id' })
    const ITEMS_COUNT = 1000
    const people: Person[] = []
    for (let index = 1; index <= ITEMS_COUNT; index++) {
      people.push({ id: index.toString(), name: `Person${index}`, age: 20 + (index % 50) })
    }
    await sql.batchSet(people)

    const { result } = renderHook(() => {
      reRenders++
      return useSqliteValue(sql, { pageSize: 100 }, [])
    })

    await waitFor(() => {
      expect(result.current[0]?.length).toBe(100)
    })
    const initialRenders = reRenders

    act(() => {
      for (let index = 0; index < (ITEMS_COUNT - 100) / 100; index++) {
        result.current[1].nextPage()
      }
    })
    await waitFor(() => {
      expect(result.current[0]?.length).toBe(ITEMS_COUNT)
    })
    const afterPagination = reRenders

    act(() => {
      sql.set({ id: '500', name: 'UpdatedPerson500', age: 99 })
    })

    await waitFor(() => {
      const updated = result.current[0]?.find((p) => p.id === '500')
      expect(updated).toEqual({ id: '500', name: 'UpdatedPerson500', age: 99 })
      expect(result.current[0]?.length).toBe(ITEMS_COUNT)
    })

    // Pagination and update should cause re-renders
    expect(afterPagination).toBeGreaterThan(initialRenders)
    expect(reRenders).toBeGreaterThan(afterPagination)
  })
  it("should test batch delete and its impact on the hook's results", async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'BatchDeleteState', key: 'id' })
    const people: Person[] = []
    for (let index = 1; index <= 20; index++) {
      people.push({ id: index.toString(), name: `Person${index}`, age: 20 + (index % 50) })
    }
    await sql.batchSet(people)

    let reRenders = 0
    const { result } = renderHook(() => {
      reRenders++
      return useSqliteValue(sql, {}, [])
    })

    await waitFor(() => {
      expect(result.current[0]?.length).toBe(20)
    })
    const initialRenders = reRenders

    act(() => {
      sql.batchDelete(['5', '10', '15'])
    })

    await waitFor(() => {
      expect(result.current[0]?.length).toBe(17)
      expect(result.current[0]?.find((p) => p.id === '5')).toBeUndefined()
      expect(result.current[0]?.find((p) => p.id === '10')).toBeUndefined()
      expect(result.current[0]?.find((p) => p.id === '15')).toBeUndefined()
    })
    // Batch delete should trigger re-render
    expect(reRenders).toBeGreaterThan(initialRenders)
  })
})

/* eslint-disable no-console */
describe('use-sqlite-state performance benchmarks', () => {
  describe('timing benchmarks', () => {
    it('benchmark: initial load 100 items', async () => {
      const testBackend = bunMemoryBackend()
      const sql = createSqliteState<Person>({ backend: testBackend, tableName: 'Bench100', key: 'id', indexes: ['age'] })
      await sql.batchSet(generatePeople(100))

      const start = performance.now()
      const { result } = renderHook(() => useSqliteValue(sql, { pageSize: 100 }, []))

      await waitFor(() => {
        expect(result.current[0]?.length).toBe(100)
      })

      const duration = performance.now() - start
      console.log('📊 100 items initial load:', duration.toFixed(2), 'ms')
      expect(duration).toBeLessThan(500)
    })

    it('benchmark: initial load 1000 items', async () => {
      const testBackend = bunMemoryBackend()
      const sql = createSqliteState<Person>({ backend: testBackend, tableName: 'Bench1000', key: 'id', indexes: ['age'] })
      await sql.batchSet(generatePeople(1000))

      const start = performance.now()
      const { result } = renderHook(() => useSqliteValue(sql, { pageSize: 1000 }, []))

      await waitFor(() => {
        expect(result.current[0]?.length).toBe(1000)
      })

      const duration = performance.now() - start
      console.log('📊 1000 items initial load:', duration.toFixed(2), 'ms')
      expect(duration).toBeLessThan(2000)
    })

    it('benchmark: initial load 5000 items', async () => {
      const testBackend = bunMemoryBackend()
      const sql = createSqliteState<Person>({ backend: testBackend, tableName: 'Bench5000', key: 'id', indexes: ['age'] })
      await sql.batchSet(generatePeople(5000))

      const start = performance.now()
      const { result } = renderHook(() => useSqliteValue(sql, { pageSize: 5000 }, []))

      await waitFor(() => {
        expect(result.current[0]?.length).toBe(5000)
      })

      const duration = performance.now() - start
      console.log('📊 5000 items initial load:', duration.toFixed(2), 'ms')
      expect(duration).toBeLessThan(5000)
    })

    it('benchmark: where clause filtering on 5000 items', async () => {
      const testBackend = bunMemoryBackend()
      const sql = createSqliteState<Person>({ backend: testBackend, tableName: 'BenchWhere5000', key: 'id', indexes: ['age'] })
      await sql.batchSet(generatePeople(5000))

      const start = performance.now()
      const { result } = renderHook(() => useSqliteValue(sql, { where: { age: { gte: 50 } }, pageSize: 5000 }, []))

      await waitFor(() => {
        expect(result.current[0]?.length).toBeGreaterThan(0)
      })

      const duration = performance.now() - start
      console.log('📊 5000 items WHERE filter:', duration.toFixed(2), 'ms', '| matched:', result.current[0]?.length)
      expect(duration).toBeLessThan(2000)
    })

    it('benchmark: rapid sequential updates', async () => {
      const testBackend = bunMemoryBackend()
      const sql = createSqliteState<Person>({ backend: testBackend, tableName: 'BenchRapid', key: 'id', indexes: ['age'] })
      await sql.batchSet(generatePeople(100))

      const { result } = renderHook(() => useSqliteValue(sql, { pageSize: 200 }, []))

      await waitFor(() => {
        expect(result.current[0]?.length).toBe(100)
      })

      const updateCount = 50
      const start = performance.now()

      for (let index = 0; index < updateCount; index++) {
        await act(async () => {
          await sql.set({ id: `rapid-${index}`, name: `Rapid ${index}`, age: 25 })
        })
      }

      await waitFor(() => {
        expect(result.current[0]?.length).toBe(150)
      })

      const duration = performance.now() - start
      console.log(
        '📊',
        updateCount,
        'rapid inserts:',
        duration.toFixed(2),
        'ms',
        '| avg:',
        (duration / updateCount).toFixed(2),
        'ms/op',
      )
      expect(duration).toBeLessThan(3000)
    })

    it('benchmark: pagination load all pages', async () => {
      const testBackend = bunMemoryBackend()
      const sql = createSqliteState<Person>({ backend: testBackend, tableName: 'BenchPagination', key: 'id', indexes: ['age'] })
      const totalItems = 500
      const pageSize = 50
      await sql.batchSet(generatePeople(totalItems))

      const { result } = renderHook(() => useSqliteValue(sql, { pageSize }, []))

      await waitFor(() => {
        expect(result.current[0]?.length).toBe(pageSize)
      })

      const start = performance.now()
      const totalPages = Math.ceil(totalItems / pageSize) - 1

      for (let page = 0; page < totalPages; page++) {
        await act(async () => {
          await result.current[1].nextPage()
        })
      }

      await waitFor(() => {
        expect(result.current[0]?.length).toBe(totalItems)
      })

      const duration = performance.now() - start
      console.log(
        '📊',
        totalPages,
        'page loads:',
        duration.toFixed(2),
        'ms',
        '| avg:',
        (duration / totalPages).toFixed(2),
        'ms/page',
      )
      expect(duration).toBeLessThan(2000)
    })
  })

  describe('re-render analysis', () => {
    it('analyze: re-renders on initial load', async () => {
      const testBackend = bunMemoryBackend()
      const sql = createSqliteState<Person>({ backend: testBackend, tableName: 'RenderInit', key: 'id' })
      await sql.batchSet(generatePeople(50))

      let renderCount = 0
      const { result } = renderHook(() => {
        renderCount++
        return useSqliteValue(sql, { pageSize: 50 }, [])
      })

      await waitFor(() => {
        expect(result.current[0]?.length).toBe(50)
      })

      console.log('🔄 Initial load renders:', renderCount)
      expect(renderCount).toBeLessThanOrEqual(3)
    })

    it('analyze: re-renders on single insert', async () => {
      const testBackend = bunMemoryBackend()
      const sql = createSqliteState<Person>({ backend: testBackend, tableName: 'RenderInsert', key: 'id' })
      await sql.batchSet(generatePeople(10))

      let renderCount = 0
      const { result } = renderHook(() => {
        renderCount++
        return useSqliteValue(sql, { pageSize: 50 }, [])
      })

      await waitFor(() => {
        expect(result.current[0]?.length).toBe(10)
      })

      const rendersBefore = renderCount

      await act(async () => {
        await sql.set({ id: 'new-item', name: 'New Person', age: 30 })
      })

      await waitFor(() => {
        expect(result.current[0]?.length).toBe(11)
      })

      const rendersForInsert = renderCount - rendersBefore
      console.log('🔄 Single insert renders:', rendersForInsert)
      expect(rendersForInsert).toBeLessThanOrEqual(2)
    })

    it('analyze: re-renders on update with same data (shallow equal)', async () => {
      const testBackend = bunMemoryBackend()
      const sql = createSqliteState<Person>({ backend: testBackend, tableName: 'RenderShallow', key: 'id' })
      await sql.set({ id: 'test-1', name: 'Test Person', age: 30 })

      let renderCount = 0
      const { result } = renderHook(() => {
        renderCount++
        return useSqliteValue(sql, { pageSize: 50 }, [])
      })

      await waitFor(() => {
        expect(result.current[0]?.length).toBe(1)
      })

      const rendersBefore = renderCount

      // Update with identical data
      await act(async () => {
        await sql.set({ id: 'test-1', name: 'Test Person', age: 30 })
      })

      // Small delay to ensure any async effects complete
      await new Promise((resolve) => setTimeout(resolve, 50))

      const rendersForSameData = renderCount - rendersBefore
      console.log('🔄 Same data update renders:', rendersForSameData, '(should be 0)')
      expect(rendersForSameData).toBe(0)
    })

    it('analyze: re-renders on update with different data', async () => {
      const testBackend = bunMemoryBackend()
      const sql = createSqliteState<Person>({ backend: testBackend, tableName: 'RenderDiff', key: 'id' })
      await sql.set({ id: 'test-1', name: 'Original', age: 30 })

      let renderCount = 0
      const { result } = renderHook(() => {
        renderCount++
        return useSqliteValue(sql, { pageSize: 50 }, [])
      })

      await waitFor(() => {
        expect(result.current[0]?.[0]?.name).toBe('Original')
      })

      const rendersBefore = renderCount

      await act(async () => {
        await sql.set({ id: 'test-1', name: 'Updated', age: 31 })
      })

      await waitFor(() => {
        expect(result.current[0]?.[0]?.name).toBe('Updated')
      })

      const rendersForUpdate = renderCount - rendersBefore
      console.log('🔄 Different data update renders:', rendersForUpdate)
      expect(rendersForUpdate).toBeLessThanOrEqual(2)
    })

    it('analyze: re-renders on batch operations', async () => {
      const testBackend = bunMemoryBackend()
      const sql = createSqliteState<Person>({ backend: testBackend, tableName: 'RenderBatch', key: 'id' })
      await sql.batchSet(generatePeople(20))

      let renderCount = 0
      const { result } = renderHook(() => {
        renderCount++
        return useSqliteValue(sql, { pageSize: 50 }, [])
      })

      await waitFor(() => {
        expect(result.current[0]?.length).toBe(20)
      })

      const rendersBefore = renderCount

      // Batch delete 5 items
      await act(async () => {
        await sql.batchDelete(['person-0', 'person-1', 'person-2', 'person-3', 'person-4'])
      })

      await waitFor(() => {
        expect(result.current[0]?.length).toBe(15)
      })

      const rendersForBatchDelete = renderCount - rendersBefore
      console.log('🔄 Batch delete (5 items) renders:', rendersForBatchDelete)
      // Batch operations should ideally cause minimal re-renders
      expect(rendersForBatchDelete).toBeLessThanOrEqual(3)
    })

    it('analyze: re-renders on deps change', async () => {
      const testBackend = bunMemoryBackend()
      const sql = createSqliteState<Person>({ backend: testBackend, tableName: 'RenderDeps', key: 'id', indexes: ['age'] })
      await sql.batchSet(generatePeople(100))

      let renderCount = 0
      const { result, rerender } = renderHook(
        ({ minAge }) => {
          renderCount++
          return useSqliteValue(sql, { where: { age: { gte: minAge } }, pageSize: 100 }, [minAge])
        },
        { initialProps: { minAge: 50 } },
      )

      await waitFor(() => {
        expect(result.current[0]?.length).toBeGreaterThan(0)
      })

      const rendersBefore = renderCount

      act(() => {
        rerender({ minAge: 60 })
      })

      await waitFor(() => {
        // eslint-disable-next-line sonarjs/no-nested-functions
        const minAgeInResults = Math.min(...(result.current[0]?.map((p) => p.age) ?? [0]))
        expect(minAgeInResults).toBeGreaterThanOrEqual(60)
      })

      const rendersForDepsChange = renderCount - rendersBefore
      console.log('🔄 Deps change renders:', rendersForDepsChange)
      expect(rendersForDepsChange).toBeLessThanOrEqual(3)
    })
  })
})
