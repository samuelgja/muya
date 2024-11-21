/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable no-shadow */
import { act, renderHook } from '@testing-library/react-hooks'
import { create } from '../create'
import { use } from '../use'
import { waitFor } from '@testing-library/react'
import { useCallback } from 'react'
import { getDebugCacheCreation } from '../utils/sub-memo'

describe('use-create', () => {
  const reRendersBefore = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should test use hook', async () => {
    const state = create(1)

    const { result } = renderHook(() => {
      reRendersBefore()
      return use(state)
    })

    state.set(2)

    await waitFor(() => {})
    expect(result.current).toBe(2)
    expect(reRendersBefore).toHaveBeenCalledTimes(2)

    state.set(3)

    await waitFor(() => {})
    expect(result.current).toBe(3)
    expect(reRendersBefore).toHaveBeenCalledTimes(3)
  })

  it('should test derived state with multiple states', async () => {
    const state1 = create(1)
    const state2 = create(2)

    function derivedBefore(plusValue: number) {
      return state1() + state2() + plusValue
    }

    function derived() {
      return state1() + state2() + derivedBefore(10)
    }

    const { result } = renderHook(() => {
      reRendersBefore()
      return use(derived)
    })

    await waitFor(() => {})
    expect(reRendersBefore).toHaveBeenCalledTimes(1)
    act(() => {
      state1.set(2)
      state2.set(3)
    })

    await waitFor(() => {})
    expect(result.current).toBe(20)
    expect(reRendersBefore).toHaveBeenCalledTimes(2)
  })

  it('should test use hook without memoize fn', async () => {
    const state1 = create(1)
    const state2 = create(2)

    function derivedBefore(plusValue: number) {
      return state1() + state2() + plusValue
    }

    function derived(add: number) {
      return state1() + state2() + derivedBefore(add)
    }

    const { result } = renderHook(() => {
      reRendersBefore()
      return use(() => derived(10))
    })
    expect(getDebugCacheCreation()).toBe(1)

    await waitFor(() => {})
    expect(reRendersBefore).toHaveBeenCalledTimes(1)
    act(() => {
      state1.set(2)
      state2.set(3)
    })
    expect(getDebugCacheCreation()).toBe(1)
    await waitFor(() => {})
    expect(result.current).toBe(20)
    expect(reRendersBefore).toHaveBeenCalledTimes(2)
  })

  it('should test use hook with memoize fn', async () => {
    const state1 = create(1)
    const state2 = create(2)

    function derivedBefore(plusValue: number) {
      return state1() + state2() + plusValue
    }

    function derived(add: number) {
      return state1() + state2() + derivedBefore(add)
    }

    const { result } = renderHook(() => {
      reRendersBefore()
      const memoized = useCallback(() => derived(10), [])
      return use(memoized)
    })
    expect(getDebugCacheCreation()).toBe(1)

    await waitFor(() => {})
    expect(reRendersBefore).toHaveBeenCalledTimes(1)
    act(() => {
      state1.set(2)
      state2.set(3)
    })
    expect(getDebugCacheCreation()).toBe(1)
    await waitFor(() => {})
    expect(result.current).toBe(20)
    expect(reRendersBefore).toHaveBeenCalledTimes(2)
  })
})
