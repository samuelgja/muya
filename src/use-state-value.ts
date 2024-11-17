import type { IsEqual, State } from './types'
import { useSyncExternalStore, toType } from './common'
import { isAnyOtherError, isPromise } from './is'

/**
 * useCachedStateValue Hook.
 * Hook for use state inside react scope. If the state is async - component need to be wrapped with Suspense.
 * @param state - state value
 * @param selector - selector function (useStateValue(state, (state) => state.value)) - it return only selected value, selector don't need to be memoized.
 * @param isEqual - equality check function for selector
 * @returns StateValue from selector if provided, otherwise whole state
 */
export function useStateValue<T, S>(
  state: State<T>,
  selector: (stateValue: T) => S = (stateValue) => toType<S>(stateValue),
  isEqual?: IsEqual<S>,
): undefined extends S ? T : S {
  const data = useSyncExternalStore(
    state.__internal.emitter,
    (stateValue) => {
      return selector(stateValue)
    },
    isEqual,
  )
  if (isPromise(data)) {
    throw data
  }
  if (isAnyOtherError(data)) {
    throw data
  }
  return data
}
