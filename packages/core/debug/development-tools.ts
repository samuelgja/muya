import type { GetState, State } from '../types'
import { isPromise, isState } from '../utils/is'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
const reduxDevelopmentTools = globalThis?.__REDUX_DEVTOOLS_EXTENSION__?.connect({
  name: 'CustomState', // This will name your instance in the DevTools
  trace: true, // Enables trace if needed
})

if (reduxDevelopmentTools) {
  reduxDevelopmentTools.init({ message: 'Initial state' })
}

export type StateType = 'state' | 'derived'

interface SendOptions {
  message?: string
  type: StateType
  value: unknown
  name: string
}
function sendToDevelopmentTools(options: SendOptions) {
  if (!reduxDevelopmentTools) {
    return
  }
  const { message, type, value, name } = options
  if (isPromise(value)) {
    return
  }
  reduxDevelopmentTools.send(name, { value, type, message }, type)
}

function developmentToolsListener(name: string, type: StateType) {
  return (value: unknown) => {
    sendToDevelopmentTools({ name, type, value, message: 'update' })
  }
}

export function subscribeToDevelopmentTools<T>(state: State<T> | GetState<T>) {
  if (process.env.NODE_ENV === 'production') {
    return
  }
  let type: StateType = 'state'

  if (!isState(state)) {
    type = 'derived'
  }
  const name = state.stateName?.length ? state.stateName : `${type}(${state.id.toString()})`
  return state.listen(developmentToolsListener(name, type))
}
