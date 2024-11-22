import { select } from './select'
import type { GetState, SetValue, State } from './types'
import { useValue } from './use-value'
import { createEmitter } from './utils/create-emitter'
import { isEqualBase } from './utils/is'

interface GetStateOptions<T> {
  readonly get: () => T
  readonly set?: (value: SetValue<T>) => void
  readonly destroy: () => void
}

let stateId = 0
function getStateId() {
  return stateId++
}

type FullState<T> = GetStateOptions<T>['set'] extends undefined ? GetState<T> : State<T>
/**
 * This is just utility function to create state base data
 */
export function createState<T>(options: GetStateOptions<T>): FullState<T> {
  const { get, destroy, set } = options
  const isSet = !!set

  const state: FullState<T> = function (selector) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useValue(state, selector)
  }
  state.isSet = isSet as true
  state.id = getStateId()
  state.emitter = createEmitter<T>(get)
  state.destroy = destroy
  state.listen = function (listener) {
    return this.emitter.subscribe(() => {
      listener(get())
    })
  }
  state.withName = function (name) {
    this.stateName = name
    return this
  }
  state.select = function (selector, isSelectorEqual = isEqualBase) {
    return select([state], selector, isSelectorEqual)
  }
  state.get = get
  state.set = set as State<T>['set']

  return state
}
