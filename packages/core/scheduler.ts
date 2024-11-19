import { cancelablePromise } from './common'
import { isAbortError, isPromise, isSetValueFunction } from './is'
import { PromiseAndValue, SetValue } from './types'

const THRESHOLD = 0.55
const THRESHOLD_ITEMS = 10

interface Scheduler<T> {
  readonly onFlush: (current: T) => void
  readonly getDefault: () => T
}

interface SchedulerResult<T> {
  current?: T
  addState: (value: SetValue<T>) => void
  flush: () => void
  abortController?: AbortController
  getValue: () => T | Awaited<T>
}
export function createScheduler<T>(options: Scheduler<T>): SchedulerResult<T> {
  const batches = new Set<SetValue<T>>()

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

  function setState(set: SetValue<T>): Promise<void> | void {
    if (result.current === undefined) {
      resolveValue()
    }
    // If set state is not a function, but direct value, we just update
    if (!isSetValueFunction(set)) {
      if (result.abortController) {
        result.abortController.abort()
      }
      result.current = set
      return
    }
    if (!result.current) {
      throw new Error('Current state is not defined')
    }
    const setResult = set(result.current as PromiseAndValue<T>)
    // If value is not promise, we just update the value
    if (!isPromise(setResult)) {
      result.current = setResult as Awaited<T>
      return
    }

    return setResult
      .then((resolved) => {
        // If current value is promise, we abort the current promise
        if (isPromise(result.current) && result.abortController) {
          result.abortController.abort()
        }
        result.current = resolved as Awaited<T>
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return
        }
        throw error
      })
  }

  function addState(value: SetValue<T>) {
    batches.add(value)
    schedule()
  }

  async function flush() {
    if (batches.size === 0) {
      return
    }
    for (const value of batches) {
      await setState(await value)
      batches.delete(value)
    }
    if (result.current === undefined) {
      throw new Error('Current state is not defined in flush method')
    }
    options.onFlush(result.current)
  }

  // we do not know if T is a promise or not, so we need to check it
  function resolveValue(): T {
    if (isPromise(result.current) && result.abortController) {
      result.abortController.abort()
    }
    result.current = options.getDefault()
    options.onFlush(result.current)
    if (!isPromise(result.current)) {
      return result.current
    }
    const cancelable = cancelablePromise(result.current as Promise<T>)
    result.abortController = cancelable.controller
    cancelable.promise
      .then((resolved) => {
        if (isPromise(result.current) && result.abortController) {
          result.abortController.abort()
        }
        result.current = resolved
        options.onFlush(result.current)
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return
        }
        throw error
      })

    return cancelable.promise as T
  }

  function getValue(): T | Awaited<T> {
    if (result.current === undefined) {
      return resolveValue()
    }
    return result.current
  }
  const result: SchedulerResult<T> = {
    addState,
    flush,
    getValue,
  }

  return result
}
