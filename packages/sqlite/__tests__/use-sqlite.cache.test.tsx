/* eslint-disable jsdoc/require-jsdoc */
import { act, renderHook, waitFor } from '@testing-library/react'
import { createSqliteState } from '../src/create-sqlite'
import { bunMemoryBackend } from '../src/table/bun-backend'
import { useSqliteValue } from '../src/use-sqlite'
import { clearSqliteCache } from '../src/use-sqlite.engine'
import { useSqliteCount } from '../src/use-sqlite-count'

const backend = bunMemoryBackend()

interface Person {
  id: string
  name: string
  age: number
}

function generate(count: number, offset = 0): Person[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p-${offset + index}`,
    name: `P${offset + index}`,
    age: 20 + ((offset + index) % 60),
  }))
}

describe('use-sqlite cache', () => {
  it('shares loaded data across mount/unmount with same cacheKey', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'CacheBasic', key: 'id', indexes: ['age'] })
    await sql.batchSet(generate(150))

    const first = renderHook(() => useSqliteValue(sql, { sortBy: 'age', pageSize: 100, cacheKey: 'shared' }, []))

    await waitFor(() => {
      expect(first.result.current.data?.length).toBe(100)
    })

    // Unmount but keep cache alive (default gcTime).
    first.unmount()

    // New mount with same cacheKey should see data SYNCHRONOUSLY (cache hit).
    const second = renderHook(() => useSqliteValue(sql, { sortBy: 'age', pageSize: 100, cacheKey: 'shared' }, []))

    expect(second.result.current.data?.length).toBe(100)
    expect(second.result.current.status).toBe('success')
    expect(second.result.current.isLoading).toBe(false)

    second.unmount()
    clearSqliteCache(sql, 'shared')
  })

  it('keeps subscription live while no consumer is mounted (push-driven freshness)', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'CacheLiveSub', key: 'id', indexes: ['age'] })
    await sql.batchSet(generate(50))

    const first = renderHook(() => useSqliteValue(sql, { sortBy: 'age', pageSize: 100, cacheKey: 'live' }, []))
    await waitFor(() => {
      expect(first.result.current.data?.length).toBe(50)
    })
    first.unmount()

    // Mutation lands while NO hook is mounted - the cached engine still
    // listens to state.subscribe and updates its snapshot.
    await act(async () => {
      await sql.set({ id: 'while-unmounted', name: 'WhileUnmounted', age: 30 })
    })

    const second = renderHook(() => useSqliteValue(sql, { sortBy: 'age', pageSize: 100, cacheKey: 'live' }, []))

    await waitFor(() => {
      expect(second.result.current.data?.find((p) => p.id === 'while-unmounted')).toBeDefined()
    })

    second.unmount()
    clearSqliteCache(sql, 'live')
  })

  it('different cacheKeys are isolated', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'CacheIsolated', key: 'id', indexes: ['age'] })
    await sql.batchSet(generate(20))

    const a = renderHook(() => useSqliteValue(sql, { where: { age: { gt: 0 } }, cacheKey: 'a' }, []))
    const b = renderHook(() => useSqliteValue(sql, { where: { age: { gt: 50 } }, cacheKey: 'b' }, []))

    await waitFor(() => {
      expect(a.result.current.data?.length).toBe(20)
      expect(b.result.current.data?.length ?? 0).toBeLessThan(20)
    })

    a.unmount()
    b.unmount()
    clearSqliteCache(sql)
  })

  it('reuses the SAME cache entry when deps reference changes but cacheKey stays', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'CacheStableKey', key: 'id', indexes: ['age'] })
    await sql.batchSet(generate(50))

    let renderCount = 0
    const { result, rerender } = renderHook(
      ({ filter }: { filter: { min: number } }) => {
        renderCount++
        // Each render builds a NEW filter ref but cacheKey is constant.
        return useSqliteValue(sql, { where: { age: { gte: filter.min } }, cacheKey: 'stable-key' }, [filter])
      },
      { initialProps: { filter: { min: 30 } } },
    )

    await waitFor(() => {
      expect(result.current.status).toBe('success')
      expect(result.current.data?.length ?? 0).toBeGreaterThan(0)
    })
    const firstData = result.current.data
    const initialRenders = renderCount

    // Same content but a NEW object reference - deps array should hash to a
    // new key per identity, but cacheKey 'stable-key' overrides that and we
    // must hit the same engine. Old data stays visible while refetch runs.
    act(() => {
      rerender({ filter: { min: 30 } })
    })
    expect(result.current.data).toBe(firstData) // identity preserved during refetch

    // Refetch finishes (data may be a fresh array but length matches).
    await waitFor(() => {
      expect(result.current.isStale).toBe(false)
      expect(result.current.data?.length).toBe(firstData?.length)
    })

    // Genuinely different filter content - same cacheKey, but data must update.
    act(() => {
      rerender({ filter: { min: 70 } })
    })
    // While refetching: old data + isStale=true.
    expect(result.current.isStale).toBe(true)

    await waitFor(() => {
      expect(result.current.isStale).toBe(false)
      const allMatch = (result.current.data ?? []).every((p) => p.age >= 70)
      expect(allMatch).toBe(true)
    })

    expect(renderCount).toBeGreaterThan(initialRenders)

    clearSqliteCache(sql, 'stable-key')
  })

  it('per-deps caching when user includes deps in cacheKey themselves', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'CachePerDeps', key: 'id', indexes: ['age'] })
    await sql.batchSet(generate(100))

    // Mount #1 with filter 30
    const a = renderHook(() => useSqliteValue(sql, { where: { age: { gte: 30 } }, cacheKey: 'q:30' }, [30]))
    await waitFor(() => expect(a.result.current.status).toBe('success'))
    const aData = a.result.current.data
    a.unmount()

    // Mount #2 with filter 50 - different cacheKey, fresh entry.
    const b = renderHook(() => useSqliteValue(sql, { where: { age: { gte: 50 } }, cacheKey: 'q:50' }, [50]))
    await waitFor(() => expect(b.result.current.status).toBe('success'))
    b.unmount()

    // Re-mount with filter 30 - should hit the still-cached entry.
    const c = renderHook(() => useSqliteValue(sql, { where: { age: { gte: 30 } }, cacheKey: 'q:30' }, [30]))
    expect(c.result.current.status).toBe('success')
    expect(c.result.current.data?.length).toBe(aData?.length)

    c.unmount()
    clearSqliteCache(sql)
  })

  it('gcTime: 0 disposes immediately on last unmount', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'CacheGc0', key: 'id' })
    await sql.batchSet(generate(10))

    const a = renderHook(() => useSqliteValue(sql, { cacheKey: 'g0', gcTime: 0 }, []))
    await waitFor(() => expect(a.result.current.status).toBe('success'))
    a.unmount()

    // Engine disposed immediately - re-mount shows pending state again
    // before the load completes (no cache hit).
    const b = renderHook(() => useSqliteValue(sql, { cacheKey: 'g0', gcTime: 0 }, []))
    expect(b.result.current.data).toBeNull()

    await waitFor(() => expect(b.result.current.status).toBe('success'))
    b.unmount()
  })

  it('clearSqliteCache(state, cacheKey) drops one entry', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'CacheClear1', key: 'id' })
    await sql.batchSet(generate(5))

    const a = renderHook(() => useSqliteValue(sql, { cacheKey: 'keep' }, []))
    const b = renderHook(() => useSqliteValue(sql, { cacheKey: 'drop' }, []))
    await waitFor(() => {
      expect(a.result.current.status).toBe('success')
      expect(b.result.current.status).toBe('success')
    })
    a.unmount()
    b.unmount()

    clearSqliteCache(sql, 'drop')

    // Re-mount 'keep' - cache hit (synchronous).
    const aAgain = renderHook(() => useSqliteValue(sql, { cacheKey: 'keep' }, []))
    expect(aAgain.result.current.status).toBe('success')
    expect(aAgain.result.current.data?.length).toBe(5)

    // Re-mount 'drop' - cache miss (had to reload).
    const bAgain = renderHook(() => useSqliteValue(sql, { cacheKey: 'drop' }, []))
    expect(bAgain.result.current.data).toBeNull()

    aAgain.unmount()
    bAgain.unmount()
    clearSqliteCache(sql)
  })

  it('clearSqliteCache() clears everything', async () => {
    const sql1 = createSqliteState<Person>({ backend, tableName: 'CacheClearAll1', key: 'id' })
    const sql2 = createSqliteState<Person>({ backend, tableName: 'CacheClearAll2', key: 'id' })
    await sql1.batchSet(generate(3))
    await sql2.batchSet(generate(3))

    const a = renderHook(() => useSqliteValue(sql1, { cacheKey: 'k' }, []))
    const b = renderHook(() => useSqliteValue(sql2, { cacheKey: 'k' }, []))
    await waitFor(() => {
      expect(a.result.current.status).toBe('success')
      expect(b.result.current.status).toBe('success')
    })
    a.unmount()
    b.unmount()

    clearSqliteCache()

    // Both must be cache misses now.
    const aAgain = renderHook(() => useSqliteValue(sql1, { cacheKey: 'k' }, []))
    const bAgain = renderHook(() => useSqliteValue(sql2, { cacheKey: 'k' }, []))
    expect(aAgain.result.current.data).toBeNull()
    expect(bAgain.result.current.data).toBeNull()

    aAgain.unmount()
    bAgain.unmount()
    clearSqliteCache()
  })

  it('first mount shows isLoading=true; second mount with same cacheKey is loaded synchronously (no blink)', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'CacheNoBlink', key: 'id' })
    await sql.batchSet(generate(20))

    // ---- First mount: must transition through the loading state.
    const loadingStatesA: Array<{ isLoading: boolean; status: string; dataNull: boolean }> = []
    const first = renderHook(() => {
      const r = useSqliteValue(sql, { cacheKey: 'no-blink' }, [])
      loadingStatesA.push({
        isLoading: r.isLoading,
        status: r.status,
        dataNull: r.data === null,
      })
      return r
    })

    // Synchronously on first render: loading + no data yet.
    expect(loadingStatesA[0]).toEqual({ isLoading: true, status: 'pending', dataNull: true })

    await waitFor(() => {
      expect(first.result.current.status).toBe('success')
      expect(first.result.current.isLoading).toBe(false)
      expect(first.result.current.data?.length).toBe(20)
    })

    first.unmount()

    // ---- Second mount: cache hit, loaded data on the very first render.
    const loadingStatesB: Array<{ isLoading: boolean; status: string; dataLength: number }> = []
    const second = renderHook(() => {
      const r = useSqliteValue(sql, { cacheKey: 'no-blink' }, [])
      loadingStatesB.push({
        isLoading: r.isLoading,
        status: r.status,
        dataLength: r.data?.length ?? -1,
      })
      return r
    })

    // Synchronously on the very first render of the SECOND mount:
    // - no loading flicker
    // - status is already success
    // - data is already the cached array
    expect(loadingStatesB[0]).toEqual({ isLoading: false, status: 'success', dataLength: 20 })
    // No render in this batch should ever see isLoading=true.
    for (const snap of loadingStatesB) {
      expect(snap.isLoading).toBe(false)
    }

    second.unmount()
    clearSqliteCache(sql, 'no-blink')
  })

  it('on remount with same cacheKey, data is present on the first render (no loading state)', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'RemountDataPresent', key: 'id', indexes: ['age'] })
    await sql.batchSet(generate(50))

    // Mount #1: load and unmount.
    const first = renderHook(
      ({ min }: { min: number }) => useSqliteValue(sql, { where: { age: { gte: min } }, cacheKey: 'k' }, [min]),
      {
        initialProps: { min: 30 },
      },
    )
    await waitFor(() => expect(first.result.current.status).toBe('success'))
    expect(first.result.current.data?.length).toBeGreaterThan(0)
    first.unmount()

    // Mount #2 with the SAME cacheKey - the only thing this test asserts is
    // that the first render of the new mount already has data and is not in
    // a loading state. (Per contract: stable cacheKey = whatever data is
    // currently in that slot is shown immediately. Users who need per-deps
    // isolation should include deps in their cacheKey.)
    const second = renderHook(
      ({ min }: { min: number }) => useSqliteValue(sql, { where: { age: { gte: min } }, cacheKey: 'k' }, [min]),
      {
        initialProps: { min: 70 },
      },
    )

    expect(second.result.current.data).not.toBeNull()
    expect(second.result.current.data?.length).toBeGreaterThan(0)
    expect(second.result.current.isLoading).toBe(false)
    expect(second.result.current.status).toBe('success')

    second.unmount()
    clearSqliteCache(sql, 'k')
  })

  it('uncached hook (no cacheKey) disposes on unmount', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'CacheNone', key: 'id' })
    await sql.batchSet(generate(5))

    const a = renderHook(() => useSqliteValue(sql, {}, []))
    await waitFor(() => expect(a.result.current.status).toBe('success'))
    a.unmount()

    // Fresh mount - no cache, must reload.
    const b = renderHook(() => useSqliteValue(sql, {}, []))
    expect(b.result.current.data).toBeNull()
    await waitFor(() => expect(b.result.current.status).toBe('success'))
    b.unmount()
  })

  it('useSqliteCount caches across mount/unmount with cacheKey', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'CountCache', key: 'id' })
    await sql.batchSet(generate(7))

    const a = renderHook(() => useSqliteCount(sql, { cacheKey: 'cnt' }, []))
    await waitFor(() => expect(a.result.current).toBe(7))
    a.unmount()

    // Mutation while unmounted - cached count should pick it up.
    await act(async () => {
      await sql.set({ id: 'extra', name: 'Extra', age: 1 })
    })

    const b = renderHook(() => useSqliteCount(sql, { cacheKey: 'cnt' }, []))
    await waitFor(() => expect(b.result.current).toBe(8))
    b.unmount()

    clearSqliteCache(sql, 'cnt')
  })

  it('inserts during pagination are visible in correct sorted position (mounted)', async () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'InsertSorted', key: 'id', indexes: ['age'] })
    // Seed 10 pages of 100 items, ages 20..119.
    const seed: Person[] = []
    for (let index = 0; index < 1000; index++) {
      seed.push({ id: `seed-${index}`, name: `Seed${index}`, age: 20 + (index % 100) })
    }
    await sql.batchSet(seed)

    const { result } = renderHook(() => useSqliteValue(sql, { sortBy: 'age', pageSize: 100 }, []))
    await waitFor(() => expect(result.current.data?.length).toBe(100))

    for (let page = 0; page < 9; page++) {
      await act(async () => {
        await result.current.fetchNextPage()
      })
    }
    await waitFor(() => expect(result.current.data?.length).toBe(1000))

    // Insert at low age (should appear in early section after refill).
    await act(async () => {
      await sql.set({ id: 'inserted-low', name: 'Low', age: -5 })
    })
    await waitFor(() => {
      const idx = result.current.data?.findIndex((p) => p.id === 'inserted-low') ?? -1
      expect(idx).toBeGreaterThanOrEqual(0)
      // Lowest age - should be the very first row.
      expect(idx).toBe(0)
    })

    // Insert in middle (age ~50).
    await act(async () => {
      await sql.set({ id: 'inserted-mid', name: 'Mid', age: 50 })
    })
    await waitFor(() => {
      const found = result.current.data?.find((p) => p.id === 'inserted-mid')
      expect(found).toBeDefined()
      // Verify global sort still holds.
      const ages = (result.current.data ?? []).map((p) => p.age)
      const sorted = ages.toSorted((x, y) => x - y)
      expect(ages).toEqual(sorted)
    })
  })

  it('inserts while unmounted-with-cache are visible on remount in sorted position', async () => {
    const sql = createSqliteState<Person>({
      backend,
      tableName: 'InsertSortedUnmounted',
      key: 'id',
      indexes: ['age'],
    })
    const seed: Person[] = []
    for (let index = 0; index < 500; index++) {
      seed.push({ id: `seed-${index}`, name: `Seed${index}`, age: 20 + (index % 80) })
    }
    await sql.batchSet(seed)

    // Mount, paginate to 5 pages of 100 = 500 items, then unmount.
    const a = renderHook(() => useSqliteValue(sql, { sortBy: 'age', pageSize: 100, cacheKey: 'big' }, []))
    await waitFor(() => expect(a.result.current.data?.length).toBe(100))
    for (let page = 0; page < 4; page++) {
      await act(async () => {
        await a.result.current.fetchNextPage()
      })
    }
    await waitFor(() => expect(a.result.current.data?.length).toBe(500))
    a.unmount()

    // Insert into low + middle while no consumer is mounted.
    await act(async () => {
      await sql.set({ id: 'low-while-out', name: 'Low', age: -10 })
      await sql.set({ id: 'mid-while-out', name: 'Mid', age: 50 })
    })
    // Allow the cached engine's refill loop to complete (502 rows / 100 pageSize).
    await new Promise((r) => setTimeout(r, 200))

    // Re-mount - cache hit, both inserts should already be in their sorted spots.
    const b = renderHook(() => useSqliteValue(sql, { sortBy: 'age', pageSize: 100, cacheKey: 'big' }, []))
    await waitFor(() => {
      expect(b.result.current.data?.find((p) => p.id === 'low-while-out')).toBeDefined()
      expect(b.result.current.data?.find((p) => p.id === 'mid-while-out')).toBeDefined()
    })
    const data = b.result.current.data ?? []
    const ages = data.map((p) => p.age)
    const sorted = ages.toSorted((x, y) => x - y)
    expect(ages).toEqual(sorted)

    b.unmount()
    clearSqliteCache(sql, 'big')
  })
})
