import { isPromise } from './is'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
const reduxDevelopmentTools = window.__REDUX_DEVTOOLS_EXTENSION__?.connect({
  name: 'CustomState', // This will name your instance in the DevTools
  trace: true, // Enables trace if needed
})

if (reduxDevelopmentTools) {
  reduxDevelopmentTools.init({ message: 'Initial state' })
}

export type StateType = 'state' | 'derived'

export function sendToDevelopmentTools(action: string, type: StateType, value: unknown, message?: string) {
  if (isPromise(value)) {
    return
  }
  reduxDevelopmentTools.send(action, { value, type, message }, type)
}

export function developmentToolsListener(name: string, type: StateType) {
  return (value: unknown) => {
    sendToDevelopmentTools(name, type, value)
  }
}
