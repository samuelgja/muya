import { canUpdate, generateId } from './utils/common'
import type { Emitter } from './utils/create-emitter'
import { createEmitter } from './utils/create-emitter'
import { isEqualBase, isFunction, isSetValueFunction, isUndefined } from './utils/is'
// import { createScheduler } from './utils/scheduler'
import type { Cache, Callable, DefaultValue, IsEqual, Listener, SetValue } from './types'
import { context } from './subscriber'
import { createGlobalScheduler } from './utils/global-scheduler'

export const createScheduler = createGlobalScheduler()
interface RawState<T> {
  (): T
  id: number
  set: (value: SetValue<T>) => void
  emitter: Emitter<T>
  listen: Listener<T>
  destroy: () => void
  withName: (name: string) => RawState<T>
  stateName?: string
}

export type State<T> = {
  readonly [K in keyof RawState<T>]: RawState<T>[K]
} & Callable<T>

export function create<T>(initialValue: DefaultValue<T>, isEqual: IsEqual<T> = isEqualBase): State<T> {
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

  // const schedule = createScheduler<SetValue<T>>({
  //   onFinish() {
  //     cache.current = getValue()
  //     if (!canUpdate(cache, isEqual)) {
  //       return
  //     }
  //     state.emitter.emit()
  //   },
  //   onResolveItem: resolveValue,
  // })

  const state: RawState<T> = function () {
    const stateValue = getValue()
    const ctx = context.use()
    // console.log('CTX', ctx?.id, 'STATE', state.id)
    if (ctx && !state.emitter.contains(ctx.sub)) {
      ctx.addEmitter(state.emitter)
    }
    return stateValue
  }
  state.listen = function (listener: (value: T) => void) {
    return state.emitter.subscribe(() => {
      const final = cache.current
      if (isUndefined(final)) {
        throw new Error('The value is undefined')
      }
      listener(final)
    })
  }
  state.emitter = createEmitter<T>(() => state())
  state.id = generateId()

  const clearScheduler = createScheduler.add(state.id, {
    onFinish() {
      cache.current = getValue()
      if (!canUpdate(cache, isEqual)) {
        return
      }
      state.emitter.emit()
    },
    onResolveItem: resolveValue,
  })
  state.set = function (value) {
    createScheduler.schedule(state.id, value)
  }

  state.destroy = function () {
    cache.current = undefined
    getValue()
    clearScheduler()
    state.emitter.clear()
  }
  state.withName = function (name: string) {
    state.stateName = name
    return state
  }

  return state
}
