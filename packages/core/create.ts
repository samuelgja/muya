import { generateId } from './utils/common'
import { createContext } from './utils/create-context'
import { createEmitter, Emitter } from './utils/create-emitter'
import { isFunction, isSetValueFunction, isUndefined } from './utils/is'
import { createMicroDebounce } from './utils/micro-debounce'
import { DefaultValue, SetValue } from './types'

interface SubscribeContext<T = unknown> {
  addEmitter(emitter: Emitter<T>): void
  id: number
  sub: () => void
}
interface Subscribe<T = unknown> {
  (): T
  emitter: Emitter<T>
  destroy: () => void
  id: number
  listen: (listener: (value: T) => void) => () => void
}
const subscribeContext = createContext<SubscribeContext | undefined>(undefined)

export function subscribe<T>(value: () => T): Subscribe<T> {
  const cleaners: Array<() => void> = []

  function sub() {
    result.emitter.emit()
  }
  const result = function (): T {
    const ctx: SubscribeContext = {
      addEmitter(stateEmitter) {
        const clean = stateEmitter.subscribe(sub)
        cleaners.push(clean)
      },
      id: result.id,
      sub,
    }
    return subscribeContext.run(ctx, value)
  }
  result.emitter = createEmitter<T>(() => result())
  result.destroy = () => {
    for (const cleaner of cleaners) {
      cleaner()
    }
    result.emitter.clear()
  }
  result.id = generateId()
  result.listen = (listener: (value: T) => void) => {
    return result.emitter.subscribe(() => {
      listener(result())
    })
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
}

export function create<T>(initialValue: DefaultValue<T>): State<T> {
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
      state.emitter.emit()
      console.log('Emitting from state: ', state.id)
    },
    onResolveItem: resolveValue,
  })

  const state: RawState<T> = function () {
    const ctx = subscribeContext.use()
    if (ctx && !state.emitter.contains(ctx.sub)) {
      console.log('Adding emitter from state: ', state.id)
      ctx.addEmitter(state.emitter)
    }
    return getValue()
  }
  state.emitter = createEmitter<T>(() => state())
  state.id = generateId()
  state.set = scheduler
  return state
}
