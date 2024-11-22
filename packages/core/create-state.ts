import { select } from './select'
import type { RawGetState, RawState, SetValue } from './types'
import { useValue } from './use-value'
import { generateId } from './utils/common'
import { createEmitter } from './utils/create-emitter'
import { isEqualBase } from './utils/is'

interface GetStateOptions<T> {
  readonly get: () => T
  readonly set?: (value: SetValue<T>) => void
  readonly destroy: () => void
}

type FullState<T> = GetStateOptions<T>['set'] extends undefined ? RawGetState<T> : RawState<T>
export function createState<T>(options: GetStateOptions<T>): FullState<T> {
  const { get, destroy, set } = options

  const state: FullState<T> = function (selector) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useValue(state, selector)
  }
  state.id = generateId()
  state.emitter = createEmitter<T>(get)
  state.destroy = destroy
  state.listen = function (listener) {
    return this.emitter.subscribe(() => {
      listener(get())
    })
  }
  state.withName = function (name) {
    this.name = name
    return this
  }
  state.select = function (selector, isSelectorEqual = isEqualBase) {
    return select([state], selector, isSelectorEqual)
  }
  state.get = get
  state.set = set as RawState<T>['set']

  return state
}
