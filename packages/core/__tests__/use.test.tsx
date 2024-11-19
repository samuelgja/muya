import { act, renderHook } from '@testing-library/react-hooks'
import { create } from '../create'
import { use } from '../use'
import { subscriber } from '../subscriber'
import { atom, useAtom } from 'jotai'
import { useStore, create as zustand } from 'zustand'
import { useState } from 'react'

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

describe('benchmarks comparison between others', () => {
  const reRendersBefore = jest.fn()
  const reRendersAfter = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })
  // const count = 10000

  const counts = [1_00_000]
  for (const count of counts) {
    describe(`Count ${count}`, () => {
      it(`should benchmark ${count}`, async () => {
        const state = create(1)
        const start = performance.now()
        const { result, waitFor } = renderHook(() => {
          reRendersBefore()
          return use(state)
        })

        for (let i = 0; i < count; i++) {
          act(() => {
            state.set(i)
          })
        }

        await waitFor(() => {
          expect(result.current).toBe(count - 1)
        })

        const end = performance.now()
        console.log('Time', end - start)
        console.log('Renders', reRendersBefore.mock.calls.length)
        // expect(reRendersBefore).toHaveBeenCalledTimes(2)
      })
      it(`should benchmark jotai ${count}`, async () => {
        const state = atom(1)
        const start = performance.now()
        const { result, waitFor } = renderHook(() => {
          reRendersBefore()
          return useAtom(state)
        })

        for (let i = 0; i < count; i++) {
          act(() => {
            result.current[1](i)
          })
        }

        await waitFor(() => {
          expect(result.current[0]).toBe(count - 1)
        })

        const end = performance.now()
        console.log('Time', end - start)
        console.log('Renders', reRendersBefore.mock.calls.length)
        // expect(reRendersBefore).toHaveBeenCalledTimes(3)
      })
      it(`should benchmark zustand ${count}`, async () => {
        const state = zustand((set) => ({ state: 1 }))
        const start = performance.now()
        const { result, waitFor } = renderHook(() => {
          reRendersBefore()
          return useStore(state)
        })

        for (let i = 0; i < count; i++) {
          act(() => {
            state.setState(i)
          })
        }

        await waitFor(() => {
          expect(result.current).toBe(count - 1)
        })

        const end = performance.now()
        console.log('Time', end - start)
        console.log('Renders', reRendersBefore.mock.calls.length)
      })

      it(`should benchmark react ${count}`, async () => {
        const start = performance.now()
        const { result, waitFor } = renderHook(() => {
          reRendersBefore()
          return useState(1)
        })

        for (let i = 0; i < count; i++) {
          act(() => {
            result.current[1](i)
          })
        }

        await waitFor(() => {
          expect(result.current[0]).toBe(count - 1)
        })

        const end = performance.now()
        console.log('Time', end - start)
        console.log('Renders', reRendersBefore.mock.calls.length)
      })
    })
  }
})
