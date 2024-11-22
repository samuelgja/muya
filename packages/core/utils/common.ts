import type { Cache, IsEqual } from '../types'
import { isEqualBase, isUndefined } from './is'

let id = 0
export function generateId() {
  return id++
}

export function canUpdate<T>(cache: Cache<T>, isEqual: IsEqual<T> = isEqualBase): boolean {
  if (!isUndefined(cache.current)) {
    if (!isUndefined(cache.previous) && isEqual(cache.current, cache.previous)) {
      return false
    }
    cache.previous = cache.current
  }
  return true
}
