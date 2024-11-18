import { renderHook, act } from '@testing-library/react-hooks'
import { waitFor } from '@testing-library/react'
import { atom, useAtom, useAtomValue } from 'jotai'
import { Suspense, useLayoutEffect, useState } from 'react'
import { create as zustandCreate } from 'zustand'
import { create } from '../create'
import { use } from '../use'
import { longPromise } from './test-utils'

describe('should count re-renders', () => {
  const jotaiReRendersBefore = jest.fn()
  const jotaiReRendersAfter = jest.fn()
  const muyaReRendersBefore = jest.fn()
  const muyaReRendersAfter = jest.fn()
  const zustandReRendersBefore = jest.fn()
  const zustandReRendersAfter = jest.fn()
  const reactRenderBefore = jest.fn()
  const reactRenderAfter = jest.fn()
  beforeEach(() => {
    jest.clearAllMocks()
  })
  it('should compare counter', () => {
    const jotaiCounter = atom(0)

    const muyaCounter = create(0)

    const startTime = Date.now()
    const jotaiResult = renderHook(() => {
      jotaiReRendersBefore()
      const [counter] = useAtom(jotaiCounter)
      jotaiReRendersAfter()
      return counter
    })
    const endTime = Date.now()
    console.log('Jotai render time:', endTime - startTime)
    expect(jotaiResult.result.current).toBe(0)

    // JOTAI RE_RENDER 2x TIMES
    expect(jotaiReRendersBefore).toHaveBeenCalledTimes(2)
    expect(jotaiReRendersAfter).toHaveBeenCalledTimes(2)

    const startTimeMuya = Date.now()
    const muyaResult = renderHook(() => {
      muyaReRendersBefore()
      const counter = use(muyaCounter)
      muyaReRendersAfter()
      return counter
    })
    const endTimeMuya = Date.now()
    console.log('Muya render time:', endTimeMuya - startTimeMuya)
    expect(muyaResult.result.current).toBe(0)
    expect(muyaReRendersBefore).toHaveBeenCalledTimes(1)
    expect(muyaReRendersAfter).toHaveBeenCalledTimes(1)

    // CREATE SNAPSHOTS
    expect(jotaiResult.result.current).toMatchSnapshot("Jotai's counter")
    expect(jotaiReRendersBefore.mock.calls).toMatchSnapshot("Jotai's re-renders")
    expect(jotaiReRendersAfter.mock.calls).toMatchSnapshot("Jotai's re-renders")

    expect(muyaResult.result.current).toMatchSnapshot("Muya's counter")
    expect(muyaReRendersBefore.mock.calls).toMatchSnapshot("Muya's re-renders")
    expect(muyaReRendersAfter.mock.calls).toMatchSnapshot("Muya's re-renders")

    // UPDATE JOTAI COUNTER
  })
  it('should compare counter with set', async () => {
    const jotaiCounter = atom(0)

    const muyaCounter = create(0)

    const jotaiResult = renderHook(() => {
      jotaiReRendersBefore()
      const [counter, setCounter] = useAtom(jotaiCounter)
      jotaiReRendersAfter()
      useLayoutEffect(() => {
        setCounter((c) => c + 1)
      }, [])
      return { counter, setCounter }
    })

    const muyaResult = renderHook(() => {
      muyaReRendersBefore()
      const counter = use(muyaCounter)
      muyaReRendersAfter()
      useLayoutEffect(() => {
        muyaCounter.set((c) => c + 1)
      }, [])
      return counter
    })

    expect(jotaiResult.result.current.counter).toBe(1)
    expect(muyaResult.result.current).toBe(1)

    expect(jotaiReRendersBefore).toHaveBeenCalledTimes(2)
    expect(jotaiReRendersAfter).toHaveBeenCalledTimes(2)

    expect(muyaReRendersBefore).toHaveBeenCalledTimes(2)
    expect(muyaReRendersAfter).toHaveBeenCalledTimes(2)
  })

  it('should compare counter with set and async', () => {
    const jotaiText = atom('readonly atoms')
    const jotaiUppercase = atom((get) => get(jotaiText).toUpperCase())

    const muyaText = create('readonly atoms')
    const muyaUppercase = create(() => muyaText().toUpperCase())

    const jotaiResult = renderHook(() => {
      jotaiReRendersBefore()
      const text = useAtom(jotaiText)
      const uppercase = useAtom(jotaiUppercase)
      jotaiReRendersAfter()
      return { text, uppercase }
    })

    const muyaResult = renderHook(() => {
      muyaReRendersBefore()
      const text = use(muyaText)
      const uppercase = use(muyaUppercase)
      muyaReRendersAfter()
      return { text, uppercase }
    })

    expect(jotaiResult.result.current.text[0]).toBe('readonly atoms')
    expect(jotaiResult.result.current.uppercase[0]).toBe('READONLY ATOMS')
    expect(jotaiReRendersBefore).toHaveBeenCalledTimes(2)
    expect(jotaiReRendersAfter).toHaveBeenCalledTimes(2)

    expect(muyaResult.result.current.text).toBe('readonly atoms')
    expect(muyaResult.result.current.uppercase).toBe('READONLY ATOMS')
    expect(muyaReRendersBefore).toHaveBeenCalledTimes(1)
    expect(muyaReRendersAfter).toHaveBeenCalledTimes(1)

    act(() => {
      jotaiResult.result.current.text[1]('readonly atoms2')
      muyaText.set('readonly atoms2')
    })

    expect(jotaiResult.result.current.text[0]).toBe('readonly atoms2')
    expect(jotaiResult.result.current.uppercase[0]).toBe('READONLY ATOMS2')
    expect(jotaiReRendersBefore).toHaveBeenCalledTimes(3)
    expect(jotaiReRendersAfter).toHaveBeenCalledTimes(3)

    expect(muyaResult.result.current.text).toBe('readonly atoms2')
    expect(muyaResult.result.current.uppercase).toBe('READONLY ATOMS2')
    expect(muyaReRendersBefore).toHaveBeenCalledTimes(2)
    expect(muyaReRendersAfter).toHaveBeenCalledTimes(2)
  })

  it('should compare counter with set and async', async () => {
    const jotaiCounter = atom(1)
    const counterAsync = atom(async (get) => get(jotaiCounter) * 5)

    const muyaCounter = create(1)
    const counterAsyncMuya = create(async () => muyaCounter() * 5)

    const jotaiResult = renderHook(
      () => {
        jotaiReRendersBefore()
        const counter = useAtom(jotaiCounter)
        const asyncCounter = useAtomValue(counterAsync)
        jotaiReRendersAfter()
        return { counter, asyncCounter }
      },
      { wrapper: ({ children }) => <Suspense fallback="loading">{children}</Suspense> },
    )

    await waitFor(() => {
      expect(jotaiResult.result.current.counter[0]).toBe(1)
      expect(jotaiResult.result.current.asyncCounter).toBe(5)
    })

    expect(jotaiResult.result.current.counter[0]).toBe(1)
    expect(jotaiResult.result.current.asyncCounter).toBe(5)
    expect(jotaiReRendersBefore).toHaveBeenCalledTimes(3)
    expect(jotaiReRendersAfter).toHaveBeenCalledTimes(2)

    const muyaResult = renderHook(
      () => {
        muyaReRendersBefore()
        const counter = use(muyaCounter)
        const asyncCounter = use(counterAsyncMuya)
        muyaReRendersAfter()
        return { counter, asyncCounter }
      },
      { wrapper: ({ children }) => <Suspense fallback="loading">{children}</Suspense> },
    )

    await waitFor(() => {
      expect(muyaResult.result.current.counter).toBe(1)
      expect(muyaResult.result.current.asyncCounter).toBe(5)
    })

    expect(muyaResult.result.current.counter).toBe(1)
    expect(muyaResult.result.current.asyncCounter).toBe(5)
    expect(muyaReRendersBefore).toHaveBeenCalledTimes(2)
    expect(muyaReRendersAfter).toHaveBeenCalledTimes(1)

    act(() => {
      jotaiResult.result.current.counter[1](2)
      muyaCounter.set(2)
    })

    await waitFor(() => {
      expect(jotaiResult.result.current.counter[0]).toBe(2)
      expect(jotaiResult.result.current.asyncCounter).toBe(10)
    })

    expect(jotaiResult.result.current.counter[0]).toBe(2)
    expect(jotaiResult.result.current.asyncCounter).toBe(10)
    expect(jotaiReRendersBefore).toHaveBeenCalledTimes(5)
    expect(jotaiReRendersAfter).toHaveBeenCalledTimes(3)

    expect(muyaResult.result.current.counter).toBe(2)
    expect(muyaResult.result.current.asyncCounter).toBe(10)
    expect(muyaReRendersBefore).toHaveBeenCalledTimes(4)
    expect(muyaReRendersAfter).toHaveBeenCalledTimes(2)
  })
  it('should compare counter with set and async with fetch', async () => {
    const counter = atom(1)
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    const asyncAtom = atom(async (get) => {
      await sleep(100)
      return get(counter) + 1
    })

    const muyaCounter = create(1)
    const asyncAtomMuya = create(async () => {
      await sleep(100)
      return muyaCounter() + 1
    })

    const jotaiResult = renderHook(
      () => {
        jotaiReRendersBefore()
        const counterValue = useAtom(counter)
        const asyncValue = useAtomValue(asyncAtom)
        jotaiReRendersAfter()
        return { counterValue, asyncValue }
      },
      { wrapper: ({ children }) => <Suspense fallback="loading">{children}</Suspense> },
    )

    await waitFor(() => {
      expect(jotaiResult.result.current.asyncValue).toBe(2)
    })

    expect(jotaiResult.result.current.counterValue[0]).toBe(1)
    expect(jotaiResult.result.current.asyncValue).toBe(2)
    expect(jotaiReRendersBefore).toHaveBeenCalledTimes(3)
    expect(jotaiReRendersAfter).toHaveBeenCalledTimes(2)

    const muyaResult = renderHook(
      () => {
        muyaReRendersBefore()
        const counterValue = use(muyaCounter)
        const asyncValue = use(asyncAtomMuya)
        muyaReRendersAfter()
        return { counterValue, asyncValue }
      },
      { wrapper: ({ children }) => <Suspense fallback="loading">{children}</Suspense> },
    )

    await waitFor(() => {
      expect(muyaResult.result.current.asyncValue).toBe(2)
    })

    expect(muyaResult.result.current.counterValue).toBe(1)
    expect(muyaResult.result.current.asyncValue).toBe(2)
    expect(muyaReRendersBefore).toHaveBeenCalledTimes(2)
    expect(muyaReRendersAfter).toHaveBeenCalledTimes(1)
  })

  it('should measure render times in loop of N count', async () => {
    const jotaiCounter = atom(0)
    const jotaiSum = atom((get) => get(jotaiCounter) + 1)
    const muyaCounter = create(0)
    const muyaSum = create(() => muyaCounter() + 10)
    let omg = 0
    muyaCounter.subscribe((s) => {
      // console.log('value:', s)
      omg++
    })
    const zustandCounter = zustandCreate((set, get) => ({
      bears: 0,
      another: () => get().bears + 1,
      increasePopulation: () => set((state) => ({ bears: state.bears + 1 })),
      removeAllBears: () => set({ bears: 0 }),
    }))
    const count = 400

    const startTimeMuya = performance.now()
    const { result, rerender } = renderHook(() => {
      muyaReRendersBefore()
      const counter = use(muyaCounter)
      const sum = use(muyaSum)
      muyaReRendersAfter()
      return { counter, sum }
    })

    await act(async () => {
      for (let i = 0; i < count; i++) {
        await longPromise(0)
        muyaCounter.set((c) => c + 1)
      }
    })
    await waitFor(() => {
      expect(result.current.counter).toBe(count)
      expect(result.current.sum).toBe(count + 10)
    })

    console.log('Muya render time:', performance.now() - startTimeMuya)

    const startTimeReact = performance.now()
    const { result: resultReact, rerender: rerenderReact } = renderHook(() => {
      reactRenderBefore()
      const [counter, setCounter] = useState(0)
      const [sum, setSum] = useState(() => counter + 1)
      reactRenderAfter()
      return { counter, setCounter, sum, setSum }
    })

    await act(async () => {
      for (let i = 0; i < count; i++) {
        await longPromise(0)

        resultReact.current.setCounter((c) => c + 1)
        resultReact.current.setSum((s) => s + 1)
      }
    })
    await waitFor(() => {
      expect(resultReact.current.counter).toBe(count)
      // expect(resultReact.current.sum).toBe(count + 1)
    })

    const startTimeZustand = performance.now()
    const zustandResult = renderHook(() => {
      zustandReRendersBefore()
      const state = zustandCounter((s) => s.bears)

      const sum = zustandCounter((s) => s.another())
      zustandReRendersAfter()
      return { state, sum }
    })

    await act(async () => {
      for (let i = 0; i < count; i++) {
        await longPromise(0)
        zustandCounter.setState((s) => ({ bears: s.bears + 1 }))
      }
    })
    await waitFor(() => {
      expect(zustandResult.result.current.state).toBe(count)
      expect(zustandResult.result.current.sum).toBe(count + 1)
    })

    const totalTimeZustand = performance.now() - startTimeZustand
    const startTimeJoTai = performance.now()

    const resultJoiTai = renderHook(() => {
      jotaiReRendersBefore()
      const counter = useAtom(jotaiCounter)
      const sum = useAtom(jotaiSum)
      jotaiReRendersAfter()
      return { counter, sum }
    })

    await act(async () => {
      for (let i = 0; i < count; i++) {
        await longPromise(0)
        resultJoiTai.result.current.counter[1]((c) => c + 1)
      }
    })

    const totalTime = performance.now() - startTimeJoTai
    console.log('Jotai render time:', totalTime)
    console.log('Zustand render time:', totalTimeZustand)
    console.log('React render time:', performance.now() - startTimeReact)
    console.log('React re-renders before:', reactRenderBefore.mock.calls.length)
    console.log('React re-renders after:', reactRenderAfter.mock.calls.length)
    console.log('Zustand re-renders before:', zustandReRendersBefore.mock.calls.length)
    console.log('Zustand re-renders after:', zustandReRendersAfter.mock.calls.length)
    console.log('Jotai re-renders before:', jotaiReRendersBefore.mock.calls.length)
    console.log('Jotai re-renders after:', jotaiReRendersAfter.mock.calls.length)
    console.log('Muya re-renders before:', muyaReRendersBefore.mock.calls.length)
    console.log('Muya re-renders after:', muyaReRendersAfter.mock.calls.length)
  })
})
