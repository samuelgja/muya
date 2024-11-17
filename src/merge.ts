import { createBaseState } from './create-base-state'
import { createEmitter } from './create-emitter'
import { createGetterState } from './create-getter-state'
import { isEqualBase } from './is'
import type { IsEqual, GetterState } from './types'

export function merge<T extends unknown[], S>(
  states: { [K in keyof T]: GetterState<T[K]> },
  selector: (...values: T) => S,
  isEqual: IsEqual<S> = isEqualBase,
): GetterState<S> {
  let previousData: S | undefined
  const emitter = createEmitter(() => {
    const data = selector(...(states.map((state) => state.getState()) as T))
    if (previousData !== undefined && isEqual(previousData, data)) {
      return previousData
    }
    previousData = data
    return data
  })
  for (const state of states) {
    state.__internal.emitter.subscribe(() => {
      emitter.emit()
    })
  }

  const baseState = createBaseState<S>({
    emitter,
    getGetterState: () => getterState,
    getState: () => selector(...(states.map((state) => state.getState()) as T)),
    reset() {
      for (const state of states) state.reset()
    },
  })

  const getterState: GetterState<S> = createGetterState<S>({ baseState })
  return getterState
}
