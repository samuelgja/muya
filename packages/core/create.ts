import { canUpdate } from './utils/common'
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
    if (isUndefined(cache.current)) {
      cache.current = isFunction(initialValue) ? initialValue() : initialValue
    }
    return cache.current
  }
  function resolveValue(value: SetValue<T>) {
    const previous = getValue()
    cache.current = isSetValueFunction(value) ? value(previous) : value
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
    onResolveItem: resolveValue,
  })

  subscribeToDevelopmentTools(state)
  return state
}
