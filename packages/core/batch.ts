import { isAbortError, isAsyncFunction, isPromise, isSetValueFunction } from './is'
import type { PromiseAndValue, SetValue } from './types'
interface Options<T> {
  readonly onFlush: (current: Awaited<T>) => void
  readonly getDefault?: () => T | Promise<T>
}

const THRESHOLD = 0.55
const THRESHOLD_ITEMS = 10

interface BatchResult<T> {
  current?: T
  batches: Set<SetValue<T>>
  addValue: (value: SetValue<T>) => void
  flush: () => void
  abortController?: AbortController
  getValue: () => T
}
export function createBatch<T>(options: Options<T>) {
  const batches = new Set<SetValue<T>>()

  function setState(value: SetValue<T>) {
    if (batch.current === undefined && options.getDefault) {
      batch.current = options.getDefault()
    }
    if (!isSetValueFunction(value)) {
      if (batch.abortController) {
        batch.abortController.abort()
      }
      batch.current = value
      return
    }

    const result = value(batch.current as PromiseAndValue<T>)
    if (!isPromise(result)) {
      batch.current = result as T
      return
    }

    return result
      .then((resolvedValue) => {
        // check if state.value is resolved value
        if (isPromise(batch.current) && batch.abortController) {
          batch.abortController.abort()
        }
        batch.current = resolvedValue as T
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return
        }
      })
  }

  let frame = performance.now()
  const channel = new MessageChannel()
  const flushFromChannel = () => {
    frame = performance.now()
    flush()
  }
  channel.port1.onmessage = flushFromChannel

  function scheduler() {
    const startFrame = performance.now()
    const frameSizeDiffIn = startFrame - frame
    channel.port2.postMessage(null)
    if (frameSizeDiffIn > THRESHOLD && batch.batches.size > 0 && batch.batches.size < THRESHOLD_ITEMS) {
      frame = startFrame
      flush()
    }
  }

  async function flush() {
    // Create a copy to prevent mutations during iteration
    let prevValue = batch.current
    for (const batchItem of batch.batches) {
      if (isAsyncFunction(batchItem)) {
        // eslint-disable-next-line sonarjs/no-invalid-await
        await setState(await batchItem)
      } else {
        setState(batchItem)
      }
      batch.batches.delete(batchItem)
    }
    if (prevValue === batch.current) {
      prevValue = undefined
      return
    }
    batches.clear()
    options.onFlush(batch.current as Awaited<T>)
  }

  function addValue(value: SetValue<T>) {
    batch.batches.add(value)
    scheduler()
  }
  function getValue() {
    if (batch.current === undefined && options.getDefault) {
      batch.current = options.getDefault()
    }
    return batch.current
  }
  const batch: BatchResult<T> = {
    current: undefined,
    batches,
    addValue,
    flush,
    getValue,
  }
  return batch
}
