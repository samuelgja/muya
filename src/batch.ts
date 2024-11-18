import { isAbortError, isAsyncFunction, isPromise, isSetValueFunction } from './is'
import type { PromiseAndValue, SetValue } from './types'

interface Options<T> {
  setValue: (value: T) => void
  getValue: () => T

  onFlush: (current: Awaited<T>) => void
}
interface BatchResult<T> {
  current?: T
  batches: SetValue<T>[]
  addValue: (value: SetValue<T>) => void
  flush: () => void
  abortController?: AbortController
}
export function createBatcher<T>(options: Options<T>) {
  const batches: SetValue<T>[] = []

  function setState(value: SetValue<T>) {
    if (batch.current == undefined) {
      batch.current = options.getValue()
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

  function scheduler() {
    const startFrame = performance.now()

    const frameSizeDiffIn = startFrame - frame
    if (frameSizeDiffIn > 0.53 && batch.batches.length > 0 && batch.batches.length < 10) {
      frame = startFrame
      batch.flush()
    }

    setImmediate(() => {
      if (batch.batches.length > 0) {
        frame = startFrame
        batch.flush()
      }
    })
  }

  async function flush() {
    for (const batchItem of batch.batches) {
      if (isAsyncFunction(batchItem)) {
        // eslint-disable-next-line sonarjs/no-invalid-await
        await setState(await batchItem)
      } else {
        setState(batchItem)
      }
    }
    batch.batches = []
    options.onFlush(batch.current as Awaited<T>)
  }

  function addValue(value: SetValue<T>) {
    batch.batches.push(value)
    scheduler()
  }
  const batch: BatchResult<T> = {
    current: undefined,
    batches,
    addValue,
    flush,
  }
  return batch
}
