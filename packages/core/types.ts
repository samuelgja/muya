export type IsEqual<T = unknown> = (a: T, b: T) => boolean
export type PromiseAndValue<T> = T extends Promise<infer U> ? U | Promise<U> : T
export type Setter<T> = (value: PromiseAndValue<T>) => T extends Promise<infer U> ? Promise<U> : T
export type SetValue<T> = Awaited<T> | Setter<T>
export type StateValue<T, S> = undefined extends S ? T : S
export type Set<T> = (value: SetValue<T>) => void
