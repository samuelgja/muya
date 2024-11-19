import { createContext } from './create-context'
import { createEmitter, Emitter } from './create-emitter'
import { isFunction } from './is'
import { createScheduler } from './scheduler'
import type { Set } from './types'

const context = createContext<StateNotGeneric | undefined>(undefined)
type DefaultValue<T> = T | (() => T)

interface StateNotGeneric {
  get: () => unknown
  // reset: () => void
  id: string
  subscribe: (listener: (value: unknown) => void) => () => void
  ctxEmitter: ParentEmitter
  call: (id: string, current: unknown) => void
  // remove: () => void
}
export interface GetState<T> extends StateNotGeneric {
  (): T
  valueEmitter: Emitter<Awaited<T> | Promise<Awaited<T>>>
  ctxEmitter: ParentEmitter
  get: () => T | Awaited<T>
  subscribe: (listener: (value: T) => void) => () => void
}
interface State<T> extends GetState<T> {
  set: Set<T>
}
/**
 * Return default value or default value with promise value.
 * Wrap also the default value with context.
 * @param state
 * @param defaultValue
 * @returns
 */
export function getDefaultWithContext<T>(state: State<T>, defaultValue: DefaultValue<T>) {
  const value = isFunction(defaultValue) ? context.run(state, defaultValue) : defaultValue
  return value as T
}

let id = 0
function getId() {
  id++
  return id.toString(36)
}

interface ParentEmitter {
  map: Map<string, (current: unknown) => void>
  informParents: (current: unknown) => void
  add: (id: string, cb: (current: unknown) => void) => void
  isThere: (id: string) => boolean
}
function createCtxEmitter(): ParentEmitter {
  const map = new Map()
  return {
    isThere: (id) => map.has(id),
    add: (id, cb) => {
      map.set(id, cb)
    },
    map,
    informParents(current) {
      for (const cb of map.values()) {
        cb(current)
      }
    },
  }
}
export function create<T extends () => T>(defaultValue: DefaultValue<T>): GetState<ReturnType<T>>
export function create<T>(defaultValue: DefaultValue<T>): State<T>
export function create<T>(defaultValue: DefaultValue<T>): GetState<T> | State<T> {
  const ctxEmitter = createCtxEmitter()
  const scheduler = createScheduler<T>({
    onFlush: (current) => {
      state.valueEmitter.emit()
      state.ctxEmitter.informParents(current)
      console.log('flush', state.id)
    },
    getDefault: () => getDefaultWithContext(state, defaultValue),
  })
  const state: State<T> = function (): T {
    const ctx = context.use()
    if (!ctx) {
      throw new Error('Calling a state can only be used inside muya context')
    }
    if (!ctxEmitter.isThere(ctx.id)) {
      ctxEmitter.add(ctx.id, (current) => {
        ctx.call(state.id, current)
      })
    }
    return scheduler.getValue()
  }
  state.id = getId()
  state.valueEmitter = createEmitter(scheduler.getValue) as Emitter<Awaited<T> | Promise<Awaited<T>>>

  state.ctxEmitter = ctxEmitter
  state.call = (id, current) => {
    console.log('CALLING ON STATE', state.id, 'FROM', id)
    console.log('CURRENT', current)
    scheduler.current = undefined
    scheduler.getValue()
  }
  state.get = () => {
    const result = scheduler.getValue()
    return result
  }
  state.set = scheduler.addState
  state.subscribe = (listener) => {
    return state.valueEmitter.subscribe(() => listener(state.get()))
  }
  return state
}
