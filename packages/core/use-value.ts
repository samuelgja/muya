import { useDebugValue } from 'react'
import { EMPTY_SELECTOR, type GetState } from './types'
import { isError, isPromise } from './utils/is'
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector'

/**
 * React hook to subscribe to a state and get its value, with optional selector for derived state
 * @param state The state to subscribe to
 * @param selector Optional function to derive a value from the state
 * @returns The current value of the state or the derived value from the selector
 * @throws If the value is a Promise or an Error, it will be thrown to be handled by an error boundary or suspense
 */
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
