import type { AnyFunction, Cache, Callable, IsEqual, Listener } from './types'
import { EMPTY_SELECTOR } from './types'
import type { CancelablePromise } from './utils/common'
import { cancelablePromise, canUpdate, generateId } from './utils/common'
import { createContext } from './utils/create-context'
import type { Emitter } from './utils/create-emitter'
import { createEmitter } from './utils/create-emitter'
import { isAbortError, isEqualBase, isPromise, isUndefined } from './utils/is'

interface SubscribeContext<T = unknown> {
  addEmitter: (emitter: Emitter<T>) => void
  id: number
  sub: () => void
}
interface SubscribeRaw<F extends AnyFunction, T extends ReturnType<F>> {
  (): T
  emitter: Emitter<T | undefined>
  destroy: () => void
  id: number
  listen: Listener<T>
  abort: () => void
}

export type Subscribe<F extends AnyFunction, T extends ReturnType<F>> = {
  readonly [K in keyof SubscribeRaw<F, T>]: SubscribeRaw<F, T>[K]
} & Callable<T>

export const subscribeContext = createContext<SubscribeContext | undefined>(undefined)

const cache: Cache<S> = {}
let isInitialized = false
export function subscriber<F extends AnyFunction, T extends ReturnType<F>, S extends ReturnType<F>>(
  anyFunction: () => T,
  selector: (stateValue: T) => S = EMPTY_SELECTOR,
  isEqual: IsEqual<S> = isEqualBase,
): Subscribe<F, T> {
  const cleaners: Array<() => void> = []
  const promiseData: CancelablePromise<T> = {}

  console.log('RE_LOAD')
  const emitter = createEmitter(
    () => {
      if (!isInitialized) {
        isInitialized = true
        return subscribe()
      }
      return cache.current
    },
    () => {
      isInitialized = true
      return subscribe()
    },
  )

  async function sub() {
    if (!canUpdate(cache, isEqual)) {
      return
    }
    if (promiseData.controller) {
      promiseData.controller.abort()
    }

    console.log('uprading cache')
    cache.current = subscribe()
    if (isPromise(cache.current)) {
      emitter.emit()
      cache.current
        .then((data) => {
          console.log('data', data)
          emitter.emit()
        })
        .catch(() => {})
      return
    }

    emitter.emit()
  }
  const id = generateId()
  const ctx: SubscribeContext = {
    addEmitter(stateEmitter) {
      const clean = stateEmitter.subscribe(sub)
      cleaners.push(clean)
    },
    id,
    sub,
  }

  const subscribe = function (): T {
    const resultValue = subscribeContext.run(ctx, anyFunction)
    const withSelector = selector(resultValue)

    if (isPromise(withSelector)) {
      const { controller, promise: promiseWithSelector } = cancelablePromise<T>(withSelector, promiseData.controller)
      promiseData.controller = controller
      promiseWithSelector
        ?.then((value) => {
          cache.current = value
        })
        .catch((error) => {
          // if (isAbortError(error)) {
          //   return
          // }
          throw error
        })
      const promiseResult = promiseWithSelector as T
      cache.current = promiseResult
      return promiseResult
    }
    cache.current = withSelector
    return withSelector
  }

  subscribe.emitter = emitter
  subscribe.destroy = function () {
    console.log('DESTROY')
    for (const cleaner of cleaners) {
      cleaner()
    }
    emitter.clear()
  }
  subscribe.id = id
  subscribe.listen = function (listener: (value: T) => void) {
    return emitter.subscribe(() => {
      const final = cache.current
      if (isUndefined(final)) {
        throw new Error('The value is undefined')
      }
      listener(final)
    })
  }
  subscribe.abort = function () {
    if (promiseData.controller) {
      promiseData.controller.abort()
    }
  }
  return subscribe
}
