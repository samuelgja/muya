import { isPromise, isFunction, isSetValueFunction, isObject, isRef, isMap, isSet, isArray, isEqualBase } from './is'

describe('isPromise', () => {
  it('should return true for a Promise', () => {
    expect(isPromise(Promise.resolve())).toBe(true)
  })
  it('should return false for a non-Promise', () => {
    expect(isPromise(123)).toBe(false)
  })
})

describe('isFunction', () => {
  it('should return true for a function', () => {
    expect(isFunction(() => {})).toBe(true)
  })
  it('should return false for a non-function', () => {
    expect(isFunction(123)).toBe(false)
  })
})

describe('isSetValueFunction', () => {
  it('should return true for a function', () => {
    expect(isSetValueFunction(() => {})).toBe(true)
  })
  it('should return false for a non-function', () => {
    expect(isSetValueFunction(123)).toBe(false)
  })
})

describe('isObject', () => {
  it('should return true for an object', () => {
    expect(isObject({})).toBe(true)
  })
  it('should return false for a non-object', () => {
    expect(isObject(123)).toBe(false)
  })
})

describe('isRef', () => {
  it('should return true for a ref object', () => {
    expect(isRef({ isRef: true })).toBe(true)
  })
  it('should return false for a non-ref object', () => {
    expect(isRef({})).toBe(false)
  })
})

describe('isMap', () => {
  it('should return true for a Map', () => {
    expect(isMap(new Map())).toBe(true)
  })
  it('should return false for a non-Map', () => {
    expect(isMap(123)).toBe(false)
  })
})

describe('isSet', () => {
  it('should return true for a Set', () => {
    expect(isSet(new Set())).toBe(true)
  })
  it('should return false for a non-Set', () => {
    expect(isSet(123)).toBe(false)
  })
})

describe('isArray', () => {
  it('should return true for an array', () => {
    expect(isArray([])).toBe(true)
  })
  it('should return false for a non-array', () => {
    expect(isArray(123)).toBe(false)
  })
})

describe('isEqualBase', () => {
  it('should return true for equal values', () => {
    expect(isEqualBase(1, 1)).toBe(true)
  })
  it('should return false for non-equal values', () => {
    expect(isEqualBase(1, 2)).toBe(false)
  })

  it('should return true for NaN values', () => {
    expect(isEqualBase(NaN, NaN)).toBe(true)
  })

  it('should return false for different types', () => {
    expect(isEqualBase(1, '1')).toBe(false)
  })
})