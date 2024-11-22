import { waitFor } from '@testing-library/react'
import { createScheduler } from '../scheduler'

describe('scheduler', () => {
  it('should test scheduler by id', async () => {
    const scheduler = createScheduler()

    const id = 1
    const value = 2
    const callback = jest.fn()
    scheduler.add(id, {
      onFinish: callback,
    })
    scheduler.schedule(id, value)
    await waitFor(() => {
      expect(callback).toHaveBeenCalled()
    })
  })
  it('should test scheduler with multiple ids', async () => {
    const ids = [1, 2, 3]
    const scheduler = createScheduler()
    const callbacks: unknown[] = []
    for (const id of ids) {
      const callback = jest.fn()
      scheduler.add(id, {
        onFinish: callback,
      })
      callbacks.push(callback)
    }
    scheduler.schedule(1, 2)
    await waitFor(() => {
      expect(callbacks[0]).toHaveBeenCalled()
      expect(callbacks[1]).not.toHaveBeenCalled()
      expect(callbacks[2]).not.toHaveBeenCalled()
    })
    jest.clearAllMocks()
    scheduler.schedule(2, 2)
    await waitFor(() => {
      expect(callbacks[0]).not.toHaveBeenCalled()
      expect(callbacks[1]).toHaveBeenCalled()
      expect(callbacks[2]).not.toHaveBeenCalled()
    })

    jest.clearAllMocks()
    scheduler.schedule(3, 2)
    await waitFor(() => {
      expect(callbacks[0]).not.toHaveBeenCalled()
      expect(callbacks[1]).not.toHaveBeenCalled()
      expect(callbacks[2]).toHaveBeenCalled()
    })
  })
})
