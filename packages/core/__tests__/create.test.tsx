import { create } from '../create'
import { waitFor } from '@testing-library/react'
import { subscriber } from '../subscriber'

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
    const state2 = create(2)

    function derivedNested() {
      return state1() + state2()
    }
    function derived() {
      return state1() + state2() + derivedNested()
    }

    let updatesCounter = 0

    const sub = subscriber(derived)

    sub.listen((value) => {
      updatesCounter++
      console.log('SUB VALUE', value)
    })

    // check if there is not maximum call stack
    sub()
    sub()
    sub()

    // check if not assigned multiple times, but only once
    expect(state1.emitter.getSize()).toBe(1)
    expect(state2.emitter.getSize()).toBe(1)
    expect(sub.emitter.getSize()).toBe(1)
    expect(sub.emitter.getSnapshot()).toBe(6)
    state1.set(2)

    await waitFor(() => {
      expect(sub()).toBe(8)
      expect(updatesCounter).toBe(1)
    })

    state2.set(3)

    await waitFor(() => {
      expect(sub()).toBe(10)
      expect(updatesCounter).toBe(2)
    })

    expect(state1.emitter.getSize()).toBe(1)
    expect(state2.emitter.getSize()).toBe(1)
    expect(sub.emitter.getSize()).toBe(1)
    expect(sub.emitter.getSnapshot()).toBe(10)

    sub.destroy()

    expect(state1.emitter.getSize()).toBe(0)
    expect(state2.emitter.getSize()).toBe(0)
    expect(sub.emitter.getSize()).toBe(0)
  })
  it('should subscribe and set snapshot', async () => {
    const state = create(1)
    const sub = subscriber(state)
    sub()

    expect(sub.emitter.getSnapshot()).toBe(1)

    state.set(2)
    await waitFor(() => {
      expect(sub.emitter.getSnapshot()).toBe(2)
    })
  })
})
