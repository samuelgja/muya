import { act, renderHook } from '@testing-library/react-hooks'
import { createSqliteState } from '../create-sqlite'
import { useSqliteValue } from '../use-sqlite'
import { waitFor } from '@testing-library/react'
import { bunMemoryBackend } from '../table/bun-backend'
import { useState } from 'react'
import { DEFAULT_STEP_SIZE } from '../table/table'

const backend = bunMemoryBackend()
interface Person {
  id: string
  name: string
  age: number
}

describe('use-sqlite-state', () => {
  it('should get basic value states', async () => {
    const sql = await createSqliteState<Person>({ backend, tableName: 'State1', key: 'id' })
    let reRenders = 0
    const { result } = renderHook(() => {
      reRenders++
      return useSqliteValue(sql, {}, [])
    })
    // expect(result.current).toEqual([])

    expect(reRenders).toBe(1)

    act(() => {
      sql.set({ id: '1', name: 'Alice', age: 30 })
    })
    await waitFor(() => {
      expect(result.current[0]).toEqual([{ id: '1', name: 'Alice', age: 30 }])
      expect(reRenders).toBe(3)
    })

    act(() => {
      sql.set({ id: '1', name: 'Alice2', age: 30 })
    })
    await waitFor(() => {
      expect(result.current[0]).toEqual([{ id: '1', name: 'Alice2', age: 30 }])
      expect(reRenders).toBe(4)
    })

    // delete item
    act(() => {
      sql.delete('1')
    })
    await waitFor(() => {
      expect(result.current[0]).toEqual([])
      expect(reRenders).toBe(5)
    })

    // add two items
    act(() => {
      sql.set({ id: '1', name: 'Alice', age: 30 })
      sql.set({ id: '2', name: 'Bob', age: 25 })
    })
    await waitFor(() => {
      expect(result.current[0].length).toBe(2)
      expect(reRenders).toBe(6)
    })
  })

  it('should use where clause changed via state', async () => {
    const sql = await createSqliteState<Person>({ backend, tableName: 'State2', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
      { id: '3', name: 'Carol', age: 40 },
    ])
    let reRenders = 0
    const { result } = renderHook(() => {
      reRenders++
      const [minAge, setMinAge] = useState(20)
      return [useSqliteValue(sql, { where: { age: { gt: minAge } }, sorBy: 'age' }, [minAge]), setMinAge] as const
    })

    await waitFor(() => {
      expect(result.current[0][0].map((p) => p.name)).toEqual(['Bob', 'Alice', 'Carol'])
      expect(reRenders).toBe(2)
    })

    // // change minAge to 29
    act(() => {
      result.current[1](29)
    })
    await waitFor(() => {
      expect(result.current[0][0].map((p) => p.name)).toEqual(['Alice', 'Carol'])
      expect(reRenders).toBe(4)
    })
  })

  it('should support like in where clause and update results', async () => {
    const sql = await createSqliteState<Person>({ backend, tableName: 'State3', key: 'id' })
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
      expect(result.current[0].map((p) => p.name)).toEqual(['Alice', 'Alicia'])
    })
    act(() => {
      rerender({ like: '%Bob%' })
    })
    await waitFor(() => {
      expect(result.current[0].map((p) => p.name)).toEqual(['Bob'])
    })
    expect(reRenders).toBeGreaterThanOrEqual(2)
  })

  it('should update results when changing order and limit options', async () => {
    const sql = await createSqliteState<Person>({ backend, tableName: 'State4', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
      { id: '3', name: 'Carol', age: 40 },
    ])
    const { result, rerender } = renderHook(
      ({ order, limit }) => useSqliteValue(sql, { sorBy: 'age', order, limit }, [order, limit]),
      { initialProps: { order: 'asc' as 'asc' | 'desc', limit: 2 } },
    )
    await waitFor(() => {
      expect(result.current[0].map((p) => p.name)).toEqual(['Bob', 'Alice'])
    })
    act(() => {
      rerender({ order: 'desc', limit: 2 })
    })
    await waitFor(() => {
      expect(result.current[0].map((p) => p.name)).toEqual(['Carol', 'Alice'])
    })
    act(() => {
      rerender({ order: 'desc', limit: 1 })
    })
    await waitFor(() => {
      expect(result.current[0].map((p) => p.name)).toEqual(['Carol'])
    })
  })

  it('should support actions.next and actions.refresh', async () => {
    const sql = await createSqliteState<Person>({ backend, tableName: 'State5', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
    ])
    const { result } = renderHook(() => useSqliteValue(sql, {}, []))
    // actions.next and actions.refresh should be functions
    await waitFor(() => {
      expect(typeof result.current[1].next).toBe('function')
      expect(typeof result.current[1].reset).toBe('function')
      expect(result.current[1].reset()).resolves.toBeUndefined()
      expect(result.current[1].next()).resolves.toBeFalsy()
    })
  })
  it('should handle thousands of records', async () => {
    const sql = await createSqliteState<Person>({ backend, tableName: 'State6', key: 'id' })
    const people: Person[] = []
    const ITEMS_COUNT = 1000
    for (let index = 1; index <= ITEMS_COUNT; index++) {
      people.push({ id: index.toString(), name: `Person${index}`, age: 20 + (index % 50) })
    }
    await sql.batchSet(people)
    const { result } = renderHook(() => useSqliteValue(sql, {}, []))
    await waitFor(() => {
      expect(result.current[0].length).toBe(DEFAULT_STEP_SIZE)
    })

    // loop until we have all ITEMS_COUNT items
    for (let index = 0; index < ITEMS_COUNT / DEFAULT_STEP_SIZE; index++) {
      act(() => {
        result.current[1].next()
      })
      await waitFor(() => {
        expect(result.current[0].length).toBe(Math.min(DEFAULT_STEP_SIZE * (index + 2), ITEMS_COUNT))
      })
    }

    act(() => {
      result.current[1].reset()
    })
    await waitFor(() => {
      expect(result.current[0].length).toBe(DEFAULT_STEP_SIZE)
    })
  })

  it('should handle thousands of records with single update', async () => {
    const sql = await createSqliteState<Person>({ backend, tableName: 'State6', key: 'id' })
    const people: Person[] = []
    const ITEMS_COUNT = 1000
    for (let index = 1; index <= ITEMS_COUNT; index++) {
      people.push({ id: index.toString(), name: `Person${index}`, age: 20 + (index % 50) })
    }
    await sql.batchSet(people)
    const { result } = renderHook(() => useSqliteValue(sql, {}, []))
    await waitFor(() => {
      expect(result.current[0].length).toBe(DEFAULT_STEP_SIZE)
    })

    // loop until we have all ITEMS_COUNT items
    act(() => {
      for (let index = 0; index < ITEMS_COUNT / DEFAULT_STEP_SIZE; index++) {
        result.current[1].next()
      }
    })

    await waitFor(() => {
      expect(result.current[0].length).toBe(ITEMS_COUNT)
    })

    act(() => {
      result.current[1].reset()
    })
    await waitFor(() => {
      expect(result.current[0].length).toBe(DEFAULT_STEP_SIZE)
    })
  })
  it('should change ordering', async () => {
    const sql = await createSqliteState<Person>({ backend, tableName: 'State7', key: 'id', indexes: ['age'] })
    const people: Person[] = []
    for (let index = 1; index <= 100; index++) {
      people.push({ id: index.toString(), name: `Person${index}`, age: 20 + (index % 50) })
    }
    await sql.batchSet(people)
    const { result, rerender } = renderHook(({ order }) => useSqliteValue(sql, { sorBy: 'age', order }, [order]), {
      initialProps: { order: 'asc' as 'asc' | 'desc' },
    })
    await waitFor(() => {
      expect(result.current[0][0].age).toBe(20)
    })
    act(() => {
      rerender({ order: 'desc' })
    })
    await waitFor(() => {
      expect(result.current[0][0].age).toBe(69)
    })
  })

  it('should support selector in options', async () => {
    const sql = await createSqliteState<Person>({ backend, tableName: 'State8', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
      { id: '3', name: 'Carol', age: 40 },
    ])
    const { result } = renderHook(() =>
      useSqliteValue(
        sql,
        {
          sorBy: 'age',
          select: (d) => d.name,
        },
        [],
      ),
    )
    await waitFor(() => {
      expect(result.current[0]).toEqual(['Bob', 'Alice', 'Carol'])
    })
  })
})
