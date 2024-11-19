import { act } from '@testing-library/react-hooks'
import { create, subscribe } from '../create'
import { waitFor } from '@testing-library/react'

describe('create', () => {
  it('should get basic value states', async () => {
    const state1 = create(1)
    const state2 = create(2)
    expect(state1()).toBe(1)
    expect(state2()).toBe(2)

    state1.set(2)
    state2.set(3)

    await waitFor(() => {
      expect(state1()).toBe(2)
      expect(state2()).toBe(3)
    })
  })
  it('should get basic and derived value', async () => {
    const state1 = create(1)
    const state2 = create(2)

    function derived1() {
      return state1() + state2()
    }

    expect(state1()).toBe(1)
    expect(state2()).toBe(2)
    expect(derived1()).toBe(3)

    state1.set(2)
    state2.set(3)

    await waitFor(() => {
      expect(state1()).toBe(2)
      expect(state2()).toBe(3)
      expect(derived1()).toBe(5)
    })
  })
  it('should subscribe to context and notified it', async () => {
    const state1 = create(1)

    const sub = subscribe(() => state1())

    sub()
    sub()
    sub()

    state1.set(2)

    await waitFor(() => {
      expect(sub()).toBe(2)
    })
  })
})
