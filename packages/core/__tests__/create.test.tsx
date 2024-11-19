import { renderHook, act } from '@testing-library/react-hooks'
import { waitFor } from '@testing-library/react'
import { longPromise } from './test-utils'
import { create } from '../create'

// const state1 = create(1)

// function sum() {
//   return state1() + 1
// }

// function otherSum() {
//   return state1() + sum()
// }

describe('create', () => {
  it('should render basic state async', async () => {
    const state = create(1)
    expect(state()).toBe(1)

    state.set(2)
    await waitFor(() => {
      expect(state()).toBe(2)
    })

    const statePromise = create(Promise.resolve(1))
    expect(await statePromise()).toBe(1)
    expect(await statePromise()).toBe(1)
  })

  it('should render basic state with derived sync', async () => {
    const state1 = create(1)
    const derived2 = create(() => state1() + 1)
    const derived3 = create(() => derived2() + state1() + 1)
    const derived10 = create(() => state1())
    const another = create(123)
    let totalValueChange = 0
    let totalDerivedChange = 0
    let totalDerived2Change = 0

    state1.subscribe((value) => {
      console.log('STATE#1', value)
      totalValueChange++
    })
    derived2.subscribe((value) => {
      console.log('DERIVE#2', value)
      totalDerivedChange++
    })
    derived3.subscribe((value) => {
      console.log('DERIVE#3', value)
      totalDerived2Change++
    })
    expect(state1()).toBe(1)
    expect(derived2()).toBe(2)

    expect(derived3()).toBe(4)

    act(() => {
      state1.set(2)
    })

    await waitFor(() => {})
    expect(state1()).toBe(2)
    expect(derived2()).toBe(3)
    expect(derived3()).toBe(6)

    expect(totalValueChange).toBe(2)
    expect(totalDerivedChange).toBe(2)
    expect(totalDerived2Change).toBe(2)
  })

  it('should render basic state with async derived without nested', async () => {
    const state = create(1)
    const derived = create(async () => state() + 1)

    let totalValueChange = 0
    let totalDerivedChange = 0
    state.subscribe(() => {
      totalValueChange++
    })
    derived.subscribe(() => {
      totalDerivedChange++
    })
    expect(state()).toBe(1)
    expect(await derived()).toBe(2)

    act(() => {
      state.set(2)
    })

    await waitFor(() => {})
    expect(state()).toBe(2)
    expect(derived()).toBe(3)

    expect(totalValueChange).toBe(2)
    // called 4 times, because on load it return promise, then it resolve to 2 and then again promise which resolve to 3
    expect(totalDerivedChange).toBe(4)
  })

  it('should render basic state with async derived and async parent', async () => {
    const state = create(Promise.resolve(1))
    const derived = create(async () => (await state()) + 1)
    const derived3 = create(async () => {
      const stateValue = await state()
      const derivedValue = await derived()
      return stateValue + derivedValue + 1
    })
    const derived4 = create(async () => {
      const stateValue = await state()
      const derivedValue = await derived()
      return stateValue + derivedValue + (await derived3()) + 1
    })

    let totalValueChange = 0
    let totalDerivedChange = 0
    let totalDerived3Change = 0
    let totalDerived4Change = 0
    state.subscribe(() => {
      totalValueChange++
    })
    derived.subscribe(() => {
      totalDerivedChange++
    })
    derived3.subscribe((state) => {
      console.log('DERIVE#3', state)
      totalDerived3Change++
    })
    derived4.subscribe((state) => {
      console.log('DERIVE#4', state)
      totalDerived4Change++
    })

    expect(await state()).toBe(1)
    expect(await derived()).toBe(2)
    expect(await derived3()).toBe(4)
    expect(await derived4()).toBe(8)

    act(() => {
      state.set(2)
    })

    await waitFor(() => {
      expect(state()).toBe(2)
      expect(derived()).toBe(3)
      expect(derived3()).toBe(6)
      expect(derived4()).toBe(12)
    })

    expect(totalValueChange).toBe(3)
    expect(totalDerivedChange).toBe(6)
    expect(totalDerived3Change).toBe(6)
    expect(totalDerived4Change).toBe(6)
  })

  it('should derive state within the context on', async () => {
    const state1 = create(1)
    const state3 = create(10)
    const state2 = create(() => {
      return state1() + state1() + state1() + state1() + state3()
    })

    expect(state1()).toBe(1)
    expect(state2()).toBe(14)

    state1.set(2)

    await waitFor(() => {
      expect(state1()).toBe(2)
      expect(state2()).toBe(18)
    })

    const result = renderHook(() => use(state2, (value) => value + 1))

    await waitFor(() => {
      expect(result.result.current).toBe(19)
    })

    act(() => {
      state1.set(3)
    })

    await waitFor(() => {
      expect(result.result.current).toBe(23)
    })
  })
  it('should derive state within the context via another functions', async () => {
    const state1 = create(1)
    const state3 = create(10)

    // this is part is separate function for a state
    function sum() {
      return state1() + state1() + state1() + state1() + state3()
    }
    const state2 = create(sum)

    await waitFor(() => {
      expect(state1()).toBe(1)
      expect(state2()).toBe(14)
    })

    state1.set(2)

    await waitFor(() => {
      expect(state1()).toBe(2)
      expect(state2()).toBe(18)
    })

    const result = renderHook(() => use(state2, (value) => value + 1))

    await waitFor(() => {
      // expect()
      expect(result.result.current).toBe(19)
    })

    act(() => {
      state1.set(3)
    })

    await waitFor(() => {
      expect(result.result.current).toBe(23)
    })
  })
  it('should have only 2 re-renders when updating state via batch', async () => {
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
    await waitFor(() => {
      expect(result.result.current).toBe(4)
    })
    expect(reRenders).toHaveBeenCalledTimes(2)
  })

  it('should have only 2 re-renders when updating state via derived', async () => {
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
    await waitFor(() => {
      expect(result.result.current).toBe(6)
    })
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
    const state1 = create(longPromise(20))
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
    await longPromise(100)
    await waitFor(() => {
      expect(state1()).toBe(10)
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
      expect(computed()).toBe(2)
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

  it('should re-render only based on deriver state sync', async () => {
    const counter = create(1)
    const asyncMuya = create(() => counter() * 5)
    const renderBefore = jest.fn()
    const renderAfter = jest.fn()
    const result = renderHook(
      () => {
        renderBefore()
        const counterValue = use(counter)
        const asyncCounter = use(asyncMuya)
        renderAfter()
        return { counterValue, asyncCounter }
      },
      // { wrapper: ({ children }) => <Suspense fallback="loading">{children}</Suspense> },
    )

    await waitFor(() => {
      expect(result.result.current.counterValue).toBe(1)
      expect(result.result.current.asyncCounter).toBe(5)
    })
    expect(renderBefore).toHaveBeenCalledTimes(1)
    expect(renderAfter).toHaveBeenCalledTimes(1)

    act(() => {
      counter.set(3)
    })

    await waitFor(() => {
      expect(result.result.current.counterValue).toBe(3)
      expect(result.result.current.asyncCounter).toBe(15)
    })

    expect(renderBefore).toHaveBeenCalledTimes(2)
    expect(renderAfter).toHaveBeenCalledTimes(2)
  })

  it('should re-render only based on deriver state async ', async () => {
    const counter = create(1)
    const asyncMuya = create(async () => counter() * 5)
    const renderBefore = jest.fn()
    const renderAfter = jest.fn()
    const result = renderHook(() => {
      renderBefore()
      const counterValue = use(counter)
      const asyncCounter = use(asyncMuya)
      renderAfter()
      return { counterValue, asyncCounter }
    })

    await waitFor(() => {
      expect(result.result.current.counterValue).toBe(1)
      expect(result.result.current.asyncCounter).toBe(5)
    })
    expect(renderBefore).toHaveBeenCalledTimes(2)
    expect(renderAfter).toHaveBeenCalledTimes(1)

    act(() => {
      counter.set(3)
    })

    await waitFor(() => {
      expect(result.result.current.counterValue).toBe(3)
      expect(result.result.current.asyncCounter).toBe(15)
    })

    expect(renderBefore).toHaveBeenCalledTimes(4)
    expect(renderAfter).toHaveBeenCalledTimes(2)
  })
})
