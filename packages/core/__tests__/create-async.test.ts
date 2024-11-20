import { create } from '../create'
import { waitFor } from '@testing-library/react'
import { longPromise } from './test-utils'
import { isPromise } from '../utils/is'
import { subscriber } from '../subscriber'

describe('create', () => {
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
    const sub = subscriber(
      () => derived(10),
      async (ab) => await ab,
    )
    expect(isPromise(sub.emitter.getSnapshot())).toBe(true)
    sub.listen(async () => {
      updatesCounter++
    })

    // check if there is not maximum call stack
    expect(await sub()).toBe(16)

    state1.set(2)

    await waitFor(async () => {})
    expect(await sub()).toBe(18)

    expect(updatesCounter).toBe(2)
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

    const sub = subscriber(derived)

    sub.listen(() => {
      updatesCounter++
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
