import type { AnyFunction, Cache, Callable, Listener } from './types'
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
interface SubscribeRaw<F extends AnyFunction, T extends ReturnType<F> = ReturnType<F>> {
  (): T
  emitter: Emitter<T | undefined>
  destroy: () => void
  id: number
  listen: Listener<T>
  abort: () => void
}

export type Subscribe<F extends AnyFunction, T extends ReturnType<F> = ReturnType<F>> = {
  readonly [K in keyof SubscribeRaw<F, T>]: SubscribeRaw<F, T>[K]
} & Callable<T>

export const context = createContext<SubscribeContext | undefined>(undefined)

export function subscriber<F extends AnyFunction, T extends ReturnType<F> = ReturnType<F>>(
  anyFunction: () => T,
): Subscribe<F, T> {
  const cleaners: Array<() => void> = []
  const promiseData: CancelablePromise<T> = {}

  const cache: Cache<T> = {}
  let isInitialized = false
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
    if (!canUpdate(cache, isEqualBase)) {
      return
    }
    if (promiseData.controller) {
      promiseData.controller.abort()
    }

    cache.current = subscribe()
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
    const resultValue = context.run(ctx, anyFunction)

    if (isPromise(resultValue)) {
      const { controller, promise: promiseWithSelector } = cancelablePromise<T>(resultValue, promiseData.controller)
      promiseData.controller = controller
      promiseWithSelector
        ?.then((value) => {
          cache.current = value
          emitter.emit()
        })
        .catch((error) => {
          if (isAbortError(error)) {
            return
          }

          throw error
        })
      const promiseResult = promiseWithSelector as T
      cache.current = promiseResult
      return promiseResult
    }
    cache.current = resultValue
    return resultValue
  }

  subscribe.emitter = emitter
  subscribe.destroy = function () {
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
