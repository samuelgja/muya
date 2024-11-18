import { createContext } from './create-context'
import type { Emitter } from './create-emitter'
import { createEmitter } from './create-emitter'
import { isAbortError, isFunction, isPromise, isSetValueFunction } from './is'
import { cancelablePromise } from './common'
import type { IsEqual, PromiseAndValue, Set, SetValue } from './types'
import { useCreate } from './use-state-value'

const context = createContext<StateNotGeneric | undefined>(undefined)

type DefaultValue<T> = T | (() => T)

interface StateNotGeneric {
  get: () => unknown
  reset: () => void
  value?: unknown
  id: string
  subscribe: (listener: (value: unknown) => void) => () => void
  abortController?: AbortController
}
export interface GetState<T> extends StateNotGeneric {
  <S>(selector?: (stateValue: T) => S, isEqual?: IsEqual<S>): undefined extends S ? T : S
  emitter: Emitter<T>
  get: () => T
  reset: () => void
  value?: T
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

export function use<T, S>(state: GetState<T>, selector?: (stateValue: T) => S, isEqual?: IsEqual<S>) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useCreate(state, selector, isEqual)
}

export function create<T extends () => T>(defaultValue: DefaultValue<T>): GetState<ReturnType<T>>
export function create<T>(defaultValue: DefaultValue<T>): State<T>
export function create<T>(defaultValue: DefaultValue<T>): GetState<T> | State<T> {
  const currentStack = new Set<string>()
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

    if (!currentStack.has(ctx.id)) {
      currentStack.add(ctx.id)
      state.emitter.subscribe(() => {
        ctx?.reset()
      })
    }
    const selectedValue = selector(getValue())

    if (previousData !== undefined && isEqual(previousData as S, selectedValue)) {
      return previousData as undefined extends S ? T : S
    }
    previousData = selectedValue as undefined
    return selectedValue as undefined extends S ? T : S
  }

  state.emitter = createEmitter(getValue)

  let isResolving = false
  function resolveValue(): T {
    if (isResolving) {
      return state.value as T
    }
    const value = getDefaultValue(state, defaultValue)
    if (!isPromise<T>(value)) {
      return value
    }

    isResolving = true
    const { promise, controller } = cancelablePromise<T>(value, state.abortController)
    state.abortController = controller
    promise
      .then((resolvedValue) => {
        isResolving = false
        state.value = resolvedValue
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
    if (state.value === undefined) {
      state.value = resolveValue()
    }
    return state.value
  }

  state.reset = function call() {
    state.value = resolveValue()

    state.emitter.emit()
  }

  state.get = getValue
  state.id = getId()

  if (isFunction(defaultValue)) {
    return state
  }
  state.subscribe = function subscribe(listener: (value: T) => void) {
    return state.emitter.subscribe(() => {
      listener(state.get())
    })
  }

  state.set = function setState(value: SetValue<T>) {
    if (state.value === undefined) {
      state.value = resolveValue()
    }

    if (!isSetValueFunction(value)) {
      if (state.abortController) {
        state.abortController.abort()
      }

      state.value = value
      state.emitter.emit()
      return
    }

    const result = value(state.value as PromiseAndValue<T>)
    if (!isPromise(result)) {
      state.value = result as T
      state.emitter.emit()
      return
    }
    result
      .then((resolvedValue) => {
        // check if state.value is resolved value
        if (isPromise(state.value) && state.abortController) {
          state.abortController.abort()
        }
        state.value = resolvedValue as T
        state.emitter.emit()
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return
        }
      })
  }

  return state
}
