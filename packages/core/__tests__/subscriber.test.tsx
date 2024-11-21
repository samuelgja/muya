import { waitFor } from '@testing-library/react'
import { create } from '../create'
import { subscriber } from '../subscriber'
import { longPromise } from './test-utils'

describe('subscriber', () => {
  it('should test subscriber and cleaning the emitters', () => {
    const state1 = create(1)
    const sub = subscriber(state1)
    // at this point, the emitter is not subscribed yet, as it need to be called first.
    expect(state1.emitter.getSize()).toBe(0)

    // check if the value is correct
    expect(sub()).toBe(1)

    // now we can check if the value is subscribed
    expect(state1.emitter.getSize()).toBe(1)
    // we destroy the subscriber, meaning that the emitter should be cleaned

    sub.destroy()

    expect(state1.emitter.getSize()).toBe(0)

    // and test re-aligning the subscriber
    expect(sub()).toBe(1)
    expect(state1.emitter.getSize()).toBe(1)
  })
  it('should test how many events are emitter via singleton state', async () => {
    const state1 = create(1)
    const sub = subscriber(state1)

    let updateCount = 0

    sub.listen(() => {
      updateCount++
    })
    sub()
    await waitFor(() => {})
    // we do not received initial value as it is not changed
    expect(updateCount).toBe(0)

    state1.set(2)
    await waitFor(() => {})
    expect(updateCount).toBe(1)
  })
  it('should test how many events are emitter via singleton async state', async () => {
    const state1 = create(longPromise())
    const sub = subscriber(state1)

    let updateCount = 0

    sub.listen(() => {
      updateCount++
    })
    sub()
    await waitFor(() => {})
    // we do not received initial value as it is not changed
    expect(updateCount).toBe(0)

    state1.set(2)
    await waitFor(() => {})
    expect(updateCount).toBe(1)
  })

  it('should test how many events are emitter via derived state', async () => {
    const state1 = create(longPromise())

    async function derived() {
      //   await longPromise()
      return await state1()
    }
    const sub = subscriber(derived)

    let updateCount = 0

    sub.listen(() => {
      updateCount++
    })
    await sub()
    await waitFor(() => {})
    expect(await sub()).toBe(0)
    // // we do not received initial value as it is not changed
    expect(updateCount).toBe(2)

    // state1.set(2)
    // await waitFor(() => {})
    // expect(updateCount).toBe(1)
  })
})
