import type { Emitter } from './create-emitter'
import { isFunction, isPromise } from './is'

/**
 * Equality check function.
 */
export type IsEqual<T = unknown> = (a: T, b: T) => boolean

export type Setter<T> = (value: T) => T
/**
 * Set new state value function.
 */
export type SetValue<T> = T | Setter<T>
export type UpdateValue<T> = T extends object ? Partial<T> : T

/**
 * Set new state function
 */
export type StateValue<T, S> = undefined extends S ? T : S
export type Set<T> = (value: SetValue<T>) => void
export type Update<T> = (value: UpdateValue<T>) => void

/**
 * Getting state value function.
 */
export type GetState<T> = () => T
export interface StateDataInternal<T = unknown> {
  value?: T
  updateVersion: number
}

// eslint-disable-next-line no-shadow
export enum StateKeys {
  IS_STATE = 'isState',
  IS_SLICE = 'isSlice',
}

export interface BaseState<T> {
  /**
   * Reset state to default value if it's basic atom - if it's family - it will clear all family members
   */
  reset: () => void
  /**
   * Get current state value
   */
  getState: GetState<T>

  select: <S>(selector: (value: T) => S, isEqual?: IsEqual<S>) => GetterState<S>
  merge: <T2, S>(state2: GetterState<T2>, selector: (value1: T, value2: T2) => S, isEqual?: IsEqual<S>) => GetterState<S>

  /**
   * Internal state data
   */
  __internal: {
    emitter: Emitter<T>
  }

  subscribe: (listener: (value: T) => void) => () => void
}

export interface GetterState<T> extends BaseState<T> {
  // use use as the function call here
  <S>(selector?: (state: T) => S, isEqual?: IsEqual<S>): StateValue<T, S>
}
export interface SetterState<T> extends GetterState<T> {
  /**
   * Set new state value
   */
  setState: Set<T>

  /**
   * Set new state value
   */
  updateState: Update<T>
}

export type State<T> = SetterState<T> | GetterState<T>

export type DefaultValue<T> = T | (() => T)

export function getDefaultValue<T>(initValue: DefaultValue<T>): T {
  if (isPromise(initValue)) {
    return initValue
  }
  if (isFunction(initValue)) {
    return (initValue as () => T)()
  }
  return initValue
}

export interface Ref<T> {
  current: T | undefined
  readonly isRef: true
}
