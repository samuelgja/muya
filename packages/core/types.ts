import type { Emitter } from './utils/create-emitter'

export type IsEqual<T = unknown> = (a: T, b: T) => boolean
export type SetStateCb<T> = (value: T) => Awaited<T>
export type SetValue<T> = SetStateCb<T> | Awaited<T>
export type DefaultValue<T> = T | (() => T)
export type Listener<T> = (listener: (value?: T) => void) => () => void
export interface Cache<T> {
  current?: T
  previous?: T
}

export const EMPTY_SELECTOR = <T, S>(stateValue: T) => stateValue as unknown as S

export interface RawGetState<T> {
  <S>(selector: (stateValue: T) => S): undefined extends S ? T : S
  /**
   * Get the cached state value.
   */
  get: () => T
  /**
   * Get the unique id of the state.
   */
  id: number
  /**
   * Emitter to listen to changes with snapshots.
   */
  emitter: Emitter<T>
  /**
   * Listen to changes in the state.
   */
  listen: Listener<T>
  /**
   * Destroy / cleanup the state.
   * Clean all listeners and make cache value undefined.
   */
  destroy: () => void
  /**
   * Set the state name. For debugging purposes.
   */
  withName: (name: string) => GetState<T>
  /**
   * Name of the state. For debugging purposes.
   */
  name?: string
  /**
   * Select particular slice of the state.
   * It will create "another" state in read-only mode (without set).
   */
  select: <S>(selector: (state: T) => S, isEqual?: IsEqual<S>) => GetState<S>
}

export interface RawState<T> extends RawGetState<T> {
  /**
   * Setting new state value.
   * It can be value or function that returns a value (similar to `setState` in React).
   */
  set: (value: SetValue<T>) => void
  /**
   * Set the state name. For debugging purposes.
   */
  withName: (name: string) => State<T>
}

export type State<T> = {
  readonly [K in keyof RawState<T>]: RawState<T>[K]
}

export type GetState<T> = {
  readonly [K in keyof RawGetState<T>]: RawGetState<T>[K]
}
