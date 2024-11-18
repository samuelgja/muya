// import type { IsEqual } from './types'
// import { useSync, toType } from './common'
// import { isAnyOtherError, isPromise } from './is'
// import type { GetState } from './create'

// /**
//  * useCachedStateValue Hook.
//  * Hook for use state inside react scope. If the state is async - component need to be wrapped with Suspense.
//  * @param state - state value
//  * @param selector - selector function (useStateValue(state, (state) => state.value)) - it return only selected value, selector don't need to be memoized.
//  * @param isEqual - equality check function for selector
//  * @returns StateValue from selector if provided, otherwise whole state
//  */
// export function use<T, S>(
//   state: GetState<T>,
//   selector: (stateValue: T) => S = (stateValue) => toType<S>(stateValue),
//   isEqual: IsEqual<S> = (a, b) => a === b,
// ): undefined extends S ? T : S {
//   // eslint-disable-next-line react-hooks/rules-of-hooks, sonarjs/rules-of-hooks
//   const data = useSync(
//     state.emitter,
//     (stateValue) => {
//       return selector(stateValue)
//     },
//     isEqual,
//   )

//   if (isPromise(data)) {
//     throw data
//   }

//   if (isAnyOtherError(data)) {
//     throw data
//   }
//   return data
// }

import type { IsEqual } from './types'
import { useSync, toType } from './common'
import { isAnyOtherError, isPromise } from './is'
import type { GetState } from './create'
import { useEffect, useLayoutEffect, useReducer, useState } from 'react'

/**
 * useCachedStateValue Hook.
 * Hook for use state inside react scope. If the state is async - component need to be wrapped with Suspense.
 * @param state - state value
 * @param selector - selector function (useStateValue(state, (state) => state.value)) - it return only selected value, selector don't need to be memoized.
 * @param isEqual - equality check function for selector
 * @returns StateValue from selector if provided, otherwise whole state
 */
export function use<T, S>(
  state: GetState<T>,
  selector: (stateValue: T) => S = (stateValue) => toType<S>(stateValue),
  isEqual: IsEqual<S> = (a, b) => a === b,
): undefined extends S ? T : S {
  function select() {
    return selector(state.get())
  }
  const [data, setData] = useState(select)
  useEffect(() => {
    const listener = () => {
      setData((prevData) => {
        const nextData = select()
        if (isEqual(prevData, nextData)) {
          return prevData
        }
        return nextData
      })
    }
    return state.emitter.subscribe(listener)
  }, [])
  if (isPromise(data)) {
    throw data
  }

  if (isAnyOtherError(data)) {
    throw data
  }
  return data
}
