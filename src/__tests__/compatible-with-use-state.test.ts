import { renderHook, act } from '@testing-library/react-hooks'
import { create } from '../create'
import { use } from '../use'
import { useState } from 'react'
import { waitFor } from '@testing-library/react'

describe('compatible with useState', () => {
  const reactRenderBefore = jest.fn()
  const reactRenderAfter = jest.fn()
  const stateAfter = jest.fn()
  const stateBefore = jest.fn()

  afterEach(() => {
    jest.clearAllMocks()
  })
  it('should check re-renders for states', () => {
    const state = create(1)
    const result = renderHook(() => {
      stateBefore()
      const value = use(state)
      stateAfter()
      return value
    })
    const resultReact = renderHook(() => {
      reactRenderBefore()
      // eslint-disable-next-line sonarjs/hook-use-state, no-shadow, @typescript-eslint/no-shadow
      const state = useState(1)
      reactRenderAfter()
      return state
    })

    expect(result.result.current).toBe(1)
    expect(resultReact.result.current[0]).toBe(1)
    expect(stateBefore).toHaveBeenCalledTimes(1)
    expect(stateAfter).toHaveBeenCalledTimes(1)
    expect(reactRenderBefore).toHaveBeenCalledTimes(1)
    expect(reactRenderAfter).toHaveBeenCalledTimes(1)
  })

  it('should not re-render when setting the same state value', () => {
    const state = create(1)
    const before = jest.fn()
    const after = jest.fn()

    const result = renderHook(() => {
      before()
      const value = use(state)
      after()
      return value
    })

    expect(result.result.current).toBe(1)
    expect(before).toHaveBeenCalledTimes(1)
    expect(after).toHaveBeenCalledTimes(1)

    act(() => {
      state.set(1)
    })

    expect(result.result.current).toBe(1)
    expect(before).toHaveBeenCalledTimes(1)
    expect(after).toHaveBeenCalledTimes(1)
  })

  it('should re-render once when multiple different state values are set in a single act', async () => {
    const state = create(1)
    const before = jest.fn()
    const after = jest.fn()

    const result = renderHook(() => {
      before()
      const value = use(state)
      after()
      return value
    })

    expect(result.result.current).toBe(1)
    expect(before).toHaveBeenCalledTimes(1)
    expect(after).toHaveBeenCalledTimes(1)

    act(() => {
      state.set(2)
      state.set(3)
      state.set(4)
      state.set(5)
      state.set(2)
      state.set(3)
      state.set(4)
      state.set(8)
    })
    await waitFor(() => {
      expect(before).toHaveBeenCalledTimes(2)
      expect(after).toHaveBeenCalledTimes(2)
      expect(result.result.current).toBe(8)
    })
  })

  it('should re-render correctly when using functional updates', async () => {
    const state = create(1)
    const before = jest.fn()
    const after = jest.fn()

    const result = renderHook(() => {
      before()
      const value = use(state)
      after()
      return value
    })

    expect(result.result.current).toBe(1)
    expect(before).toHaveBeenCalledTimes(1)
    expect(after).toHaveBeenCalledTimes(1)

    act(() => {
      state.set((previous) => previous + 1)
    })

    await waitFor(() => {
      expect(result.result.current).toBe(2)
      expect(before).toHaveBeenCalledTimes(2)
      expect(after).toHaveBeenCalledTimes(2)
    })
  })

  it('should handle setting state to undefined without unnecessary re-renders', () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    const state = create<number | undefined>(undefined)
    const before = jest.fn()
    const after = jest.fn()

    const result = renderHook(() => {
      before()
      const value = use(state)
      after()
      return value
    })

    expect(result.result.current).toBe(undefined)
    expect(before).toHaveBeenCalledTimes(1)
    expect(after).toHaveBeenCalledTimes(1)

    act(() => {
      state.set(undefined)
    })

    expect(result.result.current).toBe(undefined)
    expect(before).toHaveBeenCalledTimes(1)
    expect(after).toHaveBeenCalledTimes(1)
  })
})
