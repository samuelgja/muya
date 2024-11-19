import { cancelablePromise } from './common'
import { isAbortError, isPromise, isSetValueFunction } from './is'
import { PromiseAndValue, SetValue } from './types'

const THRESHOLD = 0.55
const THRESHOLD_ITEMS = 10

// interface Scheduler<T> {
//   readonly onFlush: (current: T) => void
//   readonly getDefault: () => T
// }

interface Single<T> {
  abortController?: AbortController
  current?: T
  getValue: () => T | Awaited<T>
  getDefault: () => T
}

interface SchedulerResult {
  addValue: (id: string, value: SetValue<unknown>) => void
  onFlush: (values: Map<string, Single<unknown>>) => void
  atoms: Map<string, Single<unknown>>
}

interface Batch {
  readonly value: SetValue<unknown>
  readonly id: string
}

export function createGlobalScheduler() {
  const batches = new Set<Batch>()
  const atoms = new Map<string, Single<unknown>>()

  let frame = performance.now()
  const channel = new MessageChannel()
  const flushFromChannel = () => {
    frame = performance.now()
    flush()
  }
  channel.port1.onmessage = flushFromChannel

  function schedule() {
    const startFrame = performance.now()
    const frameSizeDiffIn = startFrame - frame
    channel.port2.postMessage(null)
    if (frameSizeDiffIn > THRESHOLD && batches.size > 0 && batches.size < THRESHOLD_ITEMS) {
      frame = startFrame
      flush()
    }
  }

  const result: SchedulerResult = {
    addValue,
    atoms,
  }
}
