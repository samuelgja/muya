import { renderHook, act } from '@testing-library/react-hooks'
import { create } from '../create'
import { useValue } from '../use-value'
import { waitFor } from '@testing-library/react'

describe('useValue', () => {
  it('should get the initial state value', () => {
    const state = create(1)
    const { result } = renderHook(() => useValue(state))
    expect(result.current).toBe(1)
  })

  it('should update when the state changes', async () => {
    const state = create(1)
    const { result } = renderHook(() => useValue(state))
    act(() => {
      state.set(2)
    })
    await waitFor(() => {
      expect(result.current).toBe(2)
    })
  })

  it('should use a selector function', () => {
    const state = create({ count: 1 })
    const { result } = renderHook(() => useValue(state, (s) => s.count))
    expect(result.current).toBe(1)
  })

  it('should handle errors thrown from state', () => {
    const error = new Error('Test error')
    const state = create(() => {
      throw error
    })
    const { result } = renderHook(() => useValue(state))
    expect(result.error).toBe(error)
  })

  it('should handle promises returned from state suspense', async () => {
    const promise = Promise.resolve(1)
    const state = create(() => promise)
    const renders = jest.fn()
    const { result } = renderHook(() => {
      renders()
      return useValue(state)
    })
    await waitFor(() => {})
    expect(result.current).toBe(1)
    expect(renders).toHaveBeenCalledTimes(2)
  })

  it('should unsubscribe on unmount', async () => {
    const state = create(1)
    const renders = jest.fn()
    const { unmount } = renderHook(() => {
      renders()
      const value = useValue(state)
      return value
    })
    act(() => {
      state.set(2)
    })
    await waitFor(() => {})
    expect(renders).toHaveBeenCalledTimes(2)
    unmount()
    act(() => {
      state.set(3)
    })
    await waitFor(() => {})
    expect(renders).toHaveBeenCalledTimes(2)
  })
})
