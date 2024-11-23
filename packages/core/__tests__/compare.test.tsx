import { act, renderHook } from '@testing-library/react-hooks'
import { create } from '../create'
import { longPromise } from './test-utils'
import { waitFor } from '@testing-library/react'
import { atom, useAtom, useSetAtom } from 'jotai'

describe('compare', () => {
  it('should render async value with sync selector', async () => {
    const state = create(longPromise(100))
    const selectedState = state.select((value) => {
      return value + 2
    })
    const listen = jest.fn()

    const { result } = renderHook(() => {
      listen()
      const value = selectedState()
      return value
    })

    await waitFor(() => {
      expect(result.current).toBe(2)
      expect(listen).toHaveBeenCalledTimes(2)
    })

    state.set(1)

    await waitFor(() => {
      expect(result.current).toBe(3)
      // muya re-render only 3 times
      expect(listen).toHaveBeenCalledTimes(3)
    })
  })
  it('should render async value with sync selector with jotai', async () => {
    const state = atom(longPromise(100))

    const selectedState = atom(async (get) => {
      const value = get(state)
      return (await value) + 2
    })

    const listen = jest.fn()
    const { result: setResult } = renderHook(() => {
      const value = useSetAtom(state)
      return value
    })
    const { result } = renderHook(() => {
      listen()
      const value = useAtom(selectedState)
      return value
    })

    await waitFor(() => {
      expect(result.current[0]).toBe(2)
      expect(listen).toHaveBeenCalledTimes(3)
    })

    act(() => {
      setResult.current(1 as never)
    })

    await waitFor(() => {
      expect(result.current[0]).toBe(3)
      // OH it render 5 times, sad.
      expect(listen).toHaveBeenCalledTimes(5)
    })
  })
})
