import type { SetValue } from './types'

interface Batch<T> {
  frame: number
  value: SetValue<T>
}
export function createBatcher<T>(set: (value: SetValue<T>) => void) {
  const batches: Batch<T>[] = []

  function scheduler() {
    const frameSize = batches.length
    requestAnimationFrame(() => {
      const frameSizeDiff = batches.length - frameSize
      if (frameSizeDiff < 2) {
        const lastUpdate = result.batches.at(-1)
        // if (lastUpdate) {
        //   set(lastUpdate.value)
        //   result.batches = []
        // }
        result.flush()

        // result.flush()
      }
    })
  }

  const result = {
    batches,
    addValue(value: SetValue<T>) {
      const frame = performance.now()
      this.batches.push({
        frame,
        value,
      })
      scheduler()
    },
    flush() {
      for (const batch of this.batches) {
        set(batch.value)
      }
      this.batches = []
    },
  }
  return result
}
