import { isPromise } from './is'

const EMPTY_CONTEXT = Symbol('_')

export function createContext<T>(defaultContextValue: T) {
  const contextStack: Array<T | typeof EMPTY_CONTEXT> = []

  function use(): T {
    if (contextStack.length === 0) {
      return defaultContextValue
    }
    const currentContext = contextStack[contextStack.length - 1]
    return currentContext === EMPTY_CONTEXT ? defaultContextValue : currentContext
  }

  function run<R>(ctxValue: T, cb: () => R | Promise<R>): R {
    contextStack.push(ctxValue)
    const result = cb()
    const isResultPromise = isPromise(result)
    if (isResultPromise) {
      return (async () => {
        try {
          return await result
        } finally {
          contextStack.pop()
        }
      })() as R
    } else {
      contextStack.pop()
      return result
    }
  }

  function wrap<X>(cb: () => X | Promise<X>): () => X | Promise<X> {
    const capturedContext = use()
    return () => {
      contextStack.push(capturedContext)
      const result = cb()
      const isResultPromise = isPromise(result)
      if (isResultPromise) {
        return (async () => {
          try {
            return await result
          } finally {
            contextStack.pop()
          }
        })()
      } else {
        contextStack.pop()
        return result
      }
    }
  }

  return {
    run,
    use,
    wrap,
  }
}
