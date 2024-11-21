/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable sonarjs/rules-of-hooks */
import { useDebugValue, useEffect } from 'react'
import { EMPTY_SELECTOR, type AnyFunction } from './types'
import { isAnyOtherError, isPromise } from './utils/is'
import { useSyncExternalStore } from 'react'
import { memoizedSubscriber } from './memoized-subscriber'

export function use<F extends AnyFunction, T extends ReturnType<F>, S extends ReturnType<F>>(
  anyFunction: () => T,
  selector: (stateValue: T) => S = EMPTY_SELECTOR,
): undefined extends S ? T : S {
  const memo = memoizedSubscriber(anyFunction)

  const sub = memo.call()
  const initialSnapshot = sub.emitter.getInitialSnapshot ?? sub.emitter.getSnapshot
  useEffect(() => {
    return memo.destroy
  }, [anyFunction, memo.destroy])

  const value = useSyncExternalStore<S>(
    sub.emitter.subscribe,
    () => selector(sub.emitter.getSnapshot() as T),
    () => selector(initialSnapshot() as T),
  )
  useDebugValue(value)
  if (isPromise(value)) {
    throw value
  }
  if (isAnyOtherError(value)) {
    memo.destroy()
    throw value
  }
  return value
}
