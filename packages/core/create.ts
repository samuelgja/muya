import { cancelablePromise } from './common'
import { createContext } from './create-context'
import { createEmitter, Emitter } from './create-emitter'
import { isFunction, isPromise } from './is'
import { createScheduler } from './scheduler'
import type { IsEqual, SetIt } from './types'

const pathContext = createContext<Set<string> | undefined>(undefined)
interface StateContext {
  id: string
  call: (id: string, current: unknown) => void
  ctxEmitter: ParentEmitter
}
const stateContext = createContext<StateContext | undefined>(undefined)
type DefaultValue<T> = T | (() => T)

interface StateNotGeneric {
  // reset: () => void
  id: string
  subscribe: (listener: (value: unknown) => void) => () => void
  ctxEmitter: ParentEmitter
  call: (id: string, current: unknown) => void
  // remove: () => void
}
export interface GetState<T> extends StateNotGeneric {
  (): T
  valueEmitter: Emitter<T>
  //   ctxEmitter: ParentEmitter

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
    // const runContext = () => stateContext.run({ call: state.call, id: state.id }, defaultValue)
    // const pathCtx = pathContext.use()
    // if (pathCtx) {
    //   return runContext() as T
    // }
    // return pathContext.run(new Set(), runContext) as T
    return stateContext.run({ call: state.call, id: state.id, ctxEmitter: state.ctxEmitter }, defaultValue) as T
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

export function create<T extends () => T>(defaultValue: DefaultValue<T>, isEqual?: IsEqual<Awaited<T>>): GetState<ReturnType<T>>
export function create<T>(defaultValue: DefaultValue<T>, isEqual?: IsEqual<Awaited<T>>): State<T>
export function create<T>(defaultValue: DefaultValue<T>, isEqual?: IsEqual<Awaited<T>>): GetState<T> | State<T> {
  const ctxEmitter = createCtxEmitter()
  let previousValue: Awaited<T> | undefined
  const defaultIsEqual = isEqual ?? ((a, b) => a === b)
  const scheduler = createScheduler<T>({
    onFlush: (current) => {
      const isCurrentPromise = isPromise(current)

      if (!isCurrentPromise && previousValue !== undefined && defaultIsEqual(previousValue, current as Awaited<T>)) {
        return
      }
      if (!isCurrentPromise) {
        previousValue = current as Awaited<T>
      }
      state.valueEmitter.emit()
      if (isCurrentPromise) {
        return
      }
      ctxEmitter.informParents(current)
    },
    getDefault: () => getDefaultWithContext(state, defaultValue),
  })

  const state: State<T> = function (): T {
    const ctx = stateContext.use()
    if (!ctx) {
      return getState()
    }
    const isAssigned = ctxEmitter.isThere(ctx.id)
    if (!isAssigned) {
      // pathCtx?.add(state.id)
      ctxEmitter.add(ctx.id, (current) => {
        ctx.call(state.id, current)
      })
    }

    return getState()
  }

  function getState() {
    if (scheduler.current === undefined) {
      const defaultValueResolved = getDefaultWithContext(state, defaultValue)
      scheduler.current = undefined
      return scheduler.getValue(defaultValueResolved)
    }
    return scheduler.current
  }
  state.subscribe = (listener) => {
    return state.valueEmitter.subscribe(() => {
      listener(getState())
    })
  }

  state.call = () => {
    scheduler.current = undefined
    state()
  }
  state.ctxEmitter = ctxEmitter
  state.valueEmitter = createEmitter(getState)
  state.set = scheduler.addState
  state.id = getId()
  return state
}
