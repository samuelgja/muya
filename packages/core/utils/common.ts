import { useDebugValue } from 'react'
import type { Emitter } from './create-emitter'
import type { IsEqual } from '../types'
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/with-selector'

/**
 * Todo need to remove this
 */
export function toType<T>(object?: unknown): T {
  return object as T
}

export function useSync<T, S>(
  emitter: Emitter<T>,
  selector: (stateValue: T) => S,
  isEqual?: IsEqual<S>,
): undefined extends S ? T : S {
  const value = useSyncExternalStoreWithSelector<T, S>(
    emitter.subscribe,
    emitter.getSnapshot,
    emitter.getSnapshot,
    selector ? (stateValue) => selector(stateValue) : toType,
    isEqual,
  ) as undefined extends S ? T : S
  useDebugValue(value)
  return value
}
// eslint-disable-next-line no-shadow
export enum Abort {
  Error = 'StateAbortError',
}

export interface CancelablePromise<T> {
  promise?: Promise<T>
  controller?: AbortController
  resolveInitialPromise?: (value: T) => void
}
/**
 * Cancelable promise function, return promise and controller
 */
export function cancelablePromise<T>(promise: Promise<T>, previousController?: AbortController): CancelablePromise<T> {
  if (previousController) {
    previousController.abort()
  }
  const controller = new AbortController()
  const { signal } = controller

  const cancelable = new Promise<T>((resolve, reject) => {
    // Listen for the abort event
    signal.addEventListener('abort', () => {
      reject(new DOMException('Promise was aborted', Abort.Error))
    })

    // When the original promise settles, resolve or reject accordingly
    promise.then(resolve).catch(reject)
  })
  return { promise: cancelable, controller }
}

let id = 0
export function generateId() {
  return id++
}
