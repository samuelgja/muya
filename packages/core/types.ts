import type { Emitter } from './utils/create-emitter'

export type IsEqual<T = unknown> = (a: T, b: T) => boolean
export type SetStateCb<T> = (value: Awaited<T>) => Awaited<T>
export type SetValue<T> = SetStateCb<T> | Awaited<T>
export type DefaultValue<T> = T | (() => T)
export type Listener<T> = (listener: (value: T) => void) => () => void
export interface Cache<T> {
  current?: T
  previous?: T
  abortController?: AbortController
}

export const EMPTY_SELECTOR = <T, S>(stateValue: T) => stateValue as unknown as S

export interface GetState<T, IsFroMPromise extends boolean = false> {
  <S>(selector?: (stateValue: Awaited<T>) => S): Awaited<undefined extends S ? T : S>
  /**
   * Get the cached state value.
   */
  get: () => IsFroMPromise extends true ? Promise<T> : T
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
  listen: Listener<Awaited<T>>
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
  stateName?: string
  /**
   * Select particular slice of the state.
   * It will create "another" state in read-only mode (without set).
   */
  select: <S>(selector: (state: Awaited<T>) => S, isEqual?: IsEqual<S>) => GetState<S, T extends Promise<unknown> ? true : false>
}

export interface State<T> extends GetState<T> {
  /**
   * Setting new state value.
   * It can be value or function that returns a value (similar to `setState` in React).
   * If the state is initialized with async code, set will cancel the previous promise.
   */
  set: (value: SetValue<T>) => void
  /**
   * Set the state name. For debugging purposes.
   */
  withName: (name: string) => State<T>
  isSet: true
}
