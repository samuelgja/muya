import { createContext } from './create-context'
import { createEmitter, Emitter } from './create-emitter'
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
  ctxEmitter: ParentEmitter

  get: () => T | Awaited<T>
  subscribe: (listener: (value: T) => void) => () => void
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
    return pathContext.run(new Set([state.id]), runContext)
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
    const ctx = stateContext.use()
    if (!ctx) {
      throw new Error('Calling a state can only be used inside muya context')
    }

    console.log(pathContext.use())

    const isAssigned = ctxEmitter.isThere(ctx.id)
    // const hasParentMe = ctx.assignedIds.has(state.id)
    const OMG = ctx.ctxEmitter.isThere(state.id)
    console.log('OMG', OMG)

    // const parentCtx = ctx.getParentCtx()
    // console.log(parentCtx)
    console.log(`CALLED STATE ${state.id} FROM ${ctx.id}`)
    // console.log('has parent me', hasParentMe)

    if (!isAssigned) {
      // ctx.assignedIds.add(state.id)
      ctxEmitter.add(ctx.id, (current) => {
        ctx.call(state.id, current)
      })
    }
    // console.log('assigned ids', ctx.assignedIds)

    return scheduler.getValue()
  }
  state.id = getId()
  state.valueEmitter = createEmitter(scheduler.getValue) as Emitter<Awaited<T> | Promise<Awaited<T>>>

  state.ctxEmitter = ctxEmitter

  state.call = (fromId, current) => {
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
