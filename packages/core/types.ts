export type IsEqual<T = unknown> = (a: T, b: T) => boolean
export type SetStateCb<T> = (value: T) => T
export type SetValue<T> = SetStateCb<T> | T
export type SetIt<T> = (value: SetValue<T>) => void
export type DefaultValue<T> = T | (() => T)
