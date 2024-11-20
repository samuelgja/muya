import { act, renderHook } from '@testing-library/react-hooks'
import { create } from '../create'
import { use } from '../use'
import { subscriber } from '../subscriber'
import { atom, useAtom } from 'jotai'

describe('use-create', () => {
  const reRendersBefore = jest.fn()
  const reRendersAfter = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should test sub hook', async () => {
    const state = create(1)

    const sub = subscriber(state)
    expect(sub()).toBe(1)

    act(() => {
      state.set(2)
    })
    expect(sub()).toBe(2)
  })
  it('should test use hook', async () => {
    const state = create(1)

    const { result, waitFor } = renderHook(() => {
      reRendersBefore()
      return use(state)
    })

    state.set(2)

    await waitFor(() => {})
    expect(result.current).toBe(2)
    expect(reRendersBefore).toHaveBeenCalledTimes(2)

    state.set(3)

    await waitFor(() => {})
    expect(result.current).toBe(3)
    expect(reRendersBefore).toHaveBeenCalledTimes(3)
  })

  it('should test derived state', async () => {
    const state1 = create(1)
    const state2 = create(2)

    function derivedBefore(plusValue: number) {
      return state1() + state2() + plusValue
    }

    function derived() {
      return state1() + state2() + derivedBefore(10)
    }

    const { result, waitFor } = renderHook(() => {
      reRendersBefore()
      return use(derived)
    })

    act(() => {
      state1.set(2)
      state2.set(3)
    })

    await waitFor(() => {})
    expect(result.current).toBe(20)
    expect(reRendersBefore).toHaveBeenCalledTimes(2)
  })

  it('should test derived state with jotai', async () => {
    const state1 = atom(1)
    const state2 = atom(2)

    const derivedBefore = atom((get) => get(state1) + get(state2) + 10)
    const derived = atom((get) => get(state1) + get(state2) + get(derivedBefore))

    const { result: setResult } = renderHook(() => {
      return [useAtom(state1), useAtom(state2)]
    })

    const { result, waitFor } = renderHook(() => {
      reRendersBefore()
      return useAtom(derived)
    })

    act(() => {
      setResult.current[0][1](2)
      setResult.current[1][1](3)
    })

    await waitFor(() => {})
    expect(result.current[0]).toBe(20)
    expect(reRendersBefore).toHaveBeenCalledTimes(3)
  })
})
