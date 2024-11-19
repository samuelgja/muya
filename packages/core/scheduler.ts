import { cancelablePromise } from './common'
import { isAbortError, isPromise, isSetValueFunction } from './is'
import { createMicroDebounce } from './micro-debounce'
import { PromiseAndValue, SetValue } from './types'

interface Scheduler<T> {
  readonly onFlush: (current: T) => void
  readonly getDefault: () => T
}

interface SchedulerResult<T> {
  // current?: T
  // statePromise?: StatePromise
  addState: (value: SetValue<T>) => void
  abortController?: AbortController
  // statePromiseController?: AbortController
  // statePromiseReject?: (reason?: any) => void
  getValue: (defaultValue: T) => T | Awaited<T>
  getCurrent: () => T | undefined
  setCurrent: (value: T | undefined) => void
}

interface StatePromise extends Promise<unknown> {
  isStatePromise: true
}
function crateCancelableStatePromise(controller?: AbortController): {
  promise: StatePromise
  controller: AbortController
  reject: (reason?: any) => void
} {
  let rejectPromise: (reason?: any) => void = () => null
  const newPromise = new Promise<unknown>((_, reject) => {
    reject = rejectPromise
  })

  const result = cancelablePromise(newPromise, controller)
  const statePromise = result.promise as StatePromise
  statePromise.isStatePromise = true
  return { promise: statePromise, reject: rejectPromise, controller: result.controller }
}

export function createScheduler<T>(options: Scheduler<T>): SchedulerResult<T> {
  // const batches = new Set<SetValue<T>>()
  let current: T | undefined
  const addState = createMicroDebounce<SetValue<T>>({
    // getSize: () => batches.size,
    onFinish: function () {
      if (current === undefined) {
        throw new Error('Current state is not defined in flush method')
      }
      options.onFlush(current)
    },
    onResolveItem: async function (value) {
      await setState(value)
    },
  })

  function setState(set: SetValue<T>): Promise<void> | void {
    if (current === undefined) {
      resolveValue(options.getDefault())
    }
    // If set state is not a function, but direct value, we just update
    if (!isSetValueFunction(set)) {
      if (result.abortController) {
        result.abortController.abort()
      }
      current = set
      return
    }
    if (!current) {
      throw new Error('Current state is not defined')
    }
    const setResult = set(current as PromiseAndValue<T>)
    // If value is not promise, we just update the value
    if (!isPromise(setResult)) {
      current = setResult as Awaited<T>
      return
    }

    // createStatePromise()
    return setResult
      .then((resolved) => {
        // If current value is promise, we abort the current promise
        if (isPromise(current) && result.abortController) {
          result.abortController.abort()
        }
        current = resolved as Awaited<T>
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
    if (isPromise(current) && result.abortController) {
      result.abortController.abort()
    }
    current = defaultValue
    options.onFlush(current)
    if (!isPromise(current)) {
      return current
    }

    const cancelable = cancelablePromise(current as Promise<T>)
    result.abortController = cancelable.controller
    cancelable.promise
      .then((resolved) => {
        if (isPromise(current) && result.abortController) {
          result.abortController.abort()
        }
        current = resolved

        options.onFlush(current)
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return
        }
      })

    return cancelable.promise as T
  }

  function getValue(defaultValue: T): T | Awaited<T> {
    if (current === undefined) {
      return resolveValue(defaultValue)
    }
    return current
  }
  const result: SchedulerResult<T> = {
    addState,
    getValue,
    getCurrent: () => {
      return current
    },
    setCurrent: (value) => {
      current = value
    },
  }

  return result
}
