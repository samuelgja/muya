import { create } from '../create'
import { select } from '../select'
import { waitFor } from '@testing-library/react'
import { longPromise } from './test-utils'

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
})
