import type { Subscribe } from '../subscriber'
import { subscriber } from '../subscriber'
import type { AnyFunction } from '../types'
import { composeWithDevTools } from 'redux-devtools-extension'
interface CacheItem<T extends AnyFunction> {
  count: number
  returnType: Subscribe<T>
}

const devTools = composeWithDevTools({
  name: 'MyStateLibrary',
  trace: true,
})
const cache = new WeakMap<AnyFunction, CacheItem<AnyFunction>>()

export function subMemo<F extends AnyFunction>(anyFunction: F) {
  return {
    call(): Subscribe<F> {
      const item = cache.get(anyFunction)
      if (item) {
        item.count++

        return item.returnType
      }
      const returnType = subscriber(anyFunction)

      // returnType.listen((value) => {
      //   // console.log('listen', value)
      //   // // console.log('listen', value)
      //   // devTools('STATE_UPDATE', value)
      // })
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
