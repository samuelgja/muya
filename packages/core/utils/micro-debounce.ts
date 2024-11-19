const THRESHOLD = 0.2
const THRESHOLD_ITEMS = 10
const RESCHEDULE_COUNT = 0

interface Options<T> {
  readonly onResolveItem?: (item: T) => void
  readonly onFinish: () => void
}

export function createMicroDebounce<T>(options: Options<T>) {
  const batches = new Set<T>()
  const { onResolveItem, onFinish } = options
  let frame = performance.now()
  let scheduled = false

  function schedule() {
    const startFrame = performance.now()
    const frameSizeDiffIn = startFrame - frame
    const size = batches.size
    if (frameSizeDiffIn < THRESHOLD && size > 0 && size < THRESHOLD_ITEMS) {
      frame = startFrame
      flush()
    } else if (!scheduled) {
      scheduled = true
      Promise.resolve().then(() => {
        scheduled = false
        frame = performance.now()
        flush()
      })
    }
  }

  function flush() {
    if (batches.size === 0) {
      return
    }
    for (const value of batches) {
      if (onResolveItem) {
        onResolveItem(value)
      }
      batches.delete(value)
    }

    if (batches.size > RESCHEDULE_COUNT) {
      schedule()
      return
    }
    onFinish()
  }

  function addValue(value: T) {
    batches.add(value)
    schedule()
  }
  return addValue
}
