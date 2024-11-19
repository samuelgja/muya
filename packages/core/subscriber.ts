import { AnyFunction, AnyParameters, Cache, EMPTY_EQUAL, EMPTY_PARAMS, EMPTY_SELECTOR, IsEqual, Listener } from './types'
import { cancelablePromise, CancelablePromise, canUpdate, generateId } from './utils/common'
import { createContext } from './utils/create-context'
import { createEmitter, Emitter } from './utils/create-emitter'
import { isAbortError, isPromise, isUndefined } from './utils/is'

interface SubCache<T> extends Cache<T> {
  currentParams?: AnyParameters[]
  previousParams?: AnyParameters[]
}
interface SubscribeContext<T = unknown> {
  addEmitter(emitter: Emitter<T>): void
  id: number
  sub: () => void
}
interface SubscribeRaw<F extends AnyFunction, T extends ReturnType<F>> {
  (...args: Parameters<F>): T
  emitter: Emitter<T | undefined>
  destroy: () => void
  id: number
  listen: Listener<T>
  abort: () => void
}

export type Subscribe<F extends AnyFunction, T extends ReturnType<F>> = {
  readonly [K in keyof SubscribeRaw<F, T>]: SubscribeRaw<F, T>[K]
} & ((...args: Parameters<F>) => T)

export const subscribeContext = createContext<SubscribeContext | undefined>(undefined)

export function subscriber<F extends AnyFunction, T extends ReturnType<F>, S extends ReturnType<F>>(
  anyFn: () => T,
  selector: (stateValue: T) => S = EMPTY_SELECTOR,
  isEqual: IsEqual<S> = EMPTY_EQUAL,
): Subscribe<F, S> {
  const cleaners: Array<() => void> = []
  const promiseData: CancelablePromise<T> = {}

  let isInitialized = false
  const emitter = createEmitter(
    () => {
      if (!isInitialized) {
        isInitialized = true
        return result()
      }
      return cache.current
    },
    () => {
      isInitialized = true
      return result()
    },
  )

  const cache: SubCache<S> = {}

  async function sub() {
    if (!canUpdate(cache, isEqual)) {
      return
    }
    if (promiseData.controller) {
      promiseData.controller.abort()
    }

    cache.current = result()
    if (isPromise(cache.current)) {
      emitter.emit()
      cache.current
        .then(() => {
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
  console.log('FUCCK')
  const result = function (): T {
    const resultValue = subscribeContext.run(ctx, anyFn)
    const withSelector = selector(resultValue)

    if (isPromise(withSelector)) {
      const { controller, promise: promiseWithSelector } = cancelablePromise<T>(withSelector, promiseData.controller)
      promiseData.controller = controller
      promiseWithSelector
        ?.then((value) => {
          cache.current = value
        })
        .catch((error) => {
          if (isAbortError(error)) {
            return
          }
          throw error
        })
      const promiseResult = promiseWithSelector as T
      cache.current = promiseResult
      return promiseWithSelector as any
    }
    cache.current = withSelector
    return withSelector
  }

  result.emitter = emitter
  result.destroy = function () {
    for (const cleaner of cleaners) {
      cleaner()
    }
    emitter.clear()
  }
  result.id = id
  result.listen = function (listener: (value: T) => void) {
    return emitter.subscribe(() => {
      const final = cache.current
      if (isUndefined(final)) {
        throw new Error('The value is undefined')
      }
      listener(final)
    })
  }
  result.abort = function () {
    if (promiseData.controller) {
      promiseData.controller.abort()
    }
  }
  return result
}
