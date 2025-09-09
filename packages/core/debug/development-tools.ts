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
/**
 * Send state information to Redux DevTools if available
 * @param options Options containing message, type, value, and name
 */
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

/**
 * Create a listener function for development tools that sends state updates
 * @param name The name of the state
 * @param type The type of the state ('state' or 'derived')
 * @returns A listener function that sends updates to development tools
 */
function developmentToolsListener(name: string, type: StateType) {
  return (value: unknown) => {
    sendToDevelopmentTools({ name, type, value, message: 'update' })
  }
}

/**
 * Subscribe a state to development tools if available
 * @param state The state to subscribe
 * @returns A function to unsubscribe from development tools
 */
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
