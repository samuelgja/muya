import { isArray, isMap, isSet } from './is'

// eslint-disable-next-line sonarjs/cognitive-complexity
export function shallow<T>(valueA: T, valueB: T): boolean {
  if (valueA == valueB) {
    return true
  }

  if (typeof valueA !== 'object' || valueA == null || typeof valueB !== 'object' || valueB == null) {
    return false
  }

  if (isMap(valueA) && isMap(valueB)) {
    if (valueA.size !== valueB.size) return false
    for (const [key, value] of valueA) {
      if (!Object.is(value, valueB.get(key))) {
        return false
      }
    }
    return true
  }

  if (isSet(valueA) && isSet(valueB)) {
    if (valueA.size !== valueB.size) return false
    for (const value of valueA) {
      if (!valueB.has(value)) {
        return false
      }
    }
    return true
  }

  if (isArray(valueA) && isArray(valueB)) {
    if (valueA.length !== valueB.length) return false
    for (const [index, element] of valueA.entries()) {
      if (!Object.is(element, valueB[index])) {
        return false
      }
    }
    return true
  }

  const keysA = Object.keys(valueA)
  const keysB = Object.keys(valueB)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    if (
      !Object.prototype.hasOwnProperty.call(valueB, key) ||
      !Object.is((valueA as Record<string, unknown>)[key], (valueB as Record<string, unknown>)[key])
    ) {
      return false
    }
  }
  return true
}
