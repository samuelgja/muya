import { createBaseState } from './create-base-state'
import { createEmitter } from './create-emitter'
import { createGetterState } from './create-getter-state'
import { isEqualBase } from './is'
import type { IsEqual, GetterState } from './types'

export function select<T, S>(
  state: GetterState<T>,
  selector: (value: T) => S,
  isEqual: IsEqual<S> = isEqualBase,
): GetterState<S> {
  let previousData: S | undefined
  const emitter = createEmitter(() => {
    const data = selector(state.getState())
    if (previousData !== undefined && isEqual(previousData, data)) {
      return previousData
    }
    previousData = data
    return data
  })
  state.__internal.emitter.subscribe(() => {
    emitter.emit()
  })

  const baseState = createBaseState<S>({
    emitter,
    getGetterState: () => getterState,
    getState: () => selector(state.getState()),
    reset: state.reset,
  })
  const getterState: GetterState<S> = createGetterState<S>({ baseState })
  return getterState
}
