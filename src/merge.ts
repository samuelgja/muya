import { createBaseState } from './create-base-state'
import { createEmitter } from './create-emitter'
import { createGetterState } from './create-getter-state'
import { isEqualBase } from './is'
import type { IsEqual, GetterState } from './types'

export function merge<T1, T2, S>(
  state1: GetterState<T1>,
  state2: GetterState<T2>,
  selector: (value1: T1, value2: T2) => S,
  isEqual: IsEqual<S> = isEqualBase,
): GetterState<S> {
  let previousData: S | undefined
  const emitter = createEmitter(() => {
    const data = selector(state1.getState(), state2.getState())
    if (previousData !== undefined && isEqual(previousData, data)) {
      return previousData
    }
    previousData = data
    return data
  })
  state1.__internal.emitter.subscribe(() => {
    emitter.emit()
  })
  state2.__internal.emitter.subscribe(() => {
    emitter.emit()
  })

  const baseState = createBaseState<S>({
    emitter,
    getGetterState: () => getterState,
    getState: () => selector(state1.getState(), state2.getState()),
    reset() {
      state1.reset()
      state2.reset()
    },
  })

  const getterState: GetterState<S> = createGetterState<S>({ baseState })
  return getterState
}
