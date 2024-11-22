import { stateScheduler } from './create'
import { createState } from './create-state'
import { subscribeToDevelopmentTools } from './debug/development-tools'
import type { Cache, GetState, IsEqual } from './types'
import { canUpdate } from './utils/common'
import { isUndefined } from './utils/is'

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
    const values = states.map((state) => state.get()) as S
    return selector(...values)
  }

  function getValue(): T {
    if (isUndefined(cache.current)) {
      cache.current = computedValue()
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
      cache.current = computedValue()
      if (!canUpdate(cache, isEqual)) {
        return
      }
      state.emitter.emit()
    },
  })

  subscribeToDevelopmentTools(state)
  return state
}
