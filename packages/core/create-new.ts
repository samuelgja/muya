import { createContext } from './create-context'
import { Emitter } from './create-emitter'
import { isFunction } from './is'
import { createScheduler } from './scheduler'
import type { SetIt } from './types'

const pathContext = createContext<Set<string>>(new Set())
const stateContext = createContext<StateNotGeneric | undefined>(undefined)
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
  //   ctxEmitter: ParentEmitter

  //   subscribe: (listener: (value: T) => void) => () => void
}
interface State<T> extends GetState<T> {
  set: SetIt<T>
}
/**
 * Return default value or default value with promise value.
 * Wrap also the default value with context.
 * @param state
 * @param defaultValue
 * @returns
 */
export function getDefaultWithContext<T>(state: State<T>, defaultValue: DefaultValue<T>) {
  if (isFunction(defaultValue)) {
    const runContext = () => stateContext.run(state, defaultValue)
    return pathContext.run(new Set([state.id]), runContext) as T
  }
  return defaultValue
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

export function create2<T>(defaultValue: DefaultValue<T>): State<T> {
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
    const ctx = stateContext.use()
    if (!ctx) {
      throw new Error('Calling a state can only be used inside muya context')
    }
    const isAssigned = ctxEmitter.isThere(ctx.id)
    const parentContext = pathContext.use()
    console.log(parentContext)
    if (!isAssigned) {
      // ctx.assignedIds.add(state.id)
      ctxEmitter.add(ctx.id, (current) => {
        ctx.call(state.id, current)
      })
    }

    if (scheduler.current === undefined) {
      scheduler.current = undefined
      return scheduler.getValue()
    }
    return scheduler.current
  }
}
