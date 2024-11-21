import type { AnyFunction, Cache, Callable, Listener } from './types'
import type { CancelablePromise } from './utils/common'
import { cancelablePromise, canUpdate, generateId } from './utils/common'
import { createContext } from './utils/create-context'
import type { Emitter } from './utils/create-emitter'
import { createEmitter } from './utils/create-emitter'
import type { StateType } from './debug/development-tools'
import { developmentToolsListener, sendToDevelopmentTools } from './debug/development-tools'
import { createGlobalScheduler } from './utils/global-scheduler'
import { isAbortError, isCreate, isEqualBase, isPromise, isUndefined } from './utils/is'

const subscriberScheduler = createGlobalScheduler()
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
  const cache: Cache<T> = {}
  let isInitialized = false
  const cleaners: Array<() => void> = []
  const promiseData: CancelablePromise<T> = {}

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

    subscriberScheduler.schedule(id, null)
  }

  const id = generateId()

  const clearScheduler = subscriberScheduler.add(id, {
    onFinish() {
      cache.current = subscribe()
      emitter.emit()
    },
  })
  const ctx: SubscribeContext = {
    addEmitter(stateEmitter) {
      const clean = stateEmitter.subscribe(sub)
      cleaners.push(clean)
    },
    id,
    sub,
  }

  function asyncSub(resultValue: Promise<T>): Promise<T> | undefined {
    const cancel = cancelablePromise<T>(resultValue, promiseData.controller)
    promiseData.controller = cancel.controller
    cancel.promise
      ?.then((value) => {
        cache.current = value
        emitter.emit()
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return
        }
        cache.current = error
        emitter.emit()
      })
    return cancel.promise
  }

  const subscribe = function (): T {
    const resultValue = context.run(ctx, anyFunction)

    if (!isPromise(resultValue)) {
      cache.current = resultValue
      return resultValue
    }

    const promise = context.wrap(() => asyncSub(resultValue))()
    if (isPromise(promise)) {
      // we do not do anything with the promise, because it is already handled in asyncSub
      promise.catch(() => null)
    }
    const promiseAsT = promise as T
    cache.current = promiseAsT
    return promiseAsT
  }

  subscribe.emitter = emitter
  subscribe.destroy = function () {
    for (const cleaner of cleaners) {
      cleaner()
    }
    emitter.clear()
    clearScheduler()
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

  if (process.env.NODE_ENV === 'development') {
    let name: string | undefined
    let type: StateType = 'derived'
    if (isCreate(anyFunction)) {
      type = 'state'
      name = anyFunction.stateName
    }

    if (!name) {
      name = anyFunction.name.length > 0 ? anyFunction.name : anyFunction.toString()
    }

    sendToDevelopmentTools({
      name,
      type,
      value: subscribe(),
      message: 'init',
    })
    const listener = developmentToolsListener(name, type)
    subscribe.listen(listener)
  }
  subscribe.abort = function () {
    if (promiseData.controller) {
      promiseData.controller.abort()
    }
  }
  return subscribe
}
