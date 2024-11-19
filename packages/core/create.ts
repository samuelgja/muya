import { CancelablePromise, cancelablePromise, generateId } from './utils/common'
import { createContext } from './utils/create-context'
import { createEmitter, Emitter } from './utils/create-emitter'
import { isAsyncFunction, isFunction, isPromise, isSetValueFunction, isUndefined } from './utils/is'
import { createMicroDebounce } from './utils/micro-debounce'
import { AnyFunction, DefaultValue, IsEqual, SetValue } from './types'

interface SubscribeContext<T = unknown> {
  addEmitter(emitter: Emitter<T>): void
  id: number
  sub: () => void
}
interface Subscribe<F extends AnyFunction, T extends ReturnType<F>> {
  (...args: Parameters<F>): T

  emitter: Emitter<T | undefined>
  destroy: () => void
  id: number
  listen: (listener: (value: T) => void) => () => void
  abort: () => void
}
const subscribeContext = createContext<SubscribeContext | undefined>(undefined)

export function subscribe<F extends AnyFunction, T extends ReturnType<F>, S extends ReturnType<F>>(
  anyFn: (...args: Parameters<F>) => T,
  selector: (stateValue: T) => S = (stateValue) => stateValue,
  isEqual: IsEqual<S> = (prev, next) => prev === next,
): Subscribe<F, undefined extends S ? T : S> {
  const cleaners: Array<() => void> = []
  const promiseData: CancelablePromise<T> = {}
  const emitter = createEmitter(() => {
    const final = cache.current
    return final
  })

  function resolveInitialPromise(value: T) {
    if (promiseData.resolveInitialPromise) {
      promiseData.resolveInitialPromise(value)
      promiseData.resolveInitialPromise = undefined
    }
  }
  function getInitialPromise(): S | undefined {
    if (isAsyncFunction(anyFn)) {
      const promise = new Promise<T>((resolve) => {
        promiseData.resolveInitialPromise = resolve
      })
      return promise as any
    }
    return undefined
  }

  const cache: Cache<S> = {
    current: getInitialPromise(),
  }
  function sub() {
    if (!canUpdate(cache, isEqual)) {
      return
    }
    if (promiseData.controller) {
      promiseData.controller.abort()
    }
    emitter.emit()
  }
  const result = function (...params: Parameters<F>): T {
    const ctx: SubscribeContext = {
      addEmitter(stateEmitter) {
        const clean = stateEmitter.subscribe(sub)
        cleaners.push(clean)
      },
      id: result.id,
      sub,
    }
    const resultValue = subscribeContext.run(ctx, () => anyFn(...params))
    const withSelector = selector(resultValue)

    if (isPromise(withSelector)) {
      resolveInitialPromise(withSelector)
      const { controller, promise: promiseWithSelector } = cancelablePromise<T>(withSelector, promiseData.controller)
      promiseData.controller = controller
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
  result.id = generateId()
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

type Callable<T> = () => T
interface RawState<T> {
  (): T
  id: number
  set: (value: SetValue<T>) => void
  emitter: Emitter<T>
}
export type State<T> = {
  readonly [K in keyof RawState<T>]: RawState<T>[K]
} & Callable<T>
interface Cache<T> {
  current?: T
  previous?: T
}

function canUpdate<T>(cache: Cache<T>, isEqual: IsEqual<T> = (prev, next) => prev === next): boolean {
  if (!isUndefined(cache.current)) {
    if (!isUndefined(cache.previous) && isEqual(cache.current, cache.previous)) {
      return false
    }
    cache.previous = cache.current
  }
  return true
}

export function create<T>(initialValue: DefaultValue<T>, isEqual: IsEqual<T> = (prev, next) => prev === next): State<T> {
  const cache: Cache<T> = {}

  function getValue(): T {
    if (isUndefined(cache.current)) {
      cache.current = isFunction(initialValue) ? initialValue() : initialValue
    }
    return cache.current
  }
  function resolveValue(value: SetValue<T>) {
    const previous = getValue()
    cache.current = isSetValueFunction(value) ? value(previous) : value
  }

  const scheduler = createMicroDebounce<SetValue<T>>({
    onFinish() {
      cache.current = getValue()
      if (!canUpdate(cache, isEqual)) {
        return
      }
      state.emitter.emit()
      console.log('Emitting from state: ', state.id)
    },
    onResolveItem: resolveValue,
  })

  const state: RawState<T> = function () {
    const stateValue = getValue()
    const ctx = subscribeContext.use()
    if (ctx && !state.emitter.contains(ctx.sub)) {
      ctx.addEmitter(state.emitter)
    }
    return stateValue
  }
  state.emitter = createEmitter<T>(() => state())
  state.id = generateId()
  state.set = scheduler
  return state
}
