import { useDebugValue, useEffect, useRef } from 'react'
import type { AnyFunction, IsEqual } from './types'
import { isAnyOtherError, isPromise } from './utils/is'
import { subscriber } from './subscriber'
import { useSyncExternalStore } from 'react'

export function use<F extends AnyFunction, T extends ReturnType<F>, S extends ReturnType<F>>(
  anyFn: () => T,
  selector: (stateValue: T) => S = (stateValue) => stateValue,
  isEqual: IsEqual<S> = (prev, next) => prev === next,
): undefined extends S ? T : S {
  const sub = useRef(subscriber(anyFn, selector, isEqual))
  const { destroy, emitter } = sub.current
  const initialSnapshot = emitter.getInitialSnapshot ?? emitter.getSnapshot
  useEffect(() => {
    return destroy
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
