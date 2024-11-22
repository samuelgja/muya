import { create } from '../create'
import { waitFor } from '@testing-library/react'

describe('create', () => {
  it('should get basic value states', async () => {
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

  it('should initialize state with a function', () => {
    const initialValue = jest.fn(() => 10)
    const state = create(initialValue)
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
})
