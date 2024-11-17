import { createEmitter } from './create-emitter'
import type { SetValue, SetterState, StateDataInternal, DefaultValue, GetterState, IsEqual, UpdateValue } from './types'
import { getDefaultValue } from './types'
import { isAbortError, isEqualBase, isObject, isPromise, isSetValueFunction } from './is'
import { createBaseState } from './create-base-state'
import { createGetterState } from './create-getter-state'
import { cancelablePromise } from './common'

/**
 * Creates a basic atom state.
 * @param defaultValue - The initial state value.
 * @param options - Optional settings for the state (e.g., isEqual, onSet).
 * @returns A state object that can be used as a hook and provides state management methods.
 * @example
 * ```typescript
 * // Global scope
 * const counterState = state(0);
 * const userState = state({ name: 'John', age: 20 });
 *
 * // React component
 * const counter = counterState(); // Use as a hook
 * const user = userState();
 *
 * // Access partial data from the state using slice
 * const userAge = userState.slice((state) => state.age)();
 * ```
 */

export function create<T>(defaultValue: DefaultValue<T>, isEqual: IsEqual<T> = isEqualBase): SetterState<Awaited<T>> {
  function resolveSetter(value: T, stateSetter: SetValue<T>): T {
    if (isSetValueFunction(stateSetter)) {
      return stateSetter(value)
    }
    return stateSetter
  }

  const stateData: StateDataInternal<T> = {
    updateVersion: 0,
    value: undefined,
  }

  function getValue(): T {
    if (stateData.value === undefined) {
      stateData.value = getDefaultValue(defaultValue)
    }
    return stateData.value
  }

  function get(): T {
    const stateValue = getValue()
    if (isPromise(stateValue)) {
      const { controller, promise } = cancelablePromise(stateValue, stateData.abortController)
      stateData.abortController = controller
      promise
        .then((data) => {
          stateData.value = data as Awaited<T>
          emitter.emit()
        })
        .catch((error) => {
          if (isAbortError(error)) {
            return
          }
          stateData.value = new Error(error) as T
        })
    }
    return stateValue
  }

  function set(stateValue: SetValue<T>) {
    const stateValueData = getValue()
    if (stateData.abortController) {
      stateData.abortController.abort()
      stateData.abortController = undefined
    }

    const newState = resolveSetter(stateValueData, stateValue)
    const isEqualResult = isEqual?.(stateValueData, newState)
    if (isEqualResult || newState === stateValueData) {
      return
    }
    stateData.updateVersion++
    stateData.value = newState
    emitter.emit()
  }

  function update(stateValue: UpdateValue<T>) {
    if (isObject(stateValue)) {
      return set((previousState) => {
        return { ...previousState, ...stateValue }
      })
    }
    set(stateValue as T)
  }

  const emitter = createEmitter<T>(get)

  const baseState = createBaseState({
    emitter,
    getGetterState: () => setterState,
    getState: get,
    reset() {
      const value = getDefaultValue(defaultValue)
      if (isPromise(value)) {
        const { controller, promise } = cancelablePromise(value, stateData.abortController)
        stateData.abortController = controller
        promise
          .then((data) => {
            set(data as T)
          })
          .catch((error) => {
            if (isAbortError(error)) {
              return
            }
            stateData.value = new Error(error) as T
          })
        return
      }
      set(value)
    },
  })

  const getterState: GetterState<T> = createGetterState<T>({ baseState })
  const setterState: SetterState<T> = getterState as SetterState<T>
  setterState.setState = set
  setterState.updateState = update
  return setterState as SetterState<Awaited<T>>
}
