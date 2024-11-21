import type { SchedulerOptions } from './scheduler'
import { RESCHEDULE_COUNT, THRESHOLD, THRESHOLD_ITEMS } from './scheduler'

interface GlobalSchedulerItem<T> {
  value: T
  id: number
}

export function createGlobalScheduler() {
  const listeners = new Map<number, SchedulerOptions<unknown>>()
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

    const effectedListeners = new Set<number>()
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
      listeners.get(id)?.onFinish()
    }
  }

  return {
    add(id: number, option: SchedulerOptions<unknown>) {
      listeners.set(id, option)
      return () => {
        listeners.delete(id)
      }
    },
    schedule<T>(id: number, value: T) {
      batches.add({ value, id })
      schedule()
    },
  }
}
