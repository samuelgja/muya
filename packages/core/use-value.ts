import { useDebugValue, useSyncExternalStore } from 'react'
import { EMPTY_SELECTOR, type GetState } from './types'
import { isError, isPromise } from './utils/is'

export function useValue<T, S>(state: GetState<T>, selector: (stateValue: T) => S = EMPTY_SELECTOR): undefined extends S ? T : S {
  const { emitter } = state
  const value = useSyncExternalStore<S>(
    state.emitter.subscribe,
    () => selector(emitter.getSnapshot()),
    () => selector(emitter.getInitialSnapshot ? emitter.getInitialSnapshot() : emitter.getSnapshot()),
  )
  useDebugValue(value)
  if (isPromise(value)) {
    throw value
  }

  if (isError(value)) {
    throw value
  }

  return value as undefined extends S ? T : S
}
