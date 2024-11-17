import { useSyncExternalStoreWithSelector as useSync } from 'use-sync-external-store/shim/with-selector'
import type { Emitter } from './create-emitter'
import type { IsEqual } from './types'
import { useDebugValue } from 'react'

/**
 * Todo need to remove this
 */
export function toType<T>(object?: unknown): T {
  return object as T
}

export function useSyncExternalStore<T, S>(
  emitter: Emitter<T>,
  selector: (stateValue: T) => S,
  isEqual?: IsEqual<S>,
): undefined extends S ? T : S {
  const value = useSync<T, S>(
    emitter.subscribe,
    emitter.getSnapshot,
    emitter.getSnapshot,
    selector ? (stateValue) => selector(stateValue) : toType,
    isEqual,
  ) as undefined extends S ? T : S

  useDebugValue(value)
  return value
}
