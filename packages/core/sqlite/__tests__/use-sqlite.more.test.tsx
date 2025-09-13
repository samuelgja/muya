import { act, renderHook } from '@testing-library/react-hooks'
import { createSqliteState } from '../create-sqlite'
import { useSqliteValue } from '../use-sqlite'
import { waitFor } from '@testing-library/react'
import { bunMemoryBackend } from '../table/bun-backend'
import { StrictMode, Suspense } from 'react'

const backend = bunMemoryBackend()

interface Person {
  id: string
  name: string
  age: number
}

/**
 * Wrapper component to provide necessary React context for testing.
 * @param props - The props object containing children.
 * @param props.children - The children to render inside the wrapper.
 * @returns The wrapped children with React context.
 */
function Wrapper({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <StrictMode>
      <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
    </StrictMode>
  )
}

describe('use-sqlite edge cases', () => {
  it('should remove an item and verify it is removed', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'RemoveTest', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
    ])

    const { result } = renderHook(() => useSqliteValue(sql, {}, []), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
      ])
      expect(result.current[1].keysIndex).toEqual(
        new Map([
          ['1', 0],
          ['2', 1],
        ]),
      )
    })

    act(() => {
      sql.delete('1')
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual([{ id: '2', name: 'Bob', age: 25 }])
      expect(result.current[1].keysIndex).toEqual(new Map([['2', 0]]))
    })

    act(() => {
      sql.delete('2')
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual([])
    })
  })
  it('should handle deleting a non-existent item gracefully', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'EdgeCaseTest', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
    ])

    const { result } = renderHook(() => useSqliteValue(sql, {}, []), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
      ])
    })

    act(() => {
      sql.delete('3') // Attempt to delete a non-existent item
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
      ]) // State should remain unchanged
    })
  })

  it('should handle deleting all items', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'DeleteAllTest', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
    ])

    const { result } = renderHook(() => useSqliteValue(sql, {}, []), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
      ])
    })

    act(() => {
      sql.delete('1')
      sql.delete('2')
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual([]) // All items should be removed
    })
  })

  it('should handle concurrent operations', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'ConcurrentOpsTest', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
    ])

    const { result } = renderHook(() => useSqliteValue(sql, {}, []), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
      ])
    })

    act(() => {
      sql.delete('1')
      sql.set({ id: '3', name: 'Carol', age: 40 })
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '2', name: 'Bob', age: 25 },
        { id: '3', name: 'Carol', age: 40 },
      ]) // State should reflect both operations
    })
  })

  it('should handle repeated updates, removals, and insertions in a loop', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'LoopTest', key: 'id' })
    sql.clear()
    // Initial batch set
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
    ])

    const { result } = renderHook(() => useSqliteValue(sql, {}, []), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
      ])
    })

    // Perform updates, removals, and insertions in a loop
    act(() => {
      for (let index = 0; index < 10; index++) {
        sql.set({ id: `new-${index}`, name: `Person ${index}`, age: 20 + index }) // Insert new item
        sql.delete('1') // Remove an existing item
        sql.set({ id: '2', name: `Updated Bob ${index}`, age: 25 + index }) // Update an existing item
      }
      // fetch next
      result.current[1].nextPage()
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '2', name: 'Updated Bob 9', age: 34 },
        { id: 'new-0', name: 'Person 0', age: 20 },
        { id: 'new-1', name: 'Person 1', age: 21 },
        { id: 'new-2', name: 'Person 2', age: 22 },
        { id: 'new-3', name: 'Person 3', age: 23 },
        { id: 'new-4', name: 'Person 4', age: 24 },
        { id: 'new-5', name: 'Person 5', age: 25 },
        { id: 'new-6', name: 'Person 6', age: 26 },
        { id: 'new-7', name: 'Person 7', age: 27 },
        { id: 'new-8', name: 'Person 8', age: 28 },
        { id: 'new-9', name: 'Person 9', age: 29 },
      ])
    })
  })
  it('should handle concurrent insertions and deletions', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'ConcurrentInsertDeleteTest', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
    ])

    const { result } = renderHook(() => useSqliteValue(sql, {}, []), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
      ])
    })

    act(() => {
      sql.set({ id: '3', name: 'Carol', age: 40 })
      sql.delete('1')
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '2', name: 'Bob', age: 25 },
        { id: '3', name: 'Carol', age: 40 },
      ])
    })
  })

  it('should handle pagination with empty pages', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'EmptyPaginationTest', key: 'id' })
    sql.clear()

    const { result } = renderHook(() => useSqliteValue(sql, {}, []), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current[0]).toEqual([])
    })

    act(() => {
      result.current[1].nextPage()
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual([]) // Still empty
    })
  })

  it('should handle duplicate key insertions gracefully', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'DuplicateKeyTest', key: 'id' })
    await sql.batchSet([{ id: '1', name: 'Alice', age: 30 }])

    const { result } = renderHook(() => useSqliteValue(sql, {}, []), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current[0]).toEqual([{ id: '1', name: 'Alice', age: 30 }])
    })

    act(() => {
      sql.set({ id: '1', name: 'Updated Alice', age: 35 })
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual([{ id: '1', name: 'Updated Alice', age: 35 }])
    })
  })

  it('should handle reset during pagination', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'ResetDuringPaginationTest', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
    ])

    const { result } = renderHook(() => useSqliteValue(sql, {}, []), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
      ])
    })

    act(() => {
      result.current[1].reset()
      result.current[1].nextPage()
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
      ])
    })
  })

  it('should handle invalid key deletion gracefully', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'InvalidKeyDeletionTest', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
    ])

    const { result } = renderHook(() => useSqliteValue(sql, {}, []), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
      ])
    })

    act(() => {
      sql.delete('non-existent-key')
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
      ])
    })
  })
  it('should update a visible document', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'UpdateVisibleTest', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
    ])

    const { result } = renderHook(() => useSqliteValue(sql, {}, []), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
      ])
    })

    act(() => {
      sql.set({ id: '1', name: 'Updated Alice', age: 35 })
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Updated Alice', age: 35 },
        { id: '2', name: 'Bob', age: 25 },
      ])
    })
  })

  it('should update a non-visible document', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'UpdateNonVisibleTest', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
      { id: '3', name: 'Carol', age: 40 },
    ])

    const { result } = renderHook(() => useSqliteValue(sql, { pageSize: 2 }, []), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
      ])
    })

    act(() => {
      sql.set({ id: '3', name: 'Updated Carol', age: 45 })
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
      ]) // No change in visible items
    })

    act(() => {
      result.current[1].nextPage()
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
        { id: '3', name: 'Updated Carol', age: 45 },
      ])
    })
  })

  it('should handle updates during pagination', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'UpdateDuringPaginationTest', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 25 },
      { id: '3', name: 'Carol', age: 40 },
    ])

    const { result } = renderHook(() => useSqliteValue(sql, { pageSize: 2 }, []), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
      ])
    })

    act(() => {
      result.current[1].nextPage()
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Bob', age: 25 },
        { id: '3', name: 'Carol', age: 40 },
      ])
    })

    act(() => {
      sql.set({ id: '2', name: 'Updated Bob', age: 35 })
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual([
        { id: '1', name: 'Alice', age: 30 },
        { id: '2', name: 'Updated Bob', age: 35 },
        { id: '3', name: 'Carol', age: 40 },
      ])
    })
  })
})
