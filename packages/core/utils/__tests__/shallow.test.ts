import { shallow } from '../shallow'

describe('shallow', () => {
  it('should return true for identical primitive values', () => {
    expect(shallow(1, 1)).toBe(true)
    expect(shallow('a', 'a')).toBe(true)
    expect(shallow(true, true)).toBe(true)
  })

  it('should return false for different primitive values', () => {
    expect(shallow(1, 2)).toBe(false)
    expect(shallow('a', 'b')).toBe(false)
    expect(shallow(true, false)).toBe(false)
  })

  it('should return true for identical objects', () => {
    const object = { a: 1 }
    expect(shallow(object, object)).toBe(true)
  })

  it('should return false for different objects with diff properties', () => {
    expect(shallow({ a: 1 }, { a: 2 })).toBe(false)
  })

  it('should return true for identical arrays', () => {
    const array = [1, 2, 3]
    expect(shallow(array, array)).toBe(true)
  })

  it('should return true for different arrays with same elements', () => {
    expect(shallow([1, 2, 3], [1, 2, 3])).toBe(true)
  })

  it('should return true for identical Maps', () => {
    const map = new Map([['a', 1]])
    expect(shallow(map, map)).toBe(true)
  })

  it('should return true for different Maps with same entries', () => {
    expect(shallow(new Map([['a', 1]]), new Map([['a', 1]]))).toBe(true)
  })

  it('should return true for identical Sets', () => {
    const set = new Set([1, 2, 3])
    expect(shallow(set, set)).toBe(true)
  })

  it('should return true for different Sets with same elements', () => {
    expect(shallow(new Set([1, 2, 3]), new Set([1, 2, 3]))).toBe(true)
  })

  it('should return true for objects with same reference', () => {
    const object = { a: 1 }
    expect(shallow(object, object)).toBe(true)
  })

  it('should return true for objects with different references', () => {
    expect(shallow({ a: 1 }, { a: 1 })).toBe(true)
  })

  it('should return true for arrays with same reference', () => {
    const array = [1, 2, 3]
    expect(shallow(array, array)).toBe(true)
  })

  it('should return true for arrays with different references', () => {
    expect(shallow([1, 2, 3], [1, 2, 3])).toBe(true)
  })

  it('should return true for Maps with same reference', () => {
    const map = new Map([['a', 1]])
    expect(shallow(map, map)).toBe(true)
  })

  it('should return true for Maps with different references', () => {
    expect(shallow(new Map([['a', 1]]), new Map([['a', 1]]))).toBe(true)
  })

  it('should return true for Sets with same reference', () => {
    const set = new Set([1, 2, 3])
    expect(shallow(set, set)).toBe(true)
  })

  it('should return true for Sets with different references', () => {
    expect(shallow(new Set([1, 2, 3]), new Set([1, 2, 3]))).toBe(true)
  })

  it('should return true for objects with same keys and values', () => {
    const objectA = { a: 1, b: 2 }
    const objectB = { a: 1, b: 2 }
    expect(shallow(objectA, objectB)).toBe(true)
  })

  it('should return false for objects with different keys or values', () => {
    const objectA = { a: 1, b: 2 }
    const objectB = { a: 1, b: 3 }
    expect(shallow(objectA, objectB)).toBe(false)
  })

  it('should return true for arrays with same elements', () => {
    const arrayA = [1, 2, 3]
    const arrayB = [1, 2, 3]
    expect(shallow(arrayA, arrayB)).toBe(true)
  })

  it('should return false for arrays with different elements', () => {
    const arrayA = [1, 2, 3]
    const arrayB = [1, 2, 4]
    expect(shallow(arrayA, arrayB)).toBe(false)
  })

  it('should return true for Maps with same entries', () => {
    const mapA = new Map([
      ['a', 1],
      ['b', 2],
    ])
    const mapB = new Map([
      ['a', 1],
      ['b', 2],
    ])
    expect(shallow(mapA, mapB)).toBe(true)
  })

  it('should return false for Maps with different entries', () => {
    const mapA = new Map([
      ['a', 1],
      ['b', 2],
    ])
    const mapB = new Map([
      ['a', 1],
      ['b', 3],
    ])
    expect(shallow(mapA, mapB)).toBe(false)
  })

  it('should return true for Sets with same elements', () => {
    const setA = new Set([1, 2, 3])
    const setB = new Set([1, 2, 3])
    expect(shallow(setA, setB)).toBe(true)
  })

  it('should return false for Sets with different elements', () => {
    const setA = new Set([1, 2, 3])
    const setB = new Set([1, 2, 4])
    expect(shallow(setA, setB)).toBe(false)
  })

  it('should return false for different objects with same properties', () => {
    expect(shallow({ a: 1 }, { a: 2 })).toBe(false)
  })

  it('should return false for different arrays with same elements', () => {
    expect(shallow([1, 2, 3], [1, 2, 4])).toBe(false)
  })

  it('should return false for different Maps with same entries', () => {
    expect(shallow(new Map([['a', 1]]), new Map([['a', 2]]))).toBe(false)
  })

  it('should return false for different Sets with same elements', () => {
    expect(shallow(new Set([1, 2, 3]), new Set([1, 2, 4]))).toBe(false)
  })

  it('should return false for objects with different reference', () => {
    expect(shallow({ a: 1 }, { a: 2 })).toBe(false)
  })

  it('should return false for arrays with different reference', () => {
    expect(shallow([1, 2, 3], [1, 2, 4])).toBe(false)
  })

  it('should return false for Maps with different reference', () => {
    expect(shallow(new Map([['a', 1]]), new Map([['a', 2]]))).toBe(false)
  })

  it('should return false for Sets with different reference', () => {
    expect(shallow(new Set([1, 2, 3]), new Set([1, 2, 4]))).toBe(false)
  })

  it('should return false for objects with different keys or values in', () => {
    const objectA = { a: 1, b: 2 }
    const objectB = { a: 1, b: 3 }
    expect(shallow(objectA, objectB)).toBe(false)
  })

  it('should return false for arrays with different elements', () => {
    const arrayA = [1, 2, 3]
    const arrayB = [1, 2, 4]
    expect(shallow(arrayA, arrayB)).toBe(false)
  })

  it('should return false for Maps with different entries', () => {
    const mapA = new Map([
      ['a', 1],
      ['b', 2],
    ])
    const mapB = new Map([
      ['a', 1],
      ['b', 3],
    ])
    expect(shallow(mapA, mapB)).toBe(false)
  })

  it('should return false for Sets with different elements', () => {
    const setA = new Set([1, 2, 3])
    const setB = new Set([1, 2, 4])
    expect(shallow(setA, setB)).toBe(false)
  })

  it('should return false for objects with different keys or values', () => {
    const objectA = { a: 1, b: 2 }
    const objectB = { a: 1, b: 3 }
    expect(shallow(objectA, objectB)).toBe(false)
  })

  it('should return false for arrays with different elements', () => {
    const arrayA = [1, 2, 3]
    const arrayB = [1, 2, 4]
    expect(shallow(arrayA, arrayB)).toBe(false)
  })

  it('should return false for Maps with different entries', () => {
    const mapA = new Map([
      ['a', 1],
      ['b', 2],
    ])
    const mapB = new Map([
      ['a', 1],
      ['b', 3],
    ])
    expect(shallow(mapA, mapB)).toBe(false)
  })

  it('should return false for Sets with different elements', () => {
    const setA = new Set([1, 2, 3])
    const setB = new Set([1, 2, 4])
    expect(shallow(setA, setB)).toBe(false)
  })

  it('should return false for objects with different keys or values', () => {
    const objectA = { a: 1, b: 2 }
    const objectB = { a: 1, b: 3 }
    expect(shallow(objectA, objectB)).toBe(false)
  })

  it('should return false for arrays with different elements', () => {
    const arrayA = [1, 2, 3]
    const arrayB = [1, 2, 4]
    expect(shallow(arrayA, arrayB)).toBe(false)
  })

  it('should return false for Maps with different entries', () => {
    const mapA = new Map([
      ['a', 1],
      ['b', 2],
    ])
    const mapB = new Map([
      ['a', 1],
      ['b', 3],
    ])
    expect(shallow(mapA, mapB)).toBe(false)
  })

  it('should return false for Sets with different elements', () => {
    const setA = new Set([1, 2, 3])
    const setB = new Set([1, 2, 4])
    expect(shallow(setA, setB)).toBe(false)
  })

  it('should return false for objects with different keys or values', () => {
    const objectA = { a: 1, b: 2 }
    const objectB = { a: 1, b: 3 }
    expect(shallow(objectA, objectB)).toBe(false)
  })

  it('should return false for arrays with different elements', () => {
    const arrayA = [1, 2, 3]
    const arrayB = [1, 2, 4]
    expect(shallow(arrayA, arrayB)).toBe(false)
  })

  it('should return false for Maps with different entries', () => {
    const mapA = new Map([
      ['a', 1],
      ['b', 2],
    ])
    const mapB = new Map([
      ['a', 1],
      ['b', 3],
    ])
    expect(shallow(mapA, mapB)).toBe(false)
  })

  it('should return false for Sets with different elements', () => {
    const setA = new Set([1, 2, 3])
    const setB = new Set([1, 2, 4])
    expect(shallow(setA, setB)).toBe(false)
  })

  it('should return false for objects with different keys or values', () => {
    const objectA = { a: 1, b: 2 }
    const objectB = { a: 1, b: 3 }
    expect(shallow(objectA, objectB)).toBe(false)
  })

  it('should return false for arrays with different elements', () => {
    const arrayA = [1, 2, 3]
    const arrayB = [1, 2, 4]
    expect(shallow(arrayA, arrayB)).toBe(false)
  })

  it('should return false for Maps with different entries', () => {
    const mapA = new Map([
      ['a', 1],
      ['b', 2],
    ])
    const mapB = new Map([
      ['a', 1],
      ['b', 3],
    ])
    expect(shallow(mapA, mapB)).toBe(false)
  })

  it('should return false for Sets with different elements', () => {
    const setA = new Set([1, 2, 3])
    const setB = new Set([1, 2, 4])
    expect(shallow(setA, setB)).toBe(false)
  })

  it('should return false for objects with different keys or values', () => {
    const objectA = { a: 1, b: 2 }
    const objectB = { a: 1, b: 3 }
    expect(shallow(objectA, objectB)).toBe(false)
  })

  it('should return false for arrays with different elements', () => {
    const arrayA = [1, 2, 3]
    const arrayB = [1, 2, 4]
    expect(shallow(arrayA, arrayB)).toBe(false)
  })

  it('should return false for Maps with different entries', () => {
    const mapA = new Map([
      ['a', 1],
      ['b', 2],
    ])
    const mapB = new Map([
      ['a', 1],
      ['b', 3],
    ])
    expect(shallow(mapA, mapB)).toBe(false)
  })

  it('should return false for Sets with different elements', () => {
    const setA = new Set([1, 2, 3])
    const setB = new Set([1, 2, 4])
    expect(shallow(setA, setB)).toBe(false)
  })

  it('should return false for null and non-null values', () => {
    expect(shallow(null, {})).toBe(false)
    expect(shallow({}, null)).toBe(false)
  })

  it('should return false for objects with different number of keys', () => {
    expect(shallow({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it('should return false for objects with different keys', () => {
    expect(shallow({ a: 1 }, { b: 1 })).toBe(false)
  })

  it('should return false for objects with different values', () => {
    expect(shallow({ a: 1 }, { a: 2 })).toBe(false)
  })

  it('should return false for arrays with different lengths', () => {
    expect(shallow([1, 2], [1, 2, 3])).toBe(false)
  })

  it('should return false for arrays with different elements', () => {
    expect(shallow([1, 2, 3], [1, 2, 4])).toBe(false)
  })

  it('should return false for Maps with different sizes', () => {
    expect(
      shallow(
        new Map([['a', 1]]),
        new Map([
          ['a', 1],
          ['b', 2],
        ]),
      ),
    ).toBe(false)
  })

  it('should return false for Maps with different keys', () => {
    expect(shallow(new Map([['a', 1]]), new Map([['b', 1]]))).toBe(false)
  })

  it('should return false for Maps with different values', () => {
    expect(shallow(new Map([['a', 1]]), new Map([['a', 2]]))).toBe(false)
  })

  it('should return false for Sets with different sizes', () => {
    expect(shallow(new Set([1, 2]), new Set([1, 2, 3]))).toBe(false)
  })

  it('should return false for Sets with different elements', () => {
    expect(shallow(new Set([1, 2, 3]), new Set([1, 2, 4]))).toBe(false)
  })

  it('should return true compare simple values', () => {
    expect(shallow(1, 1)).toBe(true)
    expect(shallow('a', 'a')).toBe(true)
    expect(shallow(true, true)).toBe(true)
  })
})
