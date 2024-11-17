import type { Emitter } from './create-emitter'
import { select } from './select'
import type { BaseState, GetterState } from './types'

interface Options<T> {
  readonly emitter: Emitter<T>
  readonly reset: () => void
  readonly getState: () => T
  readonly getGetterState: () => GetterState<T>
}
export function createBaseState<T>(options: Options<T>): BaseState<T> {
  const { emitter, getGetterState, reset, getState } = options
  return {
    getState,
    reset,
    select(selector, isSame) {
      const state = getGetterState()
      return select(state, selector, isSame)
    },

    __internal: {
      emitter,
    },
    subscribe(listener) {
      listener(getState())
      return emitter.subscribe(() => {
        listener(getState())
      })
    },
  }
}
