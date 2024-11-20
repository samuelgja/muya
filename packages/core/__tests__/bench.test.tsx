import { act, renderHook } from '@testing-library/react-hooks'
import { useStore, create as zustand } from 'zustand'
import { useEffect, useState } from 'react'
import { use } from '../use'
import { atom, useAtom } from 'jotai'
import { create } from '../create'

function renderPerfHook<T>(hook: () => T, getValue: (data: T) => number, toBe: number) {
  let onResolve = (value: number) => {}
  const resolvePromise = new Promise<number>((resolve) => {
    onResolve = resolve
  })
  const start = performance.now()
  const { result, waitFor } = renderHook(() => {
    const data = hook()
    const count = getValue(data)
    useEffect(() => {
      if (count === toBe) {
        const end = performance.now()
        onResolve(end - start)
      }
    }, [count])
    return data
  })
  return { result, waitFor, resolvePromise }
}

describe('benchmarks comparison measure', () => {
  const reRendersBefore = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })
  const counts = [1000, 10_000]
  for (const count of counts) {
    describe(`Count ${count}`, () => {
      it(`should benchmark ${count} muya first run - idk slow`, async () => {
        const state = create(1)
        // let count = 0

        const { result, resolvePromise } = renderPerfHook(
          () => {
            reRendersBefore()
            return use(state)
          },
          (data) => data,
          count - 1,
        )

        for (let i = 0; i < count; i++) {
          act(() => {
            state.set(i)
          })
        }

        const time = await resolvePromise
        expect(result.current).toBe(count - 1)
        console.log('Time', time)
        console.log('Renders', reRendersBefore.mock.calls.length)
      })
      it(`should benchmark jotai ${count}`, async () => {
        const state = atom(1)

        const { result, resolvePromise } = renderPerfHook(
          () => {
            reRendersBefore()
            return useAtom(state)
          },
          (data) => data[0],
          count - 1,
        )

        for (let i = 0; i < count; i++) {
          act(() => {
            result.current[1](i)
          })
        }

        const time = await resolvePromise
        expect(result.current[0]).toBe(count - 1)
        console.log('Time', time)
        console.log('Renders', reRendersBefore.mock.calls.length)
      })
      it(`should benchmark zustand ${count}`, async () => {
        const state = zustand((set) => ({ state: 1 }))
        const { result, waitFor, resolvePromise } = renderPerfHook(
          () => {
            reRendersBefore()
            return useStore(state)
          },
          (data) => data as number,
          count - 1,
        )

        for (let i = 0; i < count; i++) {
          act(() => {
            state.setState(i)
          })
        }

        const time = await resolvePromise
        expect(result.current).toBe(count - 1)
        console.log('Time', time)
        console.log('Renders', reRendersBefore.mock.calls.length)
      })

      it(`should benchmark react ${count}`, async () => {
        const { result, waitFor, resolvePromise } = renderPerfHook(
          () => {
            reRendersBefore()
            return useState(1)
          },
          (data) => data[0],
          count - 1,
        )

        for (let i = 0; i < count; i++) {
          act(() => {
            result.current[1](i)
          })
        }

        const time = await resolvePromise
        expect(result.current[0]).toBe(count - 1)
        console.log('Time', time)
        console.log('Renders', reRendersBefore.mock.calls.length)
      })
      it(`should benchmark ${count} muya`, async () => {
        const state = create(1)
        // let count = 0

        const { result, resolvePromise } = renderPerfHook(
          () => {
            reRendersBefore()
            return use(state)
          },
          (data) => data,
          count - 1,
        )

        for (let i = 0; i < count; i++) {
          act(() => {
            state.set(i)
          })
        }

        const time = await resolvePromise
        expect(result.current).toBe(count - 1)
        console.log('Time', time)
        console.log('Renders', reRendersBefore.mock.calls.length)
      })
    })
  }
})

describe('benchmarks comparison between others', () => {
  const reRendersBefore = jest.fn()
  const reRendersAfter = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })
  // const count = 10000

  const counts = [100]
  for (const count of counts) {
    describe(`Count ${count}`, () => {
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
    it(`should benchmark ${count} muya`, async () => {
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
  }
})
