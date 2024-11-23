import { stateScheduler } from './create'
import { createState } from './create-state'
import { subscribeToDevelopmentTools } from './debug/development-tools'
import type { Cache, GetState, IsEqual } from './types'
import { AbortError, canUpdate, handleAsyncUpdate } from './utils/common'
import { isPromise, isUndefined } from './utils/is'

type StateDependencies<T extends Array<unknown>> = {
  [K in keyof T]: GetState<T[K]>
}

/**
 * Selecting state from multiple states.
 * It will create new state in read-only mode (without set).
 */
export function select<T = unknown, S extends Array<unknown> = []>(
  states: StateDependencies<S>,
  selector: (...values: S) => T,
  isEqual?: IsEqual<T>,
): GetState<T> {
  const cache: Cache<T> = {}

  function computedValue(): T {
    // const values = states.map((state) => state.get()) as S

    const values: unknown[] = []
    let hasPromise = false
    for (const state of states) {
      const value = state.get()
      if (isPromise(value)) {
        hasPromise = true
      }
      values.push(value)
    }
    if (hasPromise) {
      return new Promise((resolve, reject) => {
        Promise.all(values).then((resolvedValues) => {
          // check if some of value is undefined
          // eslint-disable-next-line sonarjs/no-nested-functions
          if (resolvedValues.some((element) => isUndefined(element))) {
            return reject(new AbortError())
          }
          const resolved = selector(...(resolvedValues as S))
          resolve(resolved)
        })
      }) as T
    }
    const result = selector(...(values as S))
    return result
  }

  function getValue(): T {
    if (isUndefined(cache.current)) {
      const newValue = computedValue()
      cache.current = handleAsyncUpdate(cache, state.emitter.emit, newValue)
    }
    return cache.current
  }

  const cleanups: Array<() => void> = []
  for (const dependencyState of states) {
    const clean = dependencyState.emitter.subscribe(() => {
      stateScheduler.schedule(state.id, null)
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
      cache.current = undefined
    },
    get: getValue,
  })

  const clearScheduler = stateScheduler.add(state.id, {
    onFinish() {
      const newValue = computedValue()
      cache.current = handleAsyncUpdate(cache, state.emitter.emit, newValue)
      if (!canUpdate(cache, isEqual)) {
        return
      }
      state.emitter.emit()
    },
  })

  subscribeToDevelopmentTools(state)
  return state
}
