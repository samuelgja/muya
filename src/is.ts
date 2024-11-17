import type { Ref, Setter, SetValue } from './types'

export function isPromise(value: unknown): value is Promise<unknown> {
  return value instanceof Promise
}
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function'
}
export function isSetValueFunction<T>(value: SetValue<T>): value is Setter<T> {
  return typeof value === 'function'
}
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
export function isRef<T>(value: unknown): value is Ref<T> {
  return isObject(value) && value.isRef === true
}

export function isMap(value: unknown): value is Map<unknown, unknown> {
  return value instanceof Map
}

export function isSet(value: unknown): value is Set<unknown> {
  return value instanceof Set
}

export function isArray(value: unknown): value is Array<unknown> {
  return Array.isArray(value)
}

export function isEqualBase<T>(valueA: T, valueB: T): boolean {
  if (valueA === valueB) {
    return true
  }
  return !!Object.is(valueA, valueB)
}
