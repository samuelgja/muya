/* eslint-disable jsdoc/require-jsdoc */
import type { SetStateCb, SetValue, State } from '../types'
import { AbortError } from './common'

export function isPromise<T>(value: unknown): value is Promise<T> {
  return value instanceof Promise
}

export function isFunction<T extends (...args: unknown[]) => unknown>(value: unknown): value is T {
  return typeof value === 'function'
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

export function isSetValueFunction<T>(value: SetValue<T>): value is SetStateCb<T> {
  return typeof value === 'function'
}

export function isAbortError(value: unknown): value is AbortError {
  return value instanceof AbortError
}

export function isError(value: unknown): value is Error {
  return value instanceof Error
}

export function isUndefined(value: unknown): value is undefined {
  return value === undefined
}

export function isState<T>(value: unknown): value is State<T> {
  return isFunction(value) && 'get' in value && 'set' in value && 'isSet' in value && value.isSet === true
}
