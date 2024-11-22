import { create } from '../../create'
import { isPromise, isFunction, isSetValueFunction, isMap, isSet, isArray, isEqualBase, isUndefined, isState } from '../is'

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
})

describe('isUndefined', () => {
  it('should return true for undefined', () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    expect(isUndefined(undefined)).toBe(true)
  })
  it('should return false for a non-undefined', () => {
    expect(isUndefined(123)).toBe(false)
  })
})

describe('isState', () => {
  it('should return true for a State', () => {
    const state = create(1)
    expect(isState(state)).toBe(true)
  })
  it('should return false for a non-State', () => {
    expect(isState(123)).toBe(false)
  })
})
