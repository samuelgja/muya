import { cancelablePromise } from './common'
import { isAbortError, isPromise, isSetValueFunction } from './is'
import { createMicroDebounce } from './micro-debounce'
import { PromiseAndValue, SetValue } from './types'

interface Scheduler<T> {
  readonly onFlush: (current: T) => void
  readonly getDefault: () => T
}

interface SchedulerResult<T> {
  current?: T
  addState: (value: SetValue<T>) => void
  abortController?: AbortController
  getValue: (defaultValue: T) => T | Awaited<T>
}

interface StatePromise extends Promise<unknown> {
  isStatePromise: true
}
function crateCancelableStatePromise(controller?: AbortController): {
  promise: StatePromise
  controller: AbortController
} {
  const newPromise = new Promise<unknown>(() => null)
  const result = cancelablePromise(newPromise, controller)
  const statePromise = result.promise as StatePromise
  statePromise.isStatePromise = true
  return { promise: statePromise, controller: result.controller }
}

export function createScheduler<T>(options: Scheduler<T>): SchedulerResult<T> {
  // const batches = new Set<SetValue<T>>()

  const addState = createMicroDebounce<SetValue<T>>({
    // getSize: () => batches.size,
    onFinish: function () {
      if (result.current === undefined) {
        throw new Error('Current state is not defined in flush method')
      }
      options.onFlush(result.current)
    },
    onResolveItem: async function (value) {
      await setState(value)
    },
  })

  function setState(set: SetValue<T>): Promise<void> | void {
    if (result.current === undefined) {
      resolveValue(options.getDefault())
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

  // we do not know if T is a promise or not, so we need to check it
  function resolveValue(defaultValue: T): T {
    if (isPromise(result.current) && result.abortController) {
      result.abortController.abort()
    }
    result.current = defaultValue
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

  function getValue(defaultValue: T): T | Awaited<T> {
    if (result.current === undefined) {
      return resolveValue(defaultValue)
    }
    return result.current
  }
  const result: SchedulerResult<T> = {
    addState,
    getValue,
  }

  return result
}
