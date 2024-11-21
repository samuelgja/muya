/**
 * This is not optimal, so for now just ignore. Its just for view and compare if the state is at least similar to others
 * but this tests are not consider as a real benchmark
 */
/* eslint-disable unicorn/consistent-function-scoping */
/* eslint-disable no-console */

import { act, renderHook } from '@testing-library/react-hooks'
import { useStore, create as zustand } from 'zustand'
import { useEffect, useState } from 'react'
import { use } from '../use'
import { atom, useAtom } from 'jotai'
import { create } from '../create'

function renderPerfHook<T>(hook: () => T, getValue: (data: T) => number, toBe: number) {
  let onResolve = (_value: number) => {}
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
  const counts = [10_000]
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

        for (let index = 0; index < count; index++) {
          act(() => {
            state.set(index)
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

        for (let index = 0; index < count; index++) {
          act(() => {
            result.current[1](index)
          })
        }

        const time = await resolvePromise
        expect(result.current[0]).toBe(count - 1)
        console.log('Time', time)
        console.log('Renders', reRendersBefore.mock.calls.length)
      })
      it(`should benchmark zustand ${count}`, async () => {
        const state = zustand((_set) => ({ state: 1 }))
        const { result, resolvePromise } = renderPerfHook(
          () => {
            reRendersBefore()
            return useStore(state)
          },
          (data) => data as number,
          count - 1,
        )

        for (let index = 0; index < count; index++) {
          act(() => {
            state.setState(index)
          })
        }

        const time = await resolvePromise
        expect(result.current).toBe(count - 1)
        console.log('Time', time)
        console.log('Renders', reRendersBefore.mock.calls.length)
      })

      it(`should benchmark react ${count}`, async () => {
        const { result, resolvePromise } = renderPerfHook(
          () => {
            reRendersBefore()
            return useState(1)
          },
          (data) => data[0],
          count - 1,
        )

        for (let index = 0; index < count; index++) {
          act(() => {
            result.current[1](index)
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

        for (let index = 0; index < count; index++) {
          act(() => {
            state.set(index)
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

        for (let index = 0; index < count; index++) {
          act(() => {
            result.current[1](index)
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
        const state = zustand((_set) => ({ state: 1 }))
        const start = performance.now()
        const { result, waitFor } = renderHook(() => {
          reRendersBefore()
          return useStore(state)
        })

        for (let index = 0; index < count; index++) {
          act(() => {
            state.setState(index)
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

        for (let index = 0; index < count; index++) {
          act(() => {
            result.current[1](index)
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

      for (let index = 0; index < count; index++) {
        act(() => {
          state.set(index)
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
