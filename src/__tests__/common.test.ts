import { cancelablePromise, toType, useSyncExternalStore } from '../common'
import { renderHook } from '@testing-library/react-hooks'
import { createEmitter } from '../create-emitter'
import { longPromise } from './test-utils'

describe('toType', () => {
  it('should cast object to specified type', () => {
    const object = { a: 1 }
    const result = toType<{ a: number }>(object)
    expect(result.a).toBe(1)
  })
})

describe('useSyncExternalStore', () => {
  it('should return the initial state value', () => {
    const emitter = createEmitter(() => 0)
    const { result } = renderHook(() => useSyncExternalStore(emitter, (state) => state))
    expect(result.current).toBe(0)
  })

  it('should update when the state value changes', () => {
    let value = 0
    const emitter = createEmitter(() => value)
    const { result } = renderHook(() => useSyncExternalStore(emitter, (state) => state))

    value = 1
    emitter.emit()
    expect(result.current).toBe(1)
  })

  it('should use the selector function', () => {
    let value = 0
    const emitter = createEmitter(() => ({ count: value }))
    const { result } = renderHook(() => useSyncExternalStore(emitter, (state: { count: number }) => state.count))

    value = 1
    emitter.emit()
    expect(result.current).toBe(1)
  })

  it('should use the isEqual function', () => {
    let value = 0
    const emitter = createEmitter(() => ({ count: value }))
    const isEqual = jest.fn((a, b) => a === b)
    const { result } = renderHook(() => useSyncExternalStore(emitter, (state: { count: number }) => state.count, isEqual))

    value = 1
    emitter.emit()
    expect(result.current).toBe(1)
    expect(isEqual).toHaveBeenCalled()
  })

  it('should test cancelable promise to abort', async () => {
    const { promise, controller } = cancelablePromise(longPromise(1000 * 1000))
    controller.abort()
    expect(promise).rejects.toThrow('aborted')
  })

  it('should test cancelable promise to resolve', async () => {
    const { promise } = cancelablePromise(longPromise(0))
    expect(await promise).toBe(0)
  })
})
