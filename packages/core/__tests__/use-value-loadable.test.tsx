import { renderHook, act } from '@testing-library/react-hooks'
import { waitFor } from '@testing-library/react'
import { create } from '../create'
import { useValueLoadable } from '../use-value-loadable'
import { longPromise } from './test-utils'

describe('useValueLoadable', () => {
  it('should return value immediately for sync state', () => {
    const state = create(42)
    const { result } = renderHook(() => useValueLoadable(state))

    const [value, isLoading, isError, error] = result.current
    expect(value).toBe(42)
    expect(isLoading).toBe(false)
    expect(isError).toBe(false)
    expect(error).toBeUndefined()
  })

  it('should return loading state for async state', async () => {
    const state = create(longPromise(50))
    const { result } = renderHook(() => useValueLoadable(state))

    // Initially loading
    expect(result.current[0]).toBeUndefined()
    expect(result.current[1]).toBe(true)
    expect(result.current[2]).toBe(false)
    expect(result.current[3]).toBeUndefined()

    // After resolution
    await waitFor(() => {
      expect(result.current[0]).toBe(0)
      expect(result.current[1]).toBe(false)
      expect(result.current[2]).toBe(false)
      expect(result.current[3]).toBeUndefined()
    })
  })

  it('should return error state when state throws', () => {
    const testError = new Error('Test error')
    const state = create(() => {
      throw testError
    })
    const { result } = renderHook(() => useValueLoadable(state))

    const [value, isLoading, isError, error] = result.current
    expect(value).toBeUndefined()
    expect(isLoading).toBe(false)
    expect(isError).toBe(true)
    expect(error).toBe(testError)
  })

  it('should return error state when async state rejects', async () => {
    const testError = new Error('Async error')
    const state = create(Promise.reject(testError))
    const { result } = renderHook(() => useValueLoadable(state))

    await waitFor(() => {
      expect(result.current[0]).toBeUndefined()
      expect(result.current[1]).toBe(false)
      expect(result.current[2]).toBe(true)
      expect(result.current[3]).toBe(testError)
    })
  })

  it('should update when sync state changes', async () => {
    const state = create(1)
    const { result } = renderHook(() => useValueLoadable(state))

    expect(result.current[0]).toBe(1)

    act(() => {
      state.set(2)
    })

    await waitFor(() => {
      expect(result.current[0]).toBe(2)
      expect(result.current[1]).toBe(false)
      expect(result.current[2]).toBe(false)
    })
  })

  it('should work with selector', () => {
    const state = create({ count: 10, name: 'test' })
    const { result } = renderHook(() => useValueLoadable(state, (s) => s.count))

    const [value, isLoading, isError] = result.current
    expect(value).toBe(10)
    expect(isLoading).toBe(false)
    expect(isError).toBe(false)
  })

  it('should work with selector on async state', async () => {
    const state = create(Promise.resolve({ count: 5, name: 'async' }))
    const { result } = renderHook(() => useValueLoadable(state, (s) => s.count))

    // Initially loading
    expect(result.current[1]).toBe(true)

    await waitFor(() => {
      expect(result.current[0]).toBe(5)
      expect(result.current[1]).toBe(false)
    })
  })

  it('should not throw to suspense boundary', async () => {
    const state = create(longPromise(50))
    const renderCount = jest.fn()

    const { result } = renderHook(() => {
      renderCount()
      return useValueLoadable(state)
    })

    // Should render without throwing
    expect(renderCount).toHaveBeenCalled()
    expect(result.current[1]).toBe(true)

    await waitFor(() => {
      expect(result.current[1]).toBe(false)
    })
  })

  it('should provide type narrowing when isLoading is false', () => {
    const state = create(42)
    const { result } = renderHook(() => useValueLoadable(state))

    const [value, isLoading, isError] = result.current

    if (!isLoading && !isError) {
      // TypeScript should know value is number here
      const number_: number = value
      expect(number_).toBe(42)
    }
  })
})
