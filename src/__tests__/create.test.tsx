import { Suspense } from 'react'
import { create } from '../create'
import { renderHook, waitFor, act, render } from '@testing-library/react'
import { ErrorBoundary, longPromise } from './test-utils'

describe('create', () => {
  it('should create test with base value', () => {
    const state = create(0)
    const result = renderHook(() => state())
    expect(result.result.current).toBe(0)
  })
  it('should create test with function', () => {
    const state = create(() => 0)
    const result = renderHook(() => state())
    expect(result.result.current).toBe(0)
  })
  it('should create test with promise', async () => {
    const state = create(Promise.resolve(0))
    const result = renderHook(() => state())
    await waitFor(() => {
      expect(result.result.current).toBe(0)
    })
  })
  it('should create test with promise and wait to be resolved', async () => {
    const state = create(longPromise)
    const result = renderHook(() => state(), { wrapper: ({ children }) => <Suspense fallback={null}>{children}</Suspense> })

    await waitFor(() => {
      expect(result.result.current).toBe(0)
    })
  })
  it('should create test with lazy promise and wait to be resolved', async () => {
    const state = create(async () => await longPromise())
    const result = renderHook(() => state(), { wrapper: ({ children }) => <Suspense fallback={null}>{children}</Suspense> })

    await waitFor(() => {
      expect(result.result.current).toBe(0)
    })
  })
  it('should create test with promise and set value during the promise is pending', async () => {
    const state = create(longPromise)
    const result = renderHook(() => state(), { wrapper: ({ children }) => <Suspense fallback={null}>{children}</Suspense> })

    act(() => {
      state.setState(10)
    })
    await waitFor(() => {
      expect(result.result.current).toBe(10)
    })
  })

  it('should create test with lazy promise and set value during the promise is pending', async () => {
    const state = create(async () => await longPromise())
    const result = renderHook(() => state(), { wrapper: ({ children }) => <Suspense fallback={null}>{children}</Suspense> })

    act(() => {
      state.setState(10)
    })
    await waitFor(() => {
      expect(result.result.current).toBe(10)
    })
  })

  it('should fail inside the hook when the promise is rejected with not abort isWithError', async () => {
    const state = create(Promise.reject('error-message'))

    function Component() {
      state()
      return null
    }

    const result = render(
      <ErrorBoundary fallback={<div>An error occurred.</div>}>
        <Suspense fallback={'suspense-error'}>
          <Component />
        </Suspense>
      </ErrorBoundary>,
    )

    await waitFor(() => {
      expect(result.container.textContent).toBe('An error occurred.')
    })
  })
})
