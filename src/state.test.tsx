/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable no-shadow */
import { Suspense } from 'react'
import { create } from './create'
import { renderHook, act, waitFor, render, screen } from '@testing-library/react'
import { shallow } from './shallow'
describe('state', () => {
  it('should test state', () => {
    const appState = create({ count: 0 })
    expect(appState.getState()).toEqual({ count: 0 })
  })

  it('should render state with promise hook', async () => {
    const promise = Promise.resolve({ count: 100 })
    const appState = create(promise)
    const renderCount = { current: 0 }
    // const

    const result = renderHook(() => {
      renderCount.current++
      return appState()
    })
    // wait for the promise to be resolved
    await waitFor(() => {})
    expect(result.result.current).toEqual({ count: 100 })
    // count rendered
    expect(renderCount.current).toEqual(2)
    expect(appState.getState()).toEqual({ count: 100 })
  })

  it('should render state with get promise hook', async () => {
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const getPromise = () => Promise.resolve({ count: 100 })
    const appState = create(getPromise)
    const renderCount = { current: 0 }
    // const

    const result = renderHook(() => {
      renderCount.current++
      return appState()
    })
    // wait for the promise to be resolved
    await waitFor(() => {})
    act(() => {
      appState.setState({ count: 15 })
    })
    expect(result.result.current).toEqual({ count: 15 })
    // count rendered
    expect(renderCount.current).toEqual(3)
    expect(appState.getState()).toEqual({ count: 15 })
  })

  it('should render state with get promise check default', async () => {
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const getPromise = () => Promise.resolve({ count: 100 })
    const appState = create(getPromise)
    // const

    // wait for the promise to be resolved
    await waitFor(() => {})
    act(() => {
      appState.setState({ count: 15 })
    })
    expect(appState.getState()).toEqual({ count: 15 })
    // count rendered
    act(() => {
      appState.reset()
    })
    expect(appState.getState()).toEqual({ count: 15 })
  })

  it('should render state with get hook', async () => {
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const get = () => ({ count: 100 })
    const appState = create(get)
    const renderCount = { current: 0 }
    // const

    const result = renderHook(() => {
      renderCount.current++
      return appState()
    })
    // wait for the promise to be resolved
    await waitFor(() => {})
    act(() => {
      appState.setState({ count: 15 })
    })
    expect(result.result.current).toEqual({ count: 15 })
    // count rendered
    expect(renderCount.current).toEqual(2)
    expect(appState.getState()).toEqual({ count: 15 })

    act(() => {
      appState.reset()
    })
    expect(result.result.current).toEqual({ count: 100 })
  })

  it('should render state with get', async () => {
    let wasCalled = false
    const get = () => {
      wasCalled = true
      return { count: 100 }
    }
    const appState = create(get)
    expect(wasCalled).toEqual(false)
    appState.getState()
    expect(wasCalled).toEqual(true)
  })
  it('should render state with get hook', async () => {
    let wasCalled = false
    const get = () => {
      wasCalled = true
      return { count: 100 }
    }
    const appState = create(get)
    expect(wasCalled).toEqual(false)
    renderHook(() => {
      appState()
    })
    expect(wasCalled).toEqual(true)
  })

  it('should render state with promise with suspense', async () => {
    const promise = Promise.resolve({ count: 100 })
    const appState = create(promise)
    const renderCount = { current: 0 }

    const MockedComponent = jest.fn(() => <div>loading</div>)
    const MockedComponentAfterSuspense = jest.fn(() => <div>loaded</div>)
    // const
    function Component() {
      renderCount.current++
      return (
        <div>
          {appState().count}
          <MockedComponentAfterSuspense />
        </div>
      )
    }
    render(
      <Suspense fallback={<MockedComponent />}>
        <Component />
      </Suspense>,
    )
    expect(MockedComponent).toHaveBeenCalledTimes(1)
    expect(MockedComponentAfterSuspense).toHaveBeenCalledTimes(0)
    await waitFor(() => {
      return screen.getByText('100')
    })
    expect(MockedComponent).toHaveBeenCalledTimes(1)
    expect(MockedComponentAfterSuspense).toHaveBeenCalledTimes(1)
  })

  it('should render state', () => {
    const appState = create({ count: 0 })
    const renderCount = { current: 0 }
    // const

    const result = renderHook(() => {
      renderCount.current++
      return appState()
    })
    expect(result.result.current).toEqual({ count: 0 })
    // count rendered
    expect(renderCount.current).toEqual(1)
  })

  it('should render state', () => {
    const appState = create({ count: 0 })
    const slice = appState.select((slice) => slice.count)
    const renderCount = { current: 0 }
    // const

    const result = renderHook(() => {
      renderCount.current++
      return slice()
    })
    expect(result.result.current).toEqual(0)
    // count rendered
    expect(renderCount.current).toEqual(1)
  })

  it('should render state with change', () => {
    const appState = create({ count: 0 })
    const renderCount = { current: 0 }
    // const

    const result = renderHook(() => {
      renderCount.current++
      return appState((slice) => slice)
    })

    act(() => {
      appState.setState({ count: 1 })
    })
    expect(result.result.current).toEqual({ count: 1 })
    expect(renderCount.current).toEqual(2)
  })

  it('should render state with slice change', () => {
    const appState = create({ count: { nested: 0, array: [0] } })
    const renderCount = { current: 0 }
    const useNestedSlice = appState.select((slice) => slice.count)
    const useNestedSliceArray = appState.select((slice) => slice.count.array.length)
    const result = renderHook(() => {
      return appState()
    })
    const sliceResult = renderHook(() => {
      renderCount.current++
      return useNestedSlice()
    })
    const sliceArrayResult = renderHook(() => {
      return useNestedSliceArray()
    })
    expect(sliceArrayResult.result.current).toEqual(1)
    expect(sliceResult.result.current).toEqual({ nested: 0, array: [0] })
    act(() => {
      appState.setState({ count: { nested: 2, array: [0] } })
    })

    expect(result.result.current).toEqual({ count: { nested: 2, array: [0] } })
    expect(sliceResult.result.current).toEqual({ nested: 2, array: [0] })

    act(() => {
      appState.setState({ count: { nested: 2, array: [1, 2, 4] } })
    })
    expect(sliceArrayResult.result.current).toEqual(3)
  })

  it('should render multiple state', () => {
    const mainState = create({ count: { nestedCount: 2 } })
    const slice1 = mainState.select((slice) => slice.count)
    const slice2FromSlice1 = slice1.select((slice) => slice.nestedCount)

    const slice2FromSlice1Result = renderHook(() => slice2FromSlice1())
    expect(slice2FromSlice1Result.result.current).toEqual(2)

    act(() => {
      mainState.setState({ count: { nestedCount: 3 } })
    })
    expect(slice2FromSlice1Result.result.current).toEqual(3)
  })

  it('should render multiple state with change', () => {
    const appState = create({ count: 0 })
    const renderCount1 = { current: 0 }
    const renderCount2 = { current: 0 }
    // const

    const result1 = renderHook(() => {
      renderCount1.current++
      return appState()
    })
    const result2 = renderHook(() => {
      renderCount2.current++
      return appState((slice) => slice.count)
    })
    act(() => {
      appState.setState({ count: 1 })
    })
    expect(result1.result.current).toEqual({ count: 1 })
    expect(result2.result.current).toEqual(1)
    expect(renderCount1.current).toEqual(2)
    expect(renderCount2.current).toEqual(2)
  })

  it('should test initial state', () => {
    const appState = create({ count: 0 })
    expect(appState.getState()).toEqual({ count: 0 })
  })

  it('should render initial state', () => {
    const appState = create({ count: 0 })
    const renderCount = { current: 0 }

    const result = renderHook(() => {
      renderCount.current++
      return appState()
    })
    expect(result.result.current).toEqual({ count: 0 })
    expect(renderCount.current).toEqual(1)
  })

  it('should render state after change', () => {
    const appState = create({ count: 0 })
    const renderCount = { current: 0 }

    const result = renderHook(() => {
      renderCount.current++
      return appState((slice) => slice)
    })

    act(() => {
      appState.setState({ count: 1 })
    })
    expect(result.result.current).toEqual({ count: 1 })
    expect(renderCount.current).toEqual(2)
  })

  it('should render state with nested slice change', () => {
    const appState = create({ count: { nested: 0, array: [0] } })
    const renderCount = { current: 0 }
    const useNestedSlice = appState.select((slice) => slice.count)
    const useNestedSliceArray = appState.select((slice) => slice.count.array.length)

    const result = renderHook(() => appState())
    const sliceResult = renderHook(() => {
      renderCount.current++
      return useNestedSlice()
    })
    const sliceArrayResult = renderHook(() => useNestedSliceArray())

    expect(sliceArrayResult.result.current).toEqual(1)
    expect(sliceResult.result.current).toEqual({ nested: 0, array: [0] })

    act(() => {
      appState.setState({ count: { nested: 2, array: [0] } })
    })
    expect(result.result.current).toEqual({ count: { nested: 2, array: [0] } })
    expect(sliceResult.result.current).toEqual({ nested: 2, array: [0] })

    act(() => {
      appState.setState({ count: { nested: 2, array: [1, 2, 4] } })
    })
    expect(sliceArrayResult.result.current).toEqual(3)
  })

  it('should render multiple state slices with updates', () => {
    const mainState = create({ count: { nestedCount: 2 } })
    const slice1 = mainState.select((slice) => slice.count)
    const slice2FromSlice1 = slice1.select((slice) => slice.nestedCount)

    const slice2FromSlice1Result = renderHook(() => slice2FromSlice1())
    expect(slice2FromSlice1Result.result.current).toEqual(2)

    act(() => {
      mainState.setState({ count: { nestedCount: 3 } })
    })
    expect(slice2FromSlice1Result.result.current).toEqual(3)
  })

  it('should render multiple components observing the same state', () => {
    const appState = create({ count: 0 })
    const renderCount1 = { current: 0 }
    const renderCount2 = { current: 0 }

    const result1 = renderHook(() => {
      renderCount1.current++
      return appState()
    })
    const result2 = renderHook(() => {
      renderCount2.current++
      return appState((slice) => slice.count)
    })

    act(() => {
      appState.setState({ count: 1 })
    })
    expect(result1.result.current).toEqual({ count: 1 })
    expect(result2.result.current).toEqual(1)
    expect(renderCount1.current).toEqual(2)
    expect(renderCount2.current).toEqual(2)
  })

  it('should reset state to default value', () => {
    const appState = create({ count: 0 })
    act(() => {
      appState.setState({ count: 10 })
    })
    expect(appState.getState()).toEqual({ count: 10 })

    act(() => {
      appState.reset()
    })
    expect(appState.getState()).toEqual({ count: 0 })
  })

  it('should handle updates with deep nesting in state', () => {
    const appState = create({ data: { nested: { value: 1 } } })
    const nestedSlice = appState.select((s) => s.data.nested.value)

    const result = renderHook(() => nestedSlice())
    expect(result.result.current).toEqual(1)

    act(() => {
      appState.setState({ data: { nested: { value: 2 } } })
    })
    expect(result.result.current).toEqual(2)
  })

  it('should not re-render for unrelated slice changes', () => {
    const appState = create({ count: 0, unrelated: 5 })
    const renderCount = { current: 0 }

    const countSlice = appState.select((state) => state.count)
    const unrelatedSlice = appState.select((state) => state.unrelated)

    renderHook(() => {
      renderCount.current++
      return countSlice()
    })

    const unrelatedResult = renderHook(() => unrelatedSlice())
    expect(renderCount.current).toEqual(1)

    act(() => {
      return appState.setState({ unrelated: 10 } as never)
    })

    expect(unrelatedResult.result.current).toEqual(10)
    expect(renderCount.current).toEqual(2) // No re-render for count slice
  })

  it('should not re-render where isEqual return true on state', () => {
    const appState = create({ count: 0 }, () => true)
    const renderCount = { current: 0 }

    renderHook(() => {
      renderCount.current++
      return appState()
    })

    act(() => {
      appState.setState({ count: 10 })
    })

    expect(renderCount.current).toEqual(1)
  })

  it('should not re-render where isEqual return true hook slice', () => {
    const appState = create({ count: 0 })
    const renderCount = { current: 0 }

    renderHook(() => {
      renderCount.current++
      return appState(
        (slice) => slice,
        () => true,
      )
    })

    act(() => {
      appState.setState({ count: 10 })
    })

    expect(renderCount.current).toEqual(1)
  })

  it('should not re-render where isEqual return true on slice', () => {
    const appState = create({ count: 0 })
    const appStateSlice = appState.select(
      (slice) => slice.count,
      () => true,
    )
    const renderCount = { current: 0 }

    renderHook(() => {
      renderCount.current++
      return appStateSlice()
    })

    act(() => {
      appState.setState({ count: 10 })
    })
    expect(renderCount.current).toEqual(1)
  })

  it('should not re-render where isEqual return true on nested slice', () => {
    const appState = create({ count: { nested: { count: 0 } } })
    const appStateSlice = appState.select((slice) => slice.count)
    const nestedAppSlice = appStateSlice.select(
      (slice) => slice.nested.count,
      () => true,
    )
    const renderCount = { current: 0 }

    renderHook(() => {
      renderCount.current++
      return nestedAppSlice()
    })

    act(() => {
      appState.setState({ count: { nested: { count: 10 } } })
    })
    expect(renderCount.current).toEqual(1)
  })
  it('should use merge states', () => {
    const state1 = create(3)
    const state2 = create(2)
    const mergedState = state1.merge(state2, (s1, s2) => s1 + s2)
    const result = renderHook(() => mergedState())
    expect(result.result.current).toEqual(5)
    act(() => {
      state1.setState(5)
    })
    expect(result.result.current).toEqual(7)
    act(() => {
      state2.setState(3)
    })
    expect(result.result.current).toEqual(8)
  })

  it('should use merge states nested', () => {
    const useName = create(() => 'John')
    const useAge = create(() => 30)
    const useUser = useName.merge(useAge, (name, age) => ({ name, age }), shallow)
    const result = renderHook(() => useUser())
    expect(result.result.current).toEqual({ name: 'John', age: 30 })

    act(() => {
      useName.setState('Jane')
    })
    expect(result.result.current).toEqual({ name: 'Jane', age: 30 })
  })

  it('should use slice with new reference', () => {
    const useName = create(() => 'John')
    const useDifferentName = useName.select(
      (name) => ({
        name,
      }),
      shallow,
    )
    const result = renderHook(() => useDifferentName())
    expect(result.result.current).toEqual({ name: 'John' })
    act(() => {
      useName.setState('Jane')
    })
    expect(result.result.current).toEqual({ name: 'Jane' })
  })
  it('should check if subscribe works', () => {
    const appState = create({ count: 0 })
    let count = 0
    const unsubscribe = appState.subscribe((state) => {
      expect(state).toEqual({ count })
      count++
    })

    act(() => {
      appState.setState({ count: 1 })
    })
    expect(count).toEqual(2)

    unsubscribe()
    act(() => {
      appState.setState({ count: 2 })
    })
    expect(count).toEqual(2)
  })

  it('should handle rapid consecutive state updates', () => {
    const appState = create({ count: 0 })
    const renderCount = { current: 0 }

    const result = renderHook(() => {
      renderCount.current++
      return appState()
    })

    act(() => {
      // batch updates
      appState.setState({ count: 1 })
      appState.setState({ count: 2 })
      appState.setState({ count: 3 })
    })

    expect(result.result.current).toEqual({ count: 3 })
    expect(renderCount.current).toEqual(2) // it's batch
  })

  it('should handle setting state to the same value', () => {
    const appState = create({ count: 0 })
    const renderCount = { current: 0 }

    const result = renderHook(() => {
      renderCount.current++
      return appState()
    })

    act(() => {
      appState.setState((previous) => previous)
    })

    expect(result.result.current).toEqual({ count: 0 })
    expect(renderCount.current).toEqual(1)
  })

  it('should handle setting state with partial updates', () => {
    const appState = create({ count: 0, name: 'John' })
    const renderCount = { current: 0 }

    const result = renderHook(() => {
      renderCount.current++
      return appState()
    })

    act(() => {
      appState.updateState({ count: 1 })
    })

    expect(result.result.current).toEqual({ count: 1, name: 'John' })
    expect(renderCount.current).toEqual(2)
  })

  it('should handle resetting state after multiple updates', () => {
    const appState = create({ count: 0 })
    const renderCount = { current: 0 }

    const result = renderHook(() => {
      renderCount.current++
      return appState()
    })

    act(() => {
      appState.setState({ count: 1 })
      appState.setState({ count: 2 })
      appState.reset()
    })

    expect(result.result.current).toEqual({ count: 0 })
    expect(renderCount.current).toEqual(2)
  })

  it('should handle concurrent asynchronous state updates', async () => {
    const appState = create({ count: 0 })
    const renderCount = { current: 0 }

    const result = renderHook(() => {
      renderCount.current++
      return appState()
    })

    act(() => {
      // Simulate concurrent asynchronous updates
      appState.setState({ count: 1 })
      appState.setState({ count: 2 })
      appState.setState({ count: 3 })
    })

    await waitFor(() => {
      expect(result.result.current).toEqual({ count: 3 })
    })

    expect(renderCount.current).toBe(2)
  })
})
