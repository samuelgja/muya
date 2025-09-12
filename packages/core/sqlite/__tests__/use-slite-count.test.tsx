import { act, renderHook } from '@testing-library/react-hooks'
import { createSqliteState } from '../create-sqlite'
import { useSqliteCount } from '../use-sqlite-count'
import { bunMemoryBackend } from '../table/bun-backend'
import { waitFor } from '@testing-library/react'

const backend = bunMemoryBackend()
interface Person {
  id: string
  name: string
  age: number
}

describe('useSqliteCount', () => {
  it('should count items in the table', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'CountTest1', key: 'id' })
    const { result } = renderHook(() => useSqliteCount(sql))

    await waitFor(() => {
      expect(result.current).toBe(0)
    })

    act(() => {
      sql.set({ id: '1', name: 'Alice', age: 30 })
      sql.set({ id: '2', name: 'Bob', age: 25 })
    })

    await waitFor(() => {
      expect(result.current).toBe(2)
    })

    act(() => {
      sql.delete('1')
    })

    await waitFor(() => {
      expect(result.current).toBe(1)
    })
  })

  it('should support filtering with where clause', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'CountTest2', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
      { id: '3', name: 'Carol', age: 40 },
    ])

    const { result } = renderHook(() => useSqliteCount(sql, { where: { age: { gt: 30 } } }))

    await waitFor(() => {
      expect(result.current).toBe(1)
    })

    act(() => {
      sql.set({ id: '4', name: 'Dave', age: 35 })
    })

    await waitFor(() => {
      expect(result.current).toBe(2)
    })

    act(() => {
      sql.delete('3')
    })

    await waitFor(() => {
      expect(result.current).toBe(1)
    })
  })

  it('should react to dependency changes', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'CountTest3', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
      { id: '3', name: 'Carol', age: 40 },
    ])

    const { result, rerender } = renderHook(({ minAge }) => useSqliteCount(sql, { where: { age: { gt: minAge } } }, [minAge]), {
      initialProps: { minAge: 20 },
    })

    await waitFor(() => {
      expect(result.current).toBe(3)
    })

    act(() => {
      rerender({ minAge: 30 })
    })

    await waitFor(() => {
      expect(result.current).toBe(1)
    })
  })
})
