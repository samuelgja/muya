import { getDefaultValue } from '../types'

describe('getDefaultValue', () => {
  it('should return the value if it is not a function or promise', () => {
    expect(getDefaultValue(123)).toBe(123)
  })

  it('should return the resolved value if it is a function', () => {
    expect(getDefaultValue(() => 123)).toBe(123)
  })

  it('should return the promise if it is a promise', () => {
    const promise = Promise.resolve(123)
    expect(getDefaultValue(promise)).toBe(promise)
    expect(getDefaultValue(() => promise)).toBe(promise)
  })
})
