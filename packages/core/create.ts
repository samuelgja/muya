import { canUpdate, handleAsyncUpdate } from './utils/common'
import { isEqualBase, isFunction, isPromise, isSetValueFunction, isUndefined } from './utils/is'
import type { Cache, DefaultValue, IsEqual, SetStateCb, SetValue, State } from './types'
import { createScheduler } from './scheduler'
import { subscribeToDevelopmentTools } from './debug/development-tools'
import { createState } from './create-state'

export const stateScheduler = createScheduler()

/**
 * Create state from a default value.
 */
export function create<T>(initialValue: DefaultValue<T>, isEqual: IsEqual<T> = isEqualBase): State<T> {
  const cache: Cache<T> = {}

  function getValue(): T {
    try {
      if (isUndefined(cache.current)) {
        const value = isFunction(initialValue) ? initialValue() : initialValue
        const resolvedValue = handleAsyncUpdate(cache, state.emitter.emit, value)
        cache.current = resolvedValue

        return cache.current
      }
      return cache.current
    } catch (error) {
      cache.current = error as T
    }

    return cache.current
  }

  async function handleAsyncSetValue(previousPromise: Promise<T>, value: SetStateCb<T>) {
    await previousPromise
    const newValue = value(cache.current as Awaited<T>)
    const resolvedValue = handleAsyncUpdate(cache, state.emitter.emit, newValue)
    cache.current = resolvedValue
  }

  function setValue(value: SetValue<T>) {
    const previous = getValue()
    const isFunctionValue = isSetValueFunction(value)

    if (isFunctionValue && isPromise(previous)) {
      handleAsyncSetValue(previous as Promise<T>, value)
      return
    }
    if (cache.abortController) {
      cache.abortController.abort()
    }

    const newValue = isFunctionValue ? value(previous as Awaited<T>) : value
    const resolvedValue = handleAsyncUpdate(cache, state.emitter.emit, newValue)
    cache.current = resolvedValue
  }

  const state = createState<T>({
    get: getValue,
    destroy() {
      getValue()
      clearScheduler()
      state.emitter.clear()
      cache.current = undefined
    },
    set(value: SetValue<T>) {
      stateScheduler.schedule(state.id, value)
    },
    getSnapshot: getValue,
  })

  const clearScheduler = stateScheduler.add(state.id, {
    onFinish() {
      cache.current = getValue()
      if (!canUpdate(cache, isEqual)) {
        return
      }
      state.emitter.emit()
    },
    onResolveItem: setValue,
  })

  if (!isFunction(initialValue)) {
    getValue()
  }

  subscribeToDevelopmentTools(state)
  return state
}
