import { create } from '../../../core/index'

async function GetState() {
  const result = await fetch('https://jsonplaceholder.typicode.com/todos/1')
  const json: { some: string } = await result.json()
  return {
    greeting: 'Hello, Muya!',
    counter: 0,
    ...json,
  }
}
export const useAppState = create(GetState())

export const derivedCounter = create(() => {
  const result = useAppState()
  return result.counter
})

export const derivedCounterFetch = create(async () => {
  const result = await fetch('https://jsonplaceholder.typicode.com/todos/1')
  const json = await result.json()
  return {
    ...json,
    userId: await derivedCounter(),
  }
})
