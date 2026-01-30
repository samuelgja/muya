import { STATE_SCHEDULER } from './create'
import { createState } from './create-state'
import { sendToDevtools } from './debug/development-tools'
import type { GetState, IsEqual } from './types'
import { AbortError, canUpdate, handleAsyncUpdate } from './utils/common'
import { isPromise, isUndefined } from './utils/is'

type StateDependencies<T extends Array<unknown>> = {
  [K in keyof T]: GetState<T[K], boolean>
}

type AwaitedArray<T extends Array<unknown>> = {
  [K in keyof T]: Awaited<T[K]>
}
/**
 * Create a derived state from multiple dependency states using a selector function
 * @param states An array of dependency states
 * @param selector A function that takes the values of the dependency states and returns a derived value
 * @param isEqual Optional custom equality check function to prevent unnecessary updates
 * @returns A GetState<T> representing the derived state
 */
export function select<T = unknown, S extends Array<unknown> = []>(
  states: StateDependencies<S>,
  selector: (...values: AwaitedArray<S>) => T,
  isEqual?: IsEqual<T>,
): GetState<T> {
  /**
   * Compute the derived value based on the current values of the dependency states.
   * If any dependency state is a promise, the result will be a promise that resolves
   * once all dependencies are resolved.
   * @returns The computed value or a promise that resolves to the computed value
   */
  function computedValue(): T {
    let hasPromise = false
    const values = states.map((state) => {
      const stateValue = state.get()
      if (isPromise(stateValue)) {
        hasPromise = true
      }
      return stateValue
    }) as S

    if (hasPromise) {
      return new Promise((resolve, reject) => {
        Promise.all(values).then((resolvedValues) => {
          // check if some of value is undefined
          // eslint-disable-next-line sonarjs/no-nested-functions
          if (resolvedValues.some((element) => isUndefined(element))) {
            return reject(new AbortError())
          }
          const resolved = selector(...resolvedValues)
          resolve(resolved)
        })
      }) as T
    }
    const result = selector(...(values as AwaitedArray<S>))
    return result
  }
  /**
   * Get the current snapshot of the derived state.
   * If the current cached value is undefined, it computes a new value.
   * @returns The current snapshot value of the derived state
   */
  function getSnapshot(): T {
    if (isUndefined(state.cache.current)) {
      const newValue = computedValue()
      state.cache.current = handleAsyncUpdate(state, newValue)
    }
    return state.cache.current
  }
  /**
   * Get the current value of the derived state, initializing it if necessary.
   * If the current cached value is a promise, it returns a new promise that resolves
   * once the cached promise resolves, ensuring that undefined values are re-evaluated.
   * @returns The current value of the derived state or a promise that resolves to it
   */
  function getValue(): T {
    if (isUndefined(state.cache.current)) {
      const newValue = computedValue()
      state.cache.current = handleAsyncUpdate(state, newValue)
    }
    const { current } = state.cache
    if (isPromise(current)) {
      return new Promise((resolve) => {
        current.then((value: unknown) => {
          if (isUndefined(value)) {
            resolve(getValue())
            return
          }

          resolve(value)
        })
      }) as T
    }
    return state.cache.current
  }

  const cleanups: Array<() => void> = []
  for (const dependencyState of states) {
    const clean = dependencyState.emitter.subscribe(() => {
      STATE_SCHEDULER.schedule(state.id, null)
    })
    cleanups.push(clean)
  }

  const state = createState<T>({
    destroy() {
      for (const cleanup of cleanups) {
        cleanup()
      }
      clearScheduler()
      state.emitter.clear()
      state.cache.current = undefined
    },
    get: getValue,
    getSnapshot,
  })

  const clearScheduler = STATE_SCHEDULER.add(state.id, {
    onScheduleDone() {
      const newValue = computedValue()
      state.cache.current = handleAsyncUpdate(state, newValue)
      if (!canUpdate(state.cache, isEqual)) {
        return
      }
      state.emitter.emit()
      sendToDevtools({
        name: state.stateName ?? `derived(${state.id})`,
        type: 'derived',
        value: state.cache.current,
        message: 'update',
      })
    },
  })

  return state
}
