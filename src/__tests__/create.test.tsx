import { create, use } from '..'
import { renderHook, act } from '@testing-library/react-hooks'
import { waitFor } from '@testing-library/react'
import { longPromise } from './test-utils'

describe('create', () => {
  it('should throw error when calling states outside of context', () => {
    const state = create(1)
    expect(() => state()).toThrow()
  })
  it('should throw error when calling useStates outside of component', () => {
    const state = create(1)
    expect(() => state((value) => value)).toThrow()
  })
  it('should derive state within the context on', () => {
    const state1 = create(1)
    const state3 = create(10)
    const state2 = create(() => {
      return state1() + state1() + state1() + state1() + state3()
    })

    expect(state1.get()).toBe(1)
    expect(state2.get()).toBe(14)

    state1.set(2)

    expect(state1.get()).toBe(2)
    expect(state2.get()).toBe(18)

    const result = renderHook(() => use(state2, (value) => value + 1))
    expect(result.result.current).toBe(19)

    act(() => {
      state1.set(3)
    })

    expect(result.result.current).toBe(23)
  })
  it('should derive state within the context via another functions', () => {
    const state1 = create(1)
    const state3 = create(10)

    // this is part is separate function for a state
    function sum() {
      return state1() + state1() + state1() + state1() + state3()
    }
    const state2 = create(sum)

    expect(state1.get()).toBe(1)
    expect(state2.get()).toBe(14)

    state1.set(2)

    expect(state1.get()).toBe(2)
    expect(state2.get()).toBe(18)

    const result = renderHook(() => use(state2, (value) => value + 1))
    expect(result.result.current).toBe(19)

    act(() => {
      state1.set(3)
    })

    expect(result.result.current).toBe(23)
  })
  it('should have only 2 re-renders when updating state via batch', () => {
    const reRenders = jest.fn()
    const state = create(1)

    const result = renderHook(() => {
      reRenders()
      return use(state)
    })
    expect(result.result.current).toBe(1)
    expect(reRenders).toHaveBeenCalledTimes(1)

    act(() => {
      state.set(2)
      state.set(3)
      state.set(4)
    })
    expect(result.result.current).toBe(4)
    expect(reRenders).toHaveBeenCalledTimes(2)
  })

  it('should have only 2 re-renders when updating state via derived', () => {
    const reRenders = jest.fn()
    const state1 = create(1)
    const state2 = create(() => state1() + 1)
    const state3 = create(() => state2() + 1)

    const result = renderHook(() => {
      reRenders()
      return use(state3)
    })
    expect(result.result.current).toBe(3)
    expect(reRenders).toHaveBeenCalledTimes(1)

    act(() => {
      state1.set(2)
      state1.set(3)
      state1.set((_previous) => 4)
    })
    expect(result.result.current).toBe(6)
    expect(reRenders).toHaveBeenCalledTimes(2)
  })

  it('should render value properly with promise and but set is disabled', async () => {
    const state1 = create(longPromise)
    const reRender = jest.fn()
    const result = renderHook(() => {
      reRender()
      return use(state1)
    })
    expect(result.result.current).toBe(undefined)
    expect(reRender).toHaveBeenCalledTimes(1)
  })

  it('should render value properly with promise and cancel it', async () => {
    const state1 = create(longPromise(50_000))
    const reRender = jest.fn()
    const result = renderHook(() => {
      reRender()
      return use(state1)
    })
    expect(result.result.current).toBe(undefined)
    expect(reRender).toHaveBeenCalledTimes(1)

    act(() => {
      // this will cancel promise and set new value for 10 immediately
      state1.set(10)
    })

    await waitFor(() => {
      expect(result.result.current).toBe(10)
    })
    expect(result.result.current).toBe(10)
    expect(reRender).toHaveBeenCalledTimes(2)
  })

  it('should render value properly with promise - but set state with wait', async () => {
    const state1 = create(longPromise(500))
    const reRender = jest.fn()
    const result = renderHook(() => {
      reRender()
      return use(state1)
    })
    expect(result.result.current).toBe(undefined)
    expect(reRender).toHaveBeenCalledTimes(1)

    act(() => {
      state1.set(async (promise) => {
        // waiting for the promise to be resolved
        await promise
        return 10
      })
    })
    await waitFor(() => {
      expect(result.result.current).toBe(10)
    })
    expect(result.result.current).toBe(10)
    expect(reRender).toHaveBeenCalledTimes(2)
  })
  it('should render value properly with promise - but set state without wait', async () => {
    const state1 = create(longPromise(50_000))
    const reRender = jest.fn()
    const result = renderHook(() => {
      reRender()
      return use(state1)
    })
    expect(result.result.current).toBe(undefined)
    expect(reRender).toHaveBeenCalledTimes(1)

    act(() => {
      state1.set(async () => {
        // Not waiting for the promise, it will cancel current promise and resolve with 10
        return 10
      })
    })
    await waitFor(() => {
      expect(result.result.current).toBe(10)
    })
    expect(result.result.current).toBe(10)
    expect(reRender).toHaveBeenCalledTimes(2)
  })
  it('should create base state and compute another state as async', async () => {
    const beforeRenders = jest.fn()
    const afterRenders = jest.fn()
    const counter = create(0)
    const computed = create(async () => {
      await longPromise(100)
      const value = counter() + 1
      await longPromise(100)
      return value
    })

    const result = renderHook(() => {
      beforeRenders()
      const hook = use(computed)
      afterRenders()
      return hook
    })
    expect(result.result.current).toBe(undefined)
    expect(beforeRenders).toHaveBeenCalledTimes(1)
    expect(afterRenders).toHaveBeenCalledTimes(0)

    await waitFor(() => {
      expect(result.result.current).toBe(1)
    })

    expect(result.result.current).toBe(1)
    expect(beforeRenders).toHaveBeenCalledTimes(2)
    expect(afterRenders).toHaveBeenCalledTimes(1)
    act(() => {
      counter.set(1)
    })
    await waitFor(() => {
      expect(result.result.current).toBe(2)
      expect(computed.get()).toBe(2)
    })
    expect(result.result.current).toBe(2)
    expect(beforeRenders).toHaveBeenCalledTimes(4)
    expect(afterRenders).toHaveBeenCalledTimes(2)
  })

  it('should render only based on deriver state', async () => {
    const userState = create({ userName: 'John', age: 25 })
    // const userName = create(() => userState((data) => data.userName))
    const ageState = create(() => userState((data) => data.age))
    const reRenders = jest.fn()
    const result = renderHook(() => {
      reRenders()
      return use(ageState)
    })
    expect(result.result.current).toBe(25)
    expect(reRenders).toHaveBeenCalledTimes(1)

    act(() => {
      userState.set((previous) => ({ ...previous, age: 1000 }))
    })

    await waitFor(() => {
      expect(result.result.current).toBe(1000)
    })
  })
})
