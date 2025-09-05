import { select } from './select'
import type { GetState, SetValue, State, Cache } from './types'
import { useValue } from './use-value'
import { createEmitter } from './utils/create-emitter'
import { isEqualBase, isPromise } from './utils/is'

interface GetStateOptions<T> {
  readonly get: () => T
  readonly set?: (value: SetValue<T>) => void
  readonly destroy: () => void
  readonly getSnapshot: () => T
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
  const { get, destroy, set, getSnapshot } = options
  const isSet = !!set
  const cache: Cache<T> = {}
  const state: FullState<T> = function (selector) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useValue(state, selector)
  }
  state.isSet = isSet as true
  state.id = getStateId()
  state.emitter = createEmitter<T>(getSnapshot)
  state.destroy = destroy
  state.listen = function (listener) {
    return this.emitter.subscribe(() => {
      const value = get()
      if (isPromise(value)) {
        return
      }
      listener(get() as Awaited<T>)
    })
  }
  state.withName = function (name) {
    this.stateName = name
    return this
  }
  state.select = function (selector: never, isSelectorEqual = isEqualBase) {
    return select([state as never], selector, isSelectorEqual)
  } as never
  state.get = get as never
  state.set = set as State<T>['set']
  state.cache = cache

  return state
}
