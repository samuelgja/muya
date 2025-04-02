import { useDebugValue } from 'react'
import { EMPTY_SELECTOR, type GetState } from './types'
import { isError, isPromise } from './utils/is'
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector'

export function useValue<T, S>(
  state: GetState<T>,
  selector: (stateValue: Awaited<T>) => S = EMPTY_SELECTOR,
): undefined extends S ? Awaited<T> : S {
  const { emitter } = state
  const value = useSyncExternalStoreWithSelector<T, S>(
    state.emitter.subscribe,
    emitter.getSnapshot,
    emitter.getInitialSnapshot,
    selector as (stateValue: T) => S,
  )
  useDebugValue(value)
  if (isPromise(value)) {
    throw value
  }

  if (isError(value)) {
    throw value
  }

  return value as undefined extends S ? Awaited<T> : S
}
