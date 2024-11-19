import { canUpdate, generateId } from './utils/common'
import { createEmitter, Emitter } from './utils/create-emitter'
import { isFunction, isSetValueFunction, isUndefined } from './utils/is'
import { createMicroDebounce } from './utils/micro-debounce'
import { Cache, Callable, DefaultValue, EMPTY_EQUAL, IsEqual, Listener, SetValue } from './types'
import { subscribeContext } from './subscriber'

interface RawState<T> {
  (): T
  id: number
  set: (value: SetValue<T>) => void
  emitter: Emitter<T>
  listen: Listener<T>
}

export type State<T> = {
  readonly [K in keyof RawState<T>]: RawState<T>[K]
} & Callable<T>

export function create<T>(initialValue: DefaultValue<T>, isEqual: IsEqual<T> = EMPTY_EQUAL): State<T> {
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

  const schedule = createMicroDebounce<SetValue<T>>({
    onFinish() {
      cache.current = getValue()
      if (!canUpdate(cache, isEqual)) {
        return
      }
      state.emitter.emit()
    },
    onResolveItem: resolveValue,
  })

  const state: RawState<T> = function () {
    const stateValue = getValue()
    const ctx = subscribeContext.use()
    if (ctx && !state.emitter.contains(ctx.sub)) {
      console.log('Assigining subscriber with id: ', ctx.id, state.id)
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
  state.set = schedule
  return state
}
