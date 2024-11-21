import type { Subscribe } from '../subscriber'
import { subscriber } from '../subscriber'
import type { AnyFunction } from '../types'

interface CacheItem<T extends AnyFunction> {
  count: number
  returnType: Subscribe<T>
}

const cache = new WeakMap<AnyFunction, CacheItem<AnyFunction>>()
let cacheCount = 0

export function getDebugCacheCreation() {
  return cacheCount
}
function incrementDebugFunctionCreationCount() {
  cacheCount++
}

export function subMemo<F extends AnyFunction>(anyFunction: F) {
  cacheCount = 0
  return {
    call(): Subscribe<F> {
      const item = cache.get(anyFunction)
      if (item) {
        item.count++

        return item.returnType
      }

      incrementDebugFunctionCreationCount()
      const returnType = subscriber(anyFunction)
      const newItem = { count: 1, returnType }
      cache.set(anyFunction, newItem)
      return newItem.returnType
    },
    destroy() {
      const item = cache.get(anyFunction)

      if (item) {
        item.count--
        if (item.count === 0) {
          item.returnType.destroy()
          cache.delete(anyFunction)
        }
      }
    },
  }
}
