import { isPromise } from './is'

const EMPTY_CONTEXT = Symbol('_')

/**
 * Base context interface.
 */
export function createContext<T>(defaultContextValue: T) {
  // Initialize the context with the default value
  let currentContext: T | typeof EMPTY_CONTEXT = defaultContextValue ?? EMPTY_CONTEXT

  /**
   * Retrieves the current context value.
   */
  function use(): T {
    return currentContext === EMPTY_CONTEXT ? defaultContextValue : currentContext
  }

  /**
   * Runs a callback within a new context.
   * @param ctxValue The new context value.
   * @param cb The callback to execute.
   */
  function run<R>(ctxValue: T, cb: () => R): R | Promise<R> {
    const previousContext = currentContext
    currentContext = ctxValue

    const result = cb()
    const isResultPromise = isPromise(result)
    try {
      if (isResultPromise) {
        // If the callback returns a promise, ensure context is reset after it resolves
        return (async () => {
          try {
            return await result
          } finally {
            currentContext = previousContext
          }
        })()
      }
      // For synchronous callbacks, reset context immediately
      return result
    } finally {
      // Reset context after the callback completes
      if (!isResultPromise) {
        currentContext = previousContext
      }
    }
  }

  /**
   * Wraps an asynchronous callback to preserve the current context.
   * @param cb The asynchronous callback to wrap.
   */
  function wrap<X>(cb: () => X | Promise<X>): () => X | Promise<X> {
    const capturedContext = use()
    return async () => {
      const previousContext = currentContext
      currentContext = capturedContext
      try {
        return await cb()
      } finally {
        currentContext = previousContext
      }
    }
  }

  return {
    run,
    use,
    wrap, // Function to wrap async callbacks
  }
}
