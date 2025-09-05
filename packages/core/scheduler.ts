export const THRESHOLD = 0.2
export const THRESHOLD_ITEMS = 10
export const RESCHEDULE_COUNT = 0

type ScheduleId = string | number | symbol
interface GlobalSchedulerItem<T> {
  value: T
  id: ScheduleId
}

export interface SchedulerOptions<T> {
  readonly onResolveItem?: (item: T) => void
  readonly onScheduleDone: () => void | Promise<void>
}

/**
 * A simple scheduler to batch updates and avoid blocking the main thread
 * It uses a combination of time-based and count-based strategies to determine when to flush the queue.
 * - Time-based: If the time taken to process the current batch is less than a threshold (THRESHOLD), it continues processing.
 * - Count-based: If the ScheduleId of items in the batch exceeds a certain limit (THRESHOLD_ITEMS), it defers processing to the next microtask.
 * @returns An object with methods to add listeners and schedule tasks.
 */
export function createScheduler() {
  const listeners = new Map<ScheduleId, SchedulerOptions<unknown>>()
  const batches = new Set<GlobalSchedulerItem<unknown>>()

  let frame = performance.now()
  let scheduled = false

  function schedule() {
    const startFrame = performance.now()
    const frameSizeDiffIn = startFrame - frame
    const { size } = batches
    if (frameSizeDiffIn < THRESHOLD && size > 0 && size < THRESHOLD_ITEMS) {
      frame = startFrame
      flush()
      return
    }

    if (!scheduled) {
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

    const effectedListeners = new Set<ScheduleId>()
    for (const value of batches) {
      if (listeners.has(value.id)) {
        effectedListeners.add(value.id)
        const { onResolveItem } = listeners.get(value.id)!
        if (onResolveItem) {
          onResolveItem(value.value)
        }
      }
      batches.delete(value)
    }

    if (batches.size > RESCHEDULE_COUNT) {
      schedule()
      return
    }

    for (const id of effectedListeners) {
      listeners.get(id)?.onScheduleDone()
    }
  }

  return {
    add<T>(id: ScheduleId, option: SchedulerOptions<T>) {
      listeners.set(id, option as SchedulerOptions<unknown>)
      return () => {
        listeners.delete(id)
      }
    },
    schedule<T>(id: ScheduleId, value: T) {
      batches.add({ value, id })
      schedule()
    },
  }
}
