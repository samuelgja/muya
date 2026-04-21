/* eslint-disable jsdoc/require-jsdoc */
/**
 * Loading-state matrix coverage for `useSqliteValue`.
 *
 * | Phase                                    | data    | status    | isLoading | isFetching | isStale |
 * |------------------------------------------|---------|-----------|-----------|------------|---------|
 * | Initial mount, never loaded              | null    | 'pending' | true      | true       | false   |
 * | First load complete                      | […]     | 'success' | false     | false      | false   |
 * | Cache hit on remount (no refetch)        | […]     | 'success' | false     | false      | false   |
 * | Refetching (deps / refetch / nextPage)   | […]     | 'success' | false     | true       | true    |
 * | Errored on first load                    | null    | 'error'   | false     | false      | false   |
 * | Errored after had data                   | […]     | 'error'   | false     | false      | false   |
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { createSqliteState } from '../src/create-sqlite'
import { bunMemoryBackend } from '../src/table/bun-backend'
import type { SyncTable } from '../src/types'
import { useSqliteValue } from '../src/use-sqlite'
import { clearSqliteCache } from '../src/use-sqlite.engine'

const backend = bunMemoryBackend()

interface Person {
  id: string
  name: string
  age: number
}

function generate(count: number): Person[] {
  return Array.from({ length: count }, (_, index) => ({ id: `p-${index}`, name: `P${index}`, age: index }))
}

interface FlagSnapshot {
  dataIsNull: boolean
  dataLength: number
  status: 'pending' | 'success' | 'error'
  isLoading: boolean
  isFetching: boolean
  isStale: boolean
}

function snap(r: ReturnType<typeof useSqliteValue<Person>>): FlagSnapshot {
  return {
    dataIsNull: r.data === null,
    dataLength: r.data?.length ?? 0,
    status: r.status,
    isLoading: r.isLoading,
    isFetching: r.isFetching,
    isStale: r.isStale,
  }
}

describe('useSqliteValue — loading-state matrix', () => {
  it('row 1: initial mount, never loaded → data:null, status:pending, isLoading:true, isFetching:true, isStale:false', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'StateRow1', key: 'id' })
    await sql.batchSet(generate(5))

    const renders: FlagSnapshot[] = []
    const { unmount } = renderHook(() => {
      const r = useSqliteValue(sql, {}, [])
      renders.push(snap(r))
      return r
    })

    expect(renders[0]).toEqual({
      dataIsNull: true,
      dataLength: 0,
      status: 'pending',
      isLoading: true,
      isFetching: true,
      isStale: false,
    })
    unmount()
  })

  it('row 2: first load complete → data:[…], status:success, isLoading:false, isFetching:false, isStale:false', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'StateRow2', key: 'id' })
    await sql.batchSet(generate(5))

    const { result, unmount } = renderHook(() => useSqliteValue(sql, {}, []))

    await waitFor(() => expect(result.current.status).toBe('success'))

    expect(snap(result.current)).toEqual({
      dataIsNull: false,
      dataLength: 5,
      status: 'success',
      isLoading: false,
      isFetching: false,
      isStale: false,
    })
    unmount()
  })

  it('row 3: cache hit on remount (no refetch) → data:[…], status:success, isLoading:false, isFetching:false, isStale:false', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'StateRow3', key: 'id' })
    await sql.batchSet(generate(5))

    // Prime the cache.
    const first = renderHook(() => useSqliteValue(sql, { cacheKey: 'row3' }, []))
    await waitFor(() => expect(first.result.current.status).toBe('success'))
    first.unmount()

    // Remount and check the very first render.
    const renders: FlagSnapshot[] = []
    const second = renderHook(() => {
      const r = useSqliteValue(sql, { cacheKey: 'row3' }, [])
      renders.push(snap(r))
      return r
    })

    expect(renders[0]).toEqual({
      dataIsNull: false,
      dataLength: 5,
      status: 'success',
      isLoading: false,
      isFetching: false,
      isStale: false,
    })
    second.unmount()
    clearSqliteCache(sql, 'row3')
  })

  describe('row 4: refetching (data:[…], status:success, isLoading:false, isFetching:true, isStale:true)', () => {
    it('via refetch()', async () => {
      const sql = createSqliteState<Person>({ backend, tableName: 'StateRow4Refetch', key: 'id' })
      await sql.batchSet(generate(5))

      const { result, unmount } = renderHook(() => useSqliteValue(sql, {}, []))
      await waitFor(() => expect(result.current.status).toBe('success'))

      act(() => {
        void result.current.refetch()
      })
      // After the sync setSnapshot in refetch(), React renders with isFetching=true.
      expect(snap(result.current)).toEqual({
        dataIsNull: false,
        dataLength: 5,
        status: 'success',
        isLoading: false,
        isFetching: true,
        isStale: true,
      })

      // Settles back to row 2.
      await waitFor(() => expect(result.current.isFetching).toBe(false))
      unmount()
    })

    it('via deps change', async () => {
      const sql = createSqliteState<Person>({ backend, tableName: 'StateRow4Deps', key: 'id', indexes: ['age'] })
      await sql.batchSet(generate(10))

      const { result, rerender, unmount } = renderHook(
        ({ min }: { min: number }) => useSqliteValue(sql, { where: { age: { gte: min } } }, [min]),
        { initialProps: { min: 0 } },
      )
      await waitFor(() => expect(result.current.status).toBe('success'))

      act(() => {
        rerender({ min: 5 })
      })
      expect(snap(result.current)).toEqual({
        dataIsNull: false,
        dataLength: expect.any(Number),
        status: 'success',
        isLoading: false,
        isFetching: true,
        isStale: true,
      })

      await waitFor(() => expect(result.current.isFetching).toBe(false))
      unmount()
    })

    it('via fetchNextPage()', async () => {
      const sql = createSqliteState<Person>({ backend, tableName: 'StateRow4Next', key: 'id', indexes: ['age'] })
      await sql.batchSet(generate(50))

      const { result, unmount } = renderHook(() => useSqliteValue(sql, { pageSize: 10 }, []))
      await waitFor(() => expect(result.current.data?.length).toBe(10))

      act(() => {
        void result.current.fetchNextPage()
      })
      expect(snap(result.current)).toEqual({
        dataIsNull: false,
        dataLength: 10,
        status: 'success',
        isLoading: false,
        isFetching: true,
        isStale: true,
      })

      await waitFor(() => expect(result.current.data?.length).toBe(20))
      expect(result.current.isFetching).toBe(false)
      unmount()
    })
  })

  it('row 5: errored on first load → data:null, status:error, isLoading:false, isFetching:false, isStale:false', async () => {
    const failing = makeFailingState({ failOnFirstSearch: true })

    const { result, unmount } = renderHook(() => useSqliteValue(failing as unknown as SyncTable<Person>, {}, []))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(snap(result.current)).toEqual({
      dataIsNull: true,
      dataLength: 0,
      status: 'error',
      isLoading: false,
      isFetching: false,
      isStale: false,
    })
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.isError).toBe(true)
    unmount()
  })

  it('row 6: errored after had data → data:[…], status:error, isLoading:false, isFetching:false, isStale:false', async () => {
    const failing = makeFailingState({ failOnSecondSearch: true })
    await failing.batchSet(generate(3)) // seed BEFORE the hook mounts

    const { result, unmount } = renderHook(() => useSqliteValue(failing as unknown as SyncTable<Person>, {}, []))

    // First load succeeds.
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data?.length).toBe(3)

    // Trigger refetch — it will throw on the second call.
    act(() => {
      void result.current.refetch()
    })

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(snap(result.current)).toEqual({
      dataIsNull: false,
      dataLength: 3, // OLD data still visible alongside the error.
      status: 'error',
      isLoading: false,
      isFetching: false,
      isStale: false,
    })
    expect(result.current.error).toBeInstanceOf(Error)
    unmount()
  })
})

// --------------------------------------------------------------------------
// Failing-state helper: wraps a SyncTable so .search() throws on the
// configured call (first or second). Keeps everything else delegated.
// --------------------------------------------------------------------------
interface FailingOptions {
  failOnFirstSearch?: boolean
  failOnSecondSearch?: boolean
}

let failingTableCounter = 0

function makeFailingState(options: FailingOptions): SyncTable<Person> {
  failingTableCounter++
  const real = createSqliteState<Person>({
    backend,
    tableName: `Failing_${failingTableCounter}`,
    key: 'id',
  })
  let searchCallCount = 0
  return new Proxy(real, {
    get(target, property, receiver) {
      if (property === 'search') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return function search(searchOptions?: any) {
          searchCallCount++
          const shouldFail =
            (options.failOnFirstSearch === true && searchCallCount === 1) ||
            (options.failOnSecondSearch === true && searchCallCount === 2)
          if (shouldFail) {
            return failingIterator()
          }
          return target.search(searchOptions)
        }
      }
      return Reflect.get(target, property, receiver)
    },
  })
}

function failingIterator(): AsyncIterableIterator<never> {
  return {
    async next(): Promise<IteratorResult<never>> {
      throw new Error('synthetic backend failure')
    },
    async return(): Promise<IteratorResult<never>> {
      return { done: true, value: undefined as never }
    },
    [Symbol.asyncIterator]() {
      return this
    },
  }
}
