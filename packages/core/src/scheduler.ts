type ScheduleId = string | number | symbol

/**
 * Options for scheduler listeners
 */
export interface SchedulerOptions<T> {
  readonly onResolveItem?: (item: T) => void
  readonly onScheduleDone: (values?: T[]) => void
}

/**
 * Public interface for the scheduler
 */
export interface Scheduler {
  add: <T>(id: ScheduleId, options: SchedulerOptions<T>) => () => void
  schedule: <T>(id: ScheduleId, value: T) => void
}

/**
 * Create a microtask-batched scheduler. Works in any JS runtime (browser, Node,
 * React Native, Bun) because it only relies on `queueMicrotask`.
 *
 * Updates scheduled during a flush are drained in the same microtask so React
 * sees them as a single batched update instead of cascading renders.
 * @returns A scheduler with add and schedule methods
 */
export function createScheduler(): Scheduler {
  const listeners = new Map<ScheduleId, SchedulerOptions<unknown>>()
  const batches = new Map<ScheduleId, unknown[]>()
  let isScheduled = false
  let isFlushing = false

  /**
   * Drain all batched updates, including any scheduled during this flush.
   */
  function flush(): void {
    isScheduled = false
    isFlushing = true

    while (batches.size > 0) {
      const pending = new Map(batches)
      batches.clear()

      for (const [id, values] of pending) {
        const listener = listeners.get(id)
        if (!listener) {
          continue
        }

        for (const value of values) {
          listener.onResolveItem?.(value)
        }

        listener.onScheduleDone(values)
      }
    }

    isFlushing = false
  }

  return {
    /**
     * Register a listener for a specific state ID
     * @param id Unique identifier for the state
     * @param options Callbacks for resolving items and flush completion
     * @returns Cleanup function to unregister the listener
     */
    add<T>(id: ScheduleId, options: SchedulerOptions<T>): () => void {
      listeners.set(id, options as SchedulerOptions<unknown>)
      return () => {
        listeners.delete(id)
      }
    },

    /**
     * Schedule a value update for a specific state
     * @param id State identifier
     * @param value Value to schedule
     */
    schedule<T>(id: ScheduleId, value: T): void {
      const existing = batches.get(id) ?? []
      existing.push(value)
      batches.set(id, existing)

      if (isScheduled || isFlushing) {
        return
      }

      isScheduled = true
      queueMicrotask(flush)
    },
  }
}
