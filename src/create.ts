import { createContext } from './create-context'
import type { Emitter } from './create-emitter'
import { createEmitter } from './create-emitter'
import { isAbortError, isFunction, isPromise, isSetValueFunction } from './is'
import { cancelablePromise } from './common'
import type { IsEqual, PromiseAndValue, Set, SetValue } from './types'
import { createBatcher } from './batch'
import { unstable_batchedUpdates } from 'react-dom'
const context = createContext<StateNotGeneric | undefined>(undefined)

type DefaultValue<T> = T | (() => T)

interface StateNotGeneric {
  get: () => unknown
  reset: () => void
  value?: unknown
  id: string
  subscribe: (listener: (value: unknown) => void) => () => void
  remove: () => void
}
export interface GetState<T> extends StateNotGeneric {
  <S>(selector?: (stateValue: T) => S, isEqual?: IsEqual<S>): undefined extends S ? T : S
  emitter: Emitter<T>
  get: () => T
  reset: () => void
  id: string
  subscribe: (listener: (value: T) => void) => () => void
}
interface State<T> extends GetState<T> {
  set: Set<T>
}

// it still can be promise, this just handle if defaultValue is function
export function getDefaultValue<T>(state: State<T>, defaultValue: DefaultValue<T>): T {
  const value = isFunction(defaultValue) ? context.run(state, defaultValue) : defaultValue
  return value as T
}
let id = 0
function getId() {
  id++
  return id.toString(36)
}

export function create<T extends () => T>(defaultValue: DefaultValue<T>): GetState<ReturnType<T>>
export function create<T>(defaultValue: DefaultValue<T>): State<T>
export function create<T>(defaultValue: DefaultValue<T>): GetState<T> | State<T> {
  const contextSubscriptions = new Map<string, () => void>()
  let previousData: unknown
  const state: State<T> = <S>(
    selector: (stateValue: T) => S = (stateValue) => stateValue as unknown as S,
    isEqual: IsEqual<S> = (a, b) => a === b,
  ): undefined extends S ? T : S => {
    const ctx = context.use()
    const hasCtx = !!ctx
    if (!hasCtx) {
      throw new Error(`calling states must be only inside of a running context.`)
    }

    if (!contextSubscriptions.has(ctx.id)) {
      const unsubscribe = state.emitter.subscribe(() => {
        ctx.reset()
      })
      contextSubscriptions.set(ctx.id, unsubscribe)
    }
    const selectedValue = selector(getValue())

    if (previousData !== undefined && isEqual(previousData as S, selectedValue)) {
      return previousData as undefined extends S ? T : S
    }
    previousData = selectedValue as undefined

    return selectedValue as undefined extends S ? T : S
  }

  const batch = createBatcher<T>({
    getValue,
    setValue: setValueRaw,
    onFlush: (current) => {
      batch.current = current
      state.emitter.emit()
    },
  })

  state.emitter = createEmitter(getValue)

  let isResolving = false
  function resolveValue(): T {
    if (isResolving) {
      return batch.current as T
    }
    const value = getDefaultValue(state, defaultValue)
    if (!isPromise<T>(value)) {
      return value
    }

    isResolving = true
    const { promise, controller } = cancelablePromise<T>(value, batch.abortController)
    batch.abortController = controller
    promise
      .then((resolvedValue) => {
        isResolving = false
        batch.current = resolvedValue
        state.emitter.emit()
      })
      .catch((error) => {
        isResolving = false

        if (isAbortError(error)) {
          return
        }
      })
    // switch Promise to cancelable promise
    return promise as unknown as T
  }

  function getValue() {
    if (batch.current === undefined) {
      batch.current = resolveValue()
    }
    return batch.current
  }

  state.reset = function call() {
    batch.current = resolveValue()
    state.emitter.emit()
  }

  state.get = getValue
  state.id = getId()
  state.remove = function remove() {
    for (const [, unsubscribe] of contextSubscriptions) {
      unsubscribe()
    }
    contextSubscriptions.clear()
    state.emitter.clear()
  }

  if (isFunction(defaultValue)) {
    return state
  }
  state.subscribe = function subscribe(listener: (value: T) => void) {
    return state.emitter.subscribe(() => {
      listener(state.get())
    })
  }

  function setState(value: SetValue<T>) {
    if (batch.current === undefined) {
      batch.current = resolveValue()
    }

    if (!isSetValueFunction(value)) {
      if (batch.abortController) {
        batch.abortController.abort()
      }

      batch.current = value
      state.emitter.emit()
      return
    }

    const result = value(batch.current as PromiseAndValue<T>)
    if (!isPromise(result)) {
      batch.current = result as T
      state.emitter.emit()
      return
    }
    result
      .then((resolvedValue) => {
        // check if batch.current is resolved value
        if (isPromise(batch.current) && batch.abortController) {
          batch.abortController.abort()
        }
        batch.current = resolvedValue as T
        state.emitter.emit()
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return
        }
      })
  }

  function setValueRaw(value: T) {
    batch.current = value
    state.emitter.emit()
  }

  function setStateBatch(value: SetValue<T>) {
    // setState(value)
    // console.log(value)
    batch.addValue(value)
  }

  state.set = setStateBatch

  return state
}
