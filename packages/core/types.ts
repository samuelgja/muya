// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunction = (...args: any[]) => any

export type IsEqual<T = unknown> = (a: T, b: T) => boolean
export type SetStateCb<T> = (value: T) => Awaited<T>
export type SetValue<T> = SetStateCb<T> | Awaited<T>
export type DefaultValue<T> = T | (() => T)
export type Listener<T> = (listener: (value: T) => void) => () => void
export interface Cache<T> {
  current?: T
  previous?: T
}
export type Callable<T> = () => T

export const EMPTY_SELECTOR = <T>(stateValue: T) => stateValue
