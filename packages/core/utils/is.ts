import { Abort } from './common'
import type { SetStateCb, SetValue } from '../types'
import type { State } from '../create'

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
export function isAbortError(value: unknown): value is DOMException {
  return value instanceof DOMException && value.name === Abort.Error
}

export function isAnyOtherError(value: unknown): value is Error {
  return value instanceof Error && value.name !== Abort.Error
}

export function isUndefined(value: unknown): value is undefined {
  return value === undefined
}

export function isCreate(value: unknown): value is State<unknown> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  return isFunction(value) && value.set !== undefined
}
