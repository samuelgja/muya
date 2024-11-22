import { canUpdate, handleAsyncUpdate } from './utils/common'
import { isEqualBase, isFunction, isSetValueFunction, isUndefined } from './utils/is'
import type { Cache, DefaultValue, IsEqual, SetValue, State } from './types'
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
      }
      return cache.current
    } catch (error) {
      cache.current = error as T
    }
    return cache.current
  }

  function setValue(value: SetValue<T>) {
    if (cache.abortController) {
      cache.abortController.abort()
    }

    const previous = getValue()
    const newValue = isSetValueFunction(value) ? value(previous) : value
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

  subscribeToDevelopmentTools(state)
  return state
}
