/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable sonarjs/rules-of-hooks */
import { useDebugValue, useEffect, useRef } from 'react'
import type { AnyFunction, IsEqual } from './types'
import { isAnyOtherError, isPromise } from './utils/is'
import { subscriber } from './subscriber'
import { useSyncExternalStore } from 'react'

export function use<F extends AnyFunction, T extends ReturnType<F>, S extends ReturnType<F>>(
  anyFunction: () => T,
  selector: (stateValue: T) => S = (stateValue) => stateValue,
  isEqual: IsEqual<S> = (previous, next) => previous === next,
): undefined extends S ? T : S {
  const sub = useRef(subscriber(anyFunction, selector, isEqual))
  const { destroy, emitter } = sub.current
  const initialSnapshot = emitter.getInitialSnapshot ?? emitter.getSnapshot
  useEffect(() => {
    return destroy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const value = useSyncExternalStore<S>(
    emitter.subscribe,
    () => selector(emitter.getSnapshot() as T),
    () => selector(initialSnapshot() as T),
  )
  useDebugValue(value)
  if (isPromise(value)) {
    throw value
  }
  if (isAnyOtherError(value)) {
    throw value
  }
  return value
}
