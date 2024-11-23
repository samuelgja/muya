import { create } from '../create'
import { select } from '../select'
import { renderHook, waitFor } from '@testing-library/react'
import { longPromise } from './test-utils'
import { Suspense } from 'react'

describe('select', () => {
  it('should derive state from a single dependency', async () => {
    const state = create(1)
    const selectedState = select([state], (value) => value * 2)
    expect(selectedState.get()).toBe(2)
    state.set(2)
    await waitFor(() => {})
    expect(selectedState.get()).toBe(4)
  })

  it('should derive state from multiple dependencies', async () => {
    const state1 = create(1)
    const state2 = create(2)
    const selectedState = select([state1, state2], (a, b) => a + b)
    expect(selectedState.get()).toBe(3)
    state1.set(2)
    await waitFor(() => {})
    expect(selectedState.get()).toBe(4)
    state2.set(3)
    await waitFor(() => {})
    expect(selectedState.get()).toBe(5)
  })

  it('should notify listeners when derived state changes', async () => {
    const state = create(1)
    const selectedState = select([state], (value) => value * 2)
    const listener = jest.fn()
    selectedState.listen(listener)
    state.set(2)
    await waitFor(() => {
      expect(selectedState.get()).toBe(4)
      expect(listener).toHaveBeenCalledWith(4)
    })
  })

  it('should not notify listeners if isEqual returns true', async () => {
    const state = create(1)
    const selectedState = select(
      [state],
      (value) => value * 2,
      () => true,
    )
    const listener = jest.fn()
    selectedState.listen(listener)
    state.set(2)
    await waitFor(() => {
      expect(listener).not.toHaveBeenCalled()
    })
  })

  it('should destroy select state properly', async () => {
    const state = create(1)
    const selectedState = select([state], (value) => value * 2)
    const listener = jest.fn()
    selectedState.listen(listener)
    selectedState.destroy()
    state.set(2)
    await waitFor(() => {})
    // there are no listeners to notify, so it return 4 as value is computed again, but internally it's destroyed and undefined
    // so it works as expected
    expect(selectedState.get()).toBe(4)
    expect(listener).not.toHaveBeenCalled()
  })
  it('should handle async updates', async () => {
    const state1 = create(1)
    const state2 = create(2)
    const selectedState = select([state1, state2], async (a, b) => {
      await longPromise()
      return a + b
    })
    const listener = jest.fn()
    selectedState.listen(listener)
    state1.set(2)
    state2.set(3)
    await waitFor(() => {
      expect(selectedState.get()).toBe(5)
      expect(listener).toHaveBeenCalledWith(5)
    })
  })
  it('should handle async updates with async state', async () => {
    const state = create(longPromise(100))
    const selectedState = select([state], async (value) => {
      await longPromise(100)
      return (await value) + 1
    })
    const listener = jest.fn()
    selectedState.listen(listener)
    await waitFor(() => {
      expect(selectedState.get()).toBe(1)
      expect(listener).toHaveBeenCalledWith(1)
    })
  })
  it('should handle async updates with nested selects', async () => {
    const state = create(longPromise(100))
    const selectedState = select([state], async (value) => {
      await longPromise(100)
      return (await value) + 1
    })
    const selectedState2 = selectedState.select(async (value) => value + 1)
    const listener = jest.fn()
    selectedState2.listen(listener)
    await waitFor(() => {
      expect(selectedState2.get()).toBe(2)
      expect(listener).toHaveBeenCalledWith(2)
    })
  })
  it('should handle async updates with async state', async () => {
    const state = create(longPromise(100))
    const selectedState = select([state], async (value) => {
      // await longPromise(100)
      return (await value) + 1
    })
    const listener = jest.fn()
    selectedState.listen(listener)
    await waitFor(() => {
      expect(selectedState.get()).toBe(1)
      expect(listener).toHaveBeenCalledWith(1)
    })
  })
  it('should handle sync state updates when one of par is changed', async () => {
    const state1Atom = create(0)
    const state2Atom = create(0)
    const state3Atom = create(0)

    const sumState = select([state1Atom, state2Atom, state3Atom], (a, b, c) => a + b + c)

    const listener = jest.fn()
    sumState.listen(listener)
    expect(sumState.get()).toBe(0)

    state1Atom.set(1)
    await waitFor(() => {
      expect(sumState.get()).toBe(1)
      expect(listener).toHaveBeenCalledWith(1)
    })

    state2Atom.set(1)
    await waitFor(() => {
      expect(sumState.get()).toBe(2)
      expect(listener).toHaveBeenCalledWith(2)
    })

    state3Atom.set(1)
    await waitFor(() => {
      expect(sumState.get()).toBe(3)
      expect(listener).toHaveBeenCalledWith(3)
    })
  })
  it('should select state from async initial state', async () => {
    const state = create(longPromise(100))
    const selectedState = state.select(async (value) => {
      return value + 2
    })
    await waitFor(() => {
      expect(selectedState.get()).toBe(2)
    })
  })
  it('should select state from sync initial state', async () => {
    const state = create(0)
    const selectedState = state.select((value) => {
      return value + 2
    })
    await waitFor(() => {
      expect(selectedState.get()).toBe(2)
    })
  })

  it('should select state from async state and do not change second time as it just boolean value', async () => {
    const state = create(longPromise(100))
    const selectedState = state.select((value) => {
      const result = value > 0
      expect(value).not.toBeUndefined()
      return result
    })
    const render = jest.fn()

    const { result } = renderHook(
      () => {
        render()
        const value = selectedState()
        return value
      },
      { wrapper: ({ children }) => <Suspense fallback="loading">{children}</Suspense> },
    )

    await waitFor(() => {
      expect(result.current).toBe(false)
      expect(selectedState.get()).toBe(false)
      // re-render twice, as it hit suspense, because value is not resolved yet
      expect(render).toHaveBeenCalledTimes(2)
    })

    state.set(1)

    await waitFor(() => {
      expect(result.current).toBe(true)
      expect(selectedState.get()).toBe(true)
      // next time it re-render only once, as value is already resolved
      expect(render).toHaveBeenCalledTimes(3)
    })
  })

  it('should get value when initial value is promise', async () => {
    const state = create(longPromise(100))
    const selectedState = state.select((value) => {
      return value + 2
    })
    expect(await selectedState.get()).toBe(2)
  })

  it('should have sync get method sync', async () => {
    const state = create(100)
    const selectedState = state.select((value) => {
      return value + 2
    })
    expect(selectedState.get()).toBe(102)
  })

  it('should have async get method sync', async () => {
    const state = create(100)
    const selectedState = state.select((value) => {
      return value + 2
    })
    const selectedState2 = selectedState.select(async (value) => {
      return value + 2
    })
    expect(await selectedState2.get()).toBe(104)
  })
})
