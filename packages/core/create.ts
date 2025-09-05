import { canUpdate, handleAsyncUpdate } from './utils/common'
import { isEqualBase, isFunction, isPromise, isSetValueFunction, isUndefined } from './utils/is'
import type { DefaultValue, IsEqual, SetStateCb, SetValue, State } from './types'
import { createScheduler } from './scheduler'
import { subscribeToDevelopmentTools } from './debug/development-tools'
import { createState } from './create-state'

export const STATE_SCHEDULER = createScheduler()

/**
 * Create state from a default value.
 */
export function create<T>(initialValue: DefaultValue<T>, isEqual: IsEqual<T> = isEqualBase): State<T> {
  function getValue(): T {
    try {
      if (isUndefined(state.cache.current)) {
        const value = isFunction(initialValue) ? initialValue() : initialValue
        const resolvedValue = handleAsyncUpdate(state, value)
        state.cache.current = resolvedValue

        return state.cache.current
      }
      return state.cache.current
    } catch (error) {
      state.cache.current = error as T
    }

    return state.cache.current
  }

  async function handleAsyncSetValue(previousPromise: Promise<T>, value: SetStateCb<T>) {
    await previousPromise
    const newValue = value(state.cache.current as Awaited<T>)
    const resolvedValue = handleAsyncUpdate(state, newValue)
    state.cache.current = resolvedValue
  }

  function setValue(value: SetValue<T>) {
    const previous = getValue()
    const isFunctionValue = isSetValueFunction(value)

    if (isFunctionValue && isPromise(previous)) {
      handleAsyncSetValue(previous as Promise<T>, value)
      return
    }
    if (state.cache.abortController) {
      state.cache.abortController.abort()
    }

    const newValue = isFunctionValue ? value(previous as Awaited<T>) : value
    const resolvedValue = handleAsyncUpdate(state, newValue)
    state.cache.current = resolvedValue
  }

  const state = createState<T>({
    get: getValue,
    destroy() {
      getValue()
      clearScheduler()
      state.emitter.clear()
      state.cache.current = undefined
    },
    set(value: SetValue<T>) {
      STATE_SCHEDULER.schedule(state.id, value)
    },
    getSnapshot: getValue,
  })

  const clearScheduler = STATE_SCHEDULER.add(state.id, {
    onScheduleDone() {
      state.cache.current = getValue()
      if (!canUpdate(state.cache, isEqual)) {
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
