import { act, renderHook } from '@testing-library/react-hooks'
import { createSqliteState } from '../create-sqlite-state'
import { useSqliteValue } from '../use-sqlite-value'
import { waitFor } from '@testing-library/react'
import { bunMemoryBackend } from '../table/bun-backend'
import { useState } from 'react'

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
    expect(result.current).toEqual([])

    expect(reRenders).toBe(2)

    act(() => {
      sql.set({ id: '1', name: 'Alice', age: 30 })
    })
    await waitFor(() => {
      expect(result.current).toEqual([{ id: '1', name: 'Alice', age: 30 }])
      expect(reRenders).toBe(4)
    })

    act(() => {
      sql.set({ id: '1', name: 'Alice2', age: 30 })
    })
    await waitFor(() => {
      expect(result.current).toEqual([{ id: '1', name: 'Alice2', age: 30 }])
      expect(reRenders).toBe(5)
    })

    // delete item
    act(() => {
      sql.delete('1')
    })
    await waitFor(() => {
      expect(result.current).toEqual([])
      expect(reRenders).toBe(6)
    })

    // add two items
    act(() => {
      sql.set({ id: '1', name: 'Alice', age: 30 })
      sql.set({ id: '2', name: 'Bob', age: 25 })
    })
    await waitFor(() => {
      expect(result.current.length).toBe(2)
      expect(reRenders).toBe(7)
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
})
