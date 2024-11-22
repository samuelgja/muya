import type { Cache, IsEqual } from '../types'
import { isAbortError, isEqualBase, isPromise, isUndefined } from './is'

export interface CancelablePromise<T> {
  promise: Promise<T>
  controller?: AbortController
}

export class AbortError extends Error {
  static readonly Error = 'AbortError'
}
/**
 * Cancelable promise function, return promise and controller
 */
function cancelablePromise<T>(promise: Promise<T>, previousController?: AbortController): CancelablePromise<T> {
  if (previousController) {
    previousController.abort()
  }
  const controller = new AbortController()
  const { signal } = controller

  const cancelable = new Promise<T>((resolve, reject) => {
    // Listen for the abort event
    signal.addEventListener('abort', () => {
      reject(new AbortError())
    })
    // When the original promise settles, resolve or reject accordingly
    promise.then(resolve).catch(reject)
  })
  return { promise: cancelable, controller }
}

/**
 * Check if the cache value is different from the previous value.
 */
export function canUpdate<T>(cache: Cache<T>, isEqual: IsEqual<T> = isEqualBase): boolean {
  if (!isUndefined(cache.current)) {
    if (!isUndefined(cache.previous) && isEqual(cache.current, cache.previous)) {
      return false
    }
    cache.previous = cache.current
  }
  return true
}

/**
 * Handle async updates for `create` and `select`
 */
export function handleAsyncUpdate<T>(cache: Cache<T>, emit: () => void, value: T): T {
  if (!isPromise(value)) {
    return value
  }
  if (cache.abortController) {
    cache.abortController.abort()
  }

  const { promise, controller } = cancelablePromise(value, cache.abortController)
  cache.abortController = controller

  return promise
    .then((result) => {
      cache.current = result as T
      emit()
    })
    .catch((error) => {
      if (isAbortError(error)) {
        return
      }
      cache.current = error as T
      emit()
    }) as T
}
