import { create, subscribe } from '../create'
import { waitFor } from '@testing-library/react'
import { longPromise } from './test-utils'
import { isPromise } from '../utils/is'

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

    const sub = subscribe(derived)

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

    sub.destroy()

    expect(state1.emitter.getSize()).toBe(0)
    expect(state2.emitter.getSize()).toBe(0)
    expect(sub.emitter.getSize()).toBe(0)
  })

  it('should subscribe to context and notified it with parameters', async () => {
    const state1 = create(1)
    const state2 = create(2)

    function derivedNested() {
      return state1() + state2()
    }
    async function derived(plus: number) {
      return state1() + state2() + derivedNested() + plus
    }

    let updatesCounter = 0
    const sub = subscribe(derived, async (ab) => await ab)
    expect(isPromise(sub.emitter.getSnapshot())).toBe(true)
    sub.listen(async (value) => {
      updatesCounter++
      console.log('SUB VALUE', await value)
    })

    // check if there is not maximum call stack
    expect(await sub(1)).toBe(7)
    expect(await sub(2)).toBe(8)
    expect(await sub(3)).toBe(9)

    state1.set(2)

    await waitFor(async () => {
      expect(await sub(1)).toBe(9)
      expect(await sub(2)).toBe(10)
      expect(updatesCounter).toBe(1)
    })
  })

  it('should async subscribe to context and notified it', async () => {
    const state1 = create(1)
    const state2 = create(Promise.resolve(2))

    async function derivedNested() {
      await longPromise()
      return state1() + (await state2())
    }
    async function derived() {
      return state1() + (await state2()) + (await derivedNested())
    }

    let updatesCounter = 0

    const sub = subscribe(derived)

    sub.listen((value) => {
      updatesCounter++
      console.log('SUB VALUE', value)
    })

    // check if there is not maximum call stack
    sub()

    // check if not assigned multiple times, but only once
    expect(state1.emitter.getSize()).toBe(1)
    expect(state2.emitter.getSize()).toBe(1)
    expect(sub.emitter.getSize()).toBe(1)
    state1.set(2)

    await waitFor(async () => {
      expect(await sub()).toBe(8)
      expect(updatesCounter).toBe(1)
    })

    state2.set(3)

    await waitFor(async () => {
      expect(await sub()).toBe(10)
      expect(updatesCounter).toBe(2)
    })

    expect(state1.emitter.getSize()).toBe(1)
    expect(state2.emitter.getSize()).toBe(1)
    expect(sub.emitter.getSize()).toBe(1)

    sub.destroy()

    expect(state1.emitter.getSize()).toBe(0)
    expect(state2.emitter.getSize()).toBe(0)
    expect(sub.emitter.getSize()).toBe(0)
  })
})
