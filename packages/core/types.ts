export type IsEqual<T = unknown> = (a: T, b: T) => boolean
export type SetStateCb<T> = (value: T) => Awaited<T>
export type SetValue<T> = SetStateCb<T> | Awaited<T>
export type DefaultValue<T> = T | (() => T)
export type AnyFunction = (...args: any[]) => any
