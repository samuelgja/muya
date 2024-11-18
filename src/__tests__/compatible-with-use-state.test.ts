import { renderHook } from '@testing-library/react-hooks'
import { create } from '../create'
import { use } from '../use'
import { useState } from 'react'

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
})
