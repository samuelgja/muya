import { useDebugValue, useSyncExternalStore } from 'react'
import { EMPTY_SELECTOR, type GetState } from './types'
import { isError, isPromise } from './utils/is'

type LoadableLoading = [undefined, true, false, undefined]
type LoadableSuccess<T> = [T, false, false, undefined]
type LoadableError = [undefined, false, true, Error]

export type LoadableResult<T> = LoadableLoading | LoadableSuccess<T> | LoadableError

/**
 * React hook to subscribe to a state and get its value without throwing to Suspense.
 * Returns a tuple of [value, isLoading, isError, error] for handling async states.
 * @param state The state to subscribe to
 * @param selector Optional function to derive a value from the state
 * @returns Tuple of [value, isLoading, isError, error] with discriminated union types
 */
export function useValueLoadable<T, S = undefined>(
  state: GetState<T>,
  selector: (stateValue: Awaited<T>) => S = EMPTY_SELECTOR,
): LoadableResult<undefined extends S ? Awaited<T> : S> {
  const { emitter } = state

  const rawValue = useSyncExternalStore(emitter.subscribe, emitter.getSnapshot, emitter.getInitialSnapshot)

  useDebugValue(rawValue)

  if (isPromise(rawValue)) {
    return [undefined, true, false, undefined] as LoadableResult<undefined extends S ? Awaited<T> : S>
  }

  if (isError(rawValue)) {
    return [undefined, false, true, rawValue] as LoadableResult<undefined extends S ? Awaited<T> : S>
  }

  const selectedValue = selector(rawValue as Awaited<T>)

  return [selectedValue, false, false, undefined] as LoadableResult<undefined extends S ? Awaited<T> : S>
}
