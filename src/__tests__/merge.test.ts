import { create } from '../create'
import { renderHook, act } from '@testing-library/react'
import { merge } from '../merge'

describe('merge', () => {
  it('should test merge multiple-state', () => {
    const state1 = create(1)
    const state2 = create(1)
    const state3 = create(3)

    const useMerged = merge([state1, state2, state3], (value1, value2, value3) => {
      expect(value1).toBe(1)
      expect(value2).toBe(1)
      expect(value3).toBe(3)
      return `${value1} ${value2} ${value3}`
    })
    const result = renderHook(() => useMerged())
    expect(result.result.current).toBe('1 1 3')
  })

  it('should test merge multiple-state with isEqual', () => {
    const state1 = create(1)
    const state2 = create(1)
    const state3 = create(3)

    const useMerged = merge(
      [state1, state2, state3],
      (value1, value2, value3) => {
        expect(value1).toBe(1)
        expect(value2).toBe(1)
        expect(value3).toBe(3)
        return `${value1} ${value2} ${value3}`
      },
      (a, b) => a === b,
    )
    const result = renderHook(() => useMerged())
    expect(result.result.current).toBe('1 1 3')
  })

  it('should test merge multiple-state with different type', () => {
    const state1 = create(1)
    const state2 = create('1')
    const state3 = create({ value: 3 })
    const state4 = create([1, 2, 3])

    const useMerged = merge([state1, state2, state3, state4], (value1, value2, value3, value4) => {
      expect(value1).toBe(1)
      expect(value2).toBe('1')
      expect(value3).toStrictEqual({ value: 3 })
      expect(value4).toStrictEqual([1, 2, 3])
      return `${value1} ${value2} ${value3.value} ${value4.join(' ')}`
    })
    const result = renderHook(() => useMerged())
    expect(result.result.current).toBe('1 1 3 1 2 3')
  })
  it('should test merge with reset', () => {
    const state1 = create(1)
    const state2 = create(1)
    const state3 = create(3)

    const useMerged = merge([state1, state2, state3], (value1, value2, value3) => {
      return `${value1} ${value2} ${value3}`
    })
    const result = renderHook(() => useMerged())

    act(() => {
      state1.setState(2)
      state2.setState(2)
      state3.setState(4)
    })
    expect(result.result.current).toBe('2 2 4')

    act(() => {
      useMerged.reset()
    })
    expect(result.result.current).toBe('1 1 3')
  })
})
