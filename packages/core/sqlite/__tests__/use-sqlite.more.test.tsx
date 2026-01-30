import { act, renderHook } from '@testing-library/react'
import { createSqliteState } from '../create-sqlite'
import { useSqliteValue } from '../use-sqlite'
import { waitFor } from '@testing-library/react'
import { bunMemoryBackend } from '../table/bun-backend'
import { StrictMode, Suspense } from 'react'
import type { Key } from '../table'

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

  it('should handle rapid consecutive updates without losing state', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'RaceState', key: 'id' })

    // Insert initial document
    await sql.set({ id: '1', name: 'Alice', age: 30 })

    const { result } = renderHook(() => useSqliteValue(sql, {}, []))

    await waitFor(() => {
      expect(result.current[0]).toEqual([{ id: '1', name: 'Alice', age: 30 }])
    })

    // Now simulate fast consecutive updates to the same key
    // These will hit the subscription handler while it's still awaiting `state.get`
    await Promise.all([
      sql.set({ id: '1', name: 'AliceV2', age: 31 }),
      sql.set({ id: '1', name: 'AliceV3', age: 32 }),
      sql.set({ id: '1', name: 'AliceV4', age: 33 }),
    ])

    // Wait for hook to stabilize
    await waitFor(() => {
      // eslint-disable-next-line prefer-destructuring, unicorn/prevent-abbreviations
      const docs = result.current[0]
      expect(docs?.length).toBe(1)
      // Expect the *latest* update to win
      expect(docs?.[0]).toEqual({ id: '1', name: 'AliceV4', age: 33 })
    })
  })

  it('should not overwrite newer updates with stale state.get results', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'RaceFailState', key: 'id' })
    await sql.set({ id: '1', name: 'Initial', age: 20 })

    // Delay the first get call artificially to simulate slow DB
    let callCount = 0
    const originalGet = sql.get
    // @ts-expect-error - We mocking the get method for testing
    sql.get = async (key: Key, selector: ((document: Person) => Person) | undefined) => {
      callCount++
      if (callCount === 1) {
        // Simulate slow resolution for first update
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      return originalGet(key, selector)
    }

    const { result } = renderHook(() => useSqliteValue(sql, {}, []))

    await waitFor(() => {
      expect(result.current[0]).toEqual([{ id: '1', name: 'Initial', age: 20 }])
    })

    // Trigger two consecutive updates
    await sql.set({ id: '1', name: 'AliceV1', age: 21 })
    await sql.set({ id: '1', name: 'AliceV2', age: 22 })

    // Wait for hook to stabilize
    await waitFor(() => {
      // eslint-disable-next-line prefer-destructuring, unicorn/prevent-abbreviations
      const docs = result.current[0]
      expect(docs?.length).toBe(1)
      // 🔥 Correct behavior: should end with the *latest* version (AliceV2)
      // ❌ Buggy behavior: may still show AliceV1 because the delayed get resolves last
      expect(docs?.[0]).toEqual({ id: '1', name: 'AliceV2', age: 22 })
    })
  })
  it('should reset correctly during pagination', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'ResetMid', key: 'id' })
    const people = Array.from({ length: 200 }, (_, index) => ({ id: `${index + 1}`, name: `P${index + 1}`, age: index }))
    await sql.batchSet(people)

    const { result } = renderHook(() => useSqliteValue(sql, { pageSize: 50 }, []))

    await waitFor(() => {
      expect(result.current[0]?.length).toBe(50)
    })

    // Load next page
    await act(async () => {
      await result.current[1].nextPage()
    })
    expect(result.current[0]?.length).toBe(100)

    // Reset
    await act(async () => {
      await result.current[1].reset()
    })
    await waitFor(() => {
      // Should go back to first page only
      expect(result.current[0]?.length).toBe(50)
      expect(result.current[0]?.[0]?.id).toBe('1')
    })
  })
  it('should overwrite duplicate keys instead of duplicating items', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'DupTest', key: 'id' })
    await sql.set({ id: '1', name: 'Alice', age: 30 })
    await sql.set({ id: '1', name: 'Alice2', age: 35 }) // overwrite

    const { result } = renderHook(() => useSqliteValue(sql, {}, []))

    await waitFor(() => {
      expect(result.current[0]).toEqual([{ id: '1', name: 'Alice2', age: 35 }])
    })
  })
  it('should not update after unmount', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'UnmountTest', key: 'id' })
    const { unmount, result } = renderHook(() => useSqliteValue(sql, {}, []))

    unmount()
    await sql.set({ id: '1', name: 'ShouldNotAppear', age: 99 })

    // wait briefly to give subscription a chance
    await new Promise((r) => setTimeout(r, 20))

    expect(result.current[0]).toBeNull() // no state change after unmount
  })
  it('should restart iterator when sortBy changes', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'SortChange', key: 'id' })
    await sql.batchSet([
      { id: '1', name: 'A', age: 40 },
      { id: '2', name: 'B', age: 20 },
    ])

    const { result, rerender } = renderHook(({ sortBy }) => useSqliteValue(sql, { sortBy }, [sortBy]), {
      initialProps: { sortBy: 'age' as keyof Person },
    })

    await waitFor(() => {
      expect(result.current[0]?.[0]?.age).toBe(20)
    })

    act(() => {
      rerender({ sortBy: 'name' })
    })

    await waitFor(() => {
      expect(result.current[0]?.[0]?.name).toBe('A') // sorted by name asc
    })
  })

  it('should return done when nextPage is called on empty table', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'EmptyNext', key: 'id' })
    const { result } = renderHook(() => useSqliteValue(sql, {}, []))

    const isDone = await act(result.current[1].nextPage)
    expect(isDone).toBe(true)
    expect(result.current[0]).toEqual([])
  })

  it('should handle deletion of non-visible item gracefully', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'DeleteNonVisible', key: 'id' })
    const people = Array.from({ length: 200 }, (_, index) => ({ id: `${index + 1}`, name: `P${index + 1}`, age: index }))
    await sql.batchSet(people)
    let renderCount = 0
    const { result } = renderHook(() => {
      renderCount++
      return useSqliteValue(sql, { pageSize: 50 }, [])
    })
    await waitFor(() => {
      expect(result.current[0]?.length).toBe(50)
    })
    const initialRenders = renderCount

    // Delete item outside current page
    await act(async () => {
      await sql.delete('150')
    })

    await waitFor(() => {
      expect(result.current[0]?.length).toBe(50) // unchanged page size
    })
    // No re-render for non-visible item deletion
    expect(renderCount).toBe(initialRenders)
  })
  it('should not rerender when using select if the selected value does not change', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'SelectNoReRender', key: 'id' })
    await sql.set({ id: '1', name: 'Alice', age: 30 })

    let renders = 0
    const { result } = renderHook(() => {
      renders++
      // Only project `name`
      return useSqliteValue(sql, { select: (p) => p.name }, [])
    })

    await waitFor(() => {
      expect(result.current[0]).toEqual(['Alice'])
    })
    const initialRenders = renders

    // Update age (not part of select projection)
    await act(async () => {
      await sql.set({ id: '1', name: 'Alice', age: 31 })
    })

    // Wait a bit to let subscription flush
    await new Promise((r) => setTimeout(r, 20))

    // No re-render since selected value "Alice" didn't change
    expect(result.current[0]).toEqual(['Alice'])
    expect(renders).toBe(initialRenders)
  })
})
