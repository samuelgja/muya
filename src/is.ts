import { Abort } from './common'
import type { Setter, SetValue } from './types'

export function isPromise<T>(value: unknown): value is Promise<T> {
  return value instanceof Promise
}
export function isAsyncFunction(value: unknown): value is (...args: unknown[]) => Promise<unknown> {
  return isFunction(value) && value.constructor.name === 'AsyncFunction'
}
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function'
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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
export function isSetValueFunction<T>(value: SetValue<T>): value is Setter<T> {
  return typeof value === 'function'
}
export function isAbortError(value: unknown): value is DOMException {
  return value instanceof DOMException && value.name === Abort.Error
}

export function isAnyOtherError(value: unknown): value is Error {
  return value instanceof Error && value.name !== Abort.Error
}
