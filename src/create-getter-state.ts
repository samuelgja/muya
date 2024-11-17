import type { BaseState, GetterState } from './types'
import { useStateValue } from './use-state-value'

interface Options<T> {
  readonly baseState: BaseState<T>
}
export function createGetterState<T>(options: Options<T>): GetterState<T> {
  const { baseState } = options
  const useSliceState: GetterState<T> = (useSelector, isEqualHook) => {
    return useStateValue(useSliceState, useSelector, isEqualHook)
  }
  useSliceState.__internal = baseState.__internal
  useSliceState.getState = baseState.getState
  useSliceState.reset = baseState.reset
  useSliceState.select = baseState.select
  useSliceState.merge = baseState.merge
  useSliceState.subscribe = baseState.subscribe
  return useSliceState
}
