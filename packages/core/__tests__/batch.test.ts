import { waitFor } from '@testing-library/react'
import { createBatcher } from '../batch'
import { longPromise } from './test-utils'

describe('batch', () => {
  it('should have similar batch sync', async () => {
    const batch = createBatcher({
      getValue: () => 1,
      setValue: () => {
        throw new Error('Not implemented')
      },
      onFlush: (value) => {
        expect(value).toBe(9999)
      },
    })

    const count = 10_000
    for (let index = 0; index < count; index++) {
      batch.addValue(() => index)
    }
    expect(batch.batches.size).toBe(count)
    await longPromise(0)
    // should be flushed automatically
    expect(batch.batches.size).toBe(0)
    expect(batch.current).toBe(count - 1)
  })

  it('should have similar batch with update method still sync', async () => {
    const batch = createBatcher({
      getValue: () => ({ count: 0 }),
      setValue: () => {
        throw new Error('Not implemented')
      },
      onFlush: () => {
        expect(batch.current?.count).toBe(count)
      },
    })

    const count = 10_000
    for (let index = 0; index < count; index++) {
      batch.addValue((previous) => ({ count: previous.count + 1 }))
    }
    expect(batch.batches.size).toBe(count)
    await longPromise(0)
    // should be flushed automatically
    expect(batch.batches.size).toBe(0)
    expect(batch.current).toEqual({ count })
  })

  it('should have similar batch with update method return promise', async () => {
    const batch = createBatcher({
      getValue: () => Promise.resolve({ count: 0 }),
      setValue: () => {
        // throw new Error('Not implemented')
      },
      onFlush: (value) => {
        // expect(value.count).toBe(count - 1)
      },
    })

    const count = 10_000
    for (let index = 0; index < count; index++) {
      batch.addValue(async (promise) => {
        const value = await promise
        const result = { count: value.count + 1 }
        return result
      })
    }
    expect(batch.batches.size).toBe(count)
    await longPromise(0)
    // should be flushed automatically
    expect(batch.batches.size).toBe(0)
    await waitFor(() => {
      expect(batch.current).toEqual({ count })
    })
  })
})
