import { create } from '../create'
import { waitFor } from '@testing-library/react'
import { longPromise } from './test-utils'
import { isPromise } from '../utils/is'

describe('create', () => {
  it('should get basic value states here', async () => {
    const state1 = create(1)
    const state2 = create(2)
    expect(state1.get()).toBe(1)
    expect(state2.get()).toBe(2)

    state1.set(2)
    state2.set(3)

    await waitFor(() => {
      expect(state1.get()).toBe(2)
      expect(state2.get()).toBe(3)
    })
  })
  it('should check if value is subscribed to the state', async () => {
    const state = create(1)
    const listener = jest.fn()
    state.listen(listener)
    state.set(2)
    await waitFor(() => {
      expect(listener).toHaveBeenCalledWith(2)
    })
  })

  it('should check if value is unsubscribed from the state', async () => {
    const state = create(1)
    const listener = jest.fn()
    const unsubscribe = state.listen(listener)
    unsubscribe()
    state.set(2)
    await waitFor(() => {
      expect(listener).not.toHaveBeenCalled()
    })
  })
  it('should check change part of state, but is not equal', async () => {
    const state = create({ count: 1, anotherCount: 1 }, (previous, next) => previous.anotherCount === next.anotherCount)
    const listener = jest.fn()
    state.listen(listener)
    state.set((previous) => ({ ...previous, count: previous.count + 1 }))
    await waitFor(() => {
      expect(listener).not.toHaveBeenCalled()
    })
  })
  it('should check change part of state,  is not equal', async () => {
    const state = create({ count: 1, anotherCount: 1 }, (previous, next) => previous.count === next.count)
    const listener = jest.fn()
    state.listen(listener)
    state.set((previous) => ({ ...previous, count: previous.count + 1 }))
    await waitFor(() => {
      expect(listener).toHaveBeenCalledWith({ count: 2, anotherCount: 1 })
    })
  })

  it('should initialize state with a lazy value', () => {
    const initialValue = jest.fn(() => 10)
    const state = create(initialValue)
    expect(initialValue).not.toHaveBeenCalled()
    expect(state.get()).toBe(10)
  })

  it('should initialize state with direct lazy value', () => {
    const initialValue = jest.fn(() => 10)
    const state = create(initialValue())
    expect(initialValue).toHaveBeenCalled()
    expect(state.get()).toBe(10)
  })

  it('should handle asynchronous state updates', async () => {
    const state = create(0)
    const listener = jest.fn()
    state.listen(listener)
    setTimeout(() => {
      state.set(1)
    }, 100)
    await waitFor(() => {
      expect(state.get()).toBe(1)
      expect(listener).toHaveBeenCalledWith(1)
    })
  })

  it('should notify multiple listeners', async () => {
    const state = create('initial')
    const listener1 = jest.fn()
    const listener2 = jest.fn()
    state.listen(listener1)
    state.listen(listener2)
    state.set('updated')
    await waitFor(() => {
      expect(listener1).toHaveBeenCalledWith('updated')
      expect(listener2).toHaveBeenCalledWith('updated')
    })
  })

  it('should not update if isEqual returns true', async () => {
    const state = create(1, () => true)
    const listener = jest.fn()
    state.listen(listener)
    state.set(2)
    await waitFor(() => {
      expect(listener).not.toHaveBeenCalled()
    })
  })

  it('should clear state and listeners on destroy', async () => {
    const state = create(1)
    const listener = jest.fn()
    state.listen(listener)
    state.destroy()
    state.set(2)
    await waitFor(() => {})
    expect(state.get()).toBe(1)
    expect(listener).not.toHaveBeenCalledWith(2)
  })

  it('should create new get select state', async () => {
    const state = create({ count: 1 })
    const select = state.select((slice) => slice.count)
    expect(select.get()).toBe(1)

    state.set({ count: 2 })
    await waitFor(() => {
      expect(select.get()).toBe(2)
    })
  })

  it('should create state with async value', async () => {
    const state = create(() => longPromise(100))
    await waitFor(() => {
      expect(state.get()).toBe(0)
    })
    state.set(1)
    await waitFor(() => {
      expect(state.get()).toBe(1)
    })
  })
  it('should create state with async value but will be cancelled by set value before it will resolve', async () => {
    const state = create(() => longPromise(100))
    state.set(2)
    await waitFor(() => {
      expect(state.get()).toBe(2)
    })
  })
  it('should handle async select', async () => {
    const state = create(0)
    const asyncState = state.select(async (s) => {
      await longPromise(100)
      return s + 1
    })
    const listener = jest.fn()
    asyncState.listen(listener)
    await waitFor(() => {
      expect(asyncState.get()).toBe(1)
      expect(listener).toHaveBeenCalledWith(1)
    })
    state.set(1)
    await waitFor(() => {
      expect(asyncState.get()).toBe(2)
      expect(listener).toHaveBeenCalledWith(2)
    })
  })

  it('should resolve immediately when state is promise', async () => {
    const promiseMock = jest.fn(() => longPromise(100))
    const state1 = create(promiseMock())
    expect(promiseMock).toHaveBeenCalled()
    state1.set((value) => {
      // set with callback will be executed later when promise is resolved
      expect(isPromise(value)).toBe(false)
      return value + 1
    })

    await waitFor(() => {
      expect(state1.get()).toBe(1)
    })

    state1.set(2)
    await waitFor(() => {
      expect(state1.get()).toBe(2)
    })

    state1.set((value) => {
      expect(isPromise(value)).toBe(false)
      return value + 1
    })

    await waitFor(() => {
      expect(state1.get()).toBe(3)
    })
  })

  it('should resolve lazy when state is promise', async () => {
    const promiseMock = jest.fn(() => longPromise(100))
    const state1 = create(promiseMock)
    expect(promiseMock).not.toHaveBeenCalled()
    state1.set((value) => {
      // set with callback will be executed later when promise is resolved
      expect(isPromise(value)).toBe(false)
      return value + 1
    })

    await waitFor(() => {
      expect(state1.get()).toBe(1)
    })

    state1.set(2)
    await waitFor(() => {
      expect(state1.get()).toBe(2)
    })

    state1.set((value) => {
      expect(isPromise(value)).toBe(false)
      return value + 1
    })

    await waitFor(() => {
      expect(state1.get()).toBe(3)
    })
  })
})
