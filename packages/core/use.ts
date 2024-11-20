/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable sonarjs/rules-of-hooks */
import { useDebugValue, useEffect, useRef } from 'react'
import { EMPTY_SELECTOR, type AnyFunction } from './types'
import { isAnyOtherError, isPromise } from './utils/is'
import { useSyncExternalStore } from 'react'
import { subMemo } from './utils/sub-memo'

const PROMOTE_DEBUG_AFTER_REACH_TIMES = 10
const PROMOTE_DEBUG_AFTER_REACH_COUNT = 3
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function useDebugFunction<F extends AnyFunction>(function_: F) {
  const renderCount = useRef({ renders: 0, startTime: performance.now() })
  useEffect(() => {
    renderCount.current.renders++
    const passedTime = performance.now() - renderCount.current.startTime
    if (passedTime < PROMOTE_DEBUG_AFTER_REACH_TIMES) {
      return
    }
    if (renderCount.current.renders < PROMOTE_DEBUG_AFTER_REACH_COUNT) {
      return
    }
    renderCount.current.startTime = performance.now()
    renderCount.current.renders = 0
    // eslint-disable-next-line no-console
    console.warn(
      `Function ${function_.name.length > 0 ? function_.name : function_} seems to be not memoized, wrap the function to the useCallback or use global defined functions.`,
    )
  }, [function_])
}

export function use<F extends AnyFunction, T extends ReturnType<F>, S extends ReturnType<F>>(
  anyFunction: () => T,
  selector: (stateValue: T) => S = EMPTY_SELECTOR,
): undefined extends S ? T : S {
  const memo = subMemo(anyFunction)
  const sub = memo.call()
  const initialSnapshot = sub.emitter.getInitialSnapshot ?? sub.emitter.getSnapshot
  useEffect(() => {
    // memo.call()
    return memo.destroy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyFunction])

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
