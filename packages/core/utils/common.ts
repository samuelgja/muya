import type { Cache, IsEqual } from '../types'
import { isUndefined } from './is'

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

export function canUpdate<T>(cache: Cache<T>, isEqual: IsEqual<T> = (prev, next) => prev === next): boolean {
  if (!isUndefined(cache.current)) {
    if (!isUndefined(cache.previous) && isEqual(cache.current, cache.previous)) {
      return false
    }
    cache.previous = cache.current
  }
  return true
}
