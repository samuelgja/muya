import { renderHook, waitFor, act } from '@testing-library/react'
import { create } from '../create'
import { longPromise } from './test-utils'
import { use } from '../use'

describe('should test async state', () => {
  const renderBefore = jest.fn()
  const renderAfter = jest.fn()

  beforeAll(() => {
    jest.clearAllMocks()
  })
  it('should create list of dependant states', async () => {
    async function GetState() {
      await longPromise(100)
      return {
        greeting: 'Hello, Muya!',
        counter: 0,
      }
    }
    const useAppState = create(GetState())
    const derivedCounter = create(() => {
      const result = useAppState()
      return result.counter
    })
    const derivedCounterFetch = create(async () => {
      const result = await longPromise(10)
      return {
        userId: await derivedCounter(),
      }
    })

    const result = renderHook(() => {
      renderBefore()
      const result = use(derivedCounterFetch)
      renderAfter()
      return result
    })

    await waitFor(() => {
      expect(renderBefore).toHaveBeenCalledTimes(1)
    })

    act(() => {
      useAppState.set({ greeting: 'Hello, Something else.js!', counter: 0 })
    })

    await waitFor(() => {
      expect(renderBefore).toHaveBeenCalledTimes(2)
      expect(renderAfter).toHaveBeenCalledTimes(1)
      expect(result.result.current.userId).toBe(0)
    })
  })
})
