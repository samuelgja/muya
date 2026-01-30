export class MapDeque<K, V> extends Map<K, V> {
  constructor(
    private maxSize: number,
    entries?: ReadonlyArray<readonly [K, V]> | null,
  ) {
    super(entries)
    if (this.maxSize <= 0) {
      throw new RangeError('maxSize must be greater than 0')
    }
  }

  override set(key: K, value: V): this {
    if (this.has(key)) {
      super.set(key, value)
      return this
    }

    if (this.size >= this.maxSize) {
      const firstKey = this.keys().next().value
      if (firstKey !== undefined) {
        this.delete(firstKey)
      }
    }

    super.set(key, value)

    return this
  }
}
