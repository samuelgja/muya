import { MapDeque } from '../src/table/map-deque'

describe('MapDeque', () => {
  it('should throw if maxSize <= 0', () => {
    expect(() => new MapDeque(0)).toThrow(RangeError)
    expect(() => new MapDeque(-1)).toThrow(RangeError)
  })

  it('should add items up to maxSize', () => {
    const deque = new MapDeque<string, number>(2)
    deque.set('a', 1)
    deque.set('b', 2)
    expect(deque.size).toBe(2)
    expect(deque.get('a')).toBe(1)
    expect(deque.get('b')).toBe(2)
  })

  it('should evict the oldest item when maxSize is exceeded', () => {
    const deque = new MapDeque<string, number>(2)
    deque.set('a', 1)
    deque.set('b', 2)
    deque.set('c', 3)
    expect(deque.size).toBe(2)
    expect(deque.has('a')).toBe(false)
    expect(deque.get('b')).toBe(2)
    expect(deque.get('c')).toBe(3)
  })

  it('should update value if key already exists and not evict', () => {
    const deque = new MapDeque<string, number>(2)
    deque.set('a', 1)
    deque.set('b', 2)
    // eslint-disable-next-line sonarjs/no-element-overwrite
    deque.set('a', 42)
    expect(deque.size).toBe(2)
    expect(deque.get('a')).toBe(42)
    expect(deque.get('b')).toBe(2)
  })

  it('should work with initial entries', () => {
    const entries: Array<[string, number]> = [
      ['x', 10],
      ['y', 20],
    ]
    const deque = new MapDeque<string, number>(3, entries)
    expect(deque.size).toBe(2)
    expect(deque.get('x')).toBe(10)
    expect(deque.get('y')).toBe(20)
  })

  it('should evict in insertion order, not key order', () => {
    const deque = new MapDeque<string, number>(2)
    deque.set('b', 1)
    deque.set('a', 2)
    deque.set('c', 3)
    expect(deque.size).toBe(2)
    expect(deque.has('b')).toBe(false)
    expect(deque.has('a')).toBe(true)
    expect(deque.has('c')).toBe(true)
  })
})
