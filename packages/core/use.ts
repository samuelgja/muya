/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable sonarjs/rules-of-hooks */
import { useDebugValue, useEffect, useId, useRef, useState } from 'react'
import { EMPTY_SELECTOR, type AnyFunction, type IsEqual } from './types'
import { isAnyOtherError, isEqualBase, isPromise } from './utils/is'
import { subscriber } from './subscriber'
import { useSyncExternalStore } from 'react'

export function use<F extends AnyFunction, T extends ReturnType<F>, S extends ReturnType<F>>(
  anyFunction: () => T,
  selector: (stateValue: T) => S = EMPTY_SELECTOR,
  isEqual: IsEqual<S> = isEqualBase,
): undefined extends S ? T : S {
  function pureInit() {
    return subscriber(anyFunction, selector, isEqual)
  }

  const [sub] = useState(pureInit)
  const initialSnapshot = sub.emitter.getInitialSnapshot ?? sub.emitter.getSnapshot
  useEffect(() => {
    return sub.destroy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useSyncExternalStore<S>(
    sub.emitter.subscribe,
    () => selector(sub.emitter.getSnapshot() as T),
    () => selector(initialSnapshot() as T),
  )
  useDebugValue(value)
  if (isPromise(value)) {
    sub.destroy()
    throw value
  }
  if (isAnyOtherError(value)) {
    sub.destroy()
    throw value
  }
  return value
}
