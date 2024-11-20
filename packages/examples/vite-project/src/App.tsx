import './App.css'
import { use, create } from '../../../core'
import { Suspense, useEffect, useId, useRef } from 'react'

const userState = create({ name: 'John', age: 30 })

export async function getDataWithUser() {
  const result = await fetch('https://jsonplaceholder.typicode.com/todos/1')
  const json = await result.json()
  return { ...json, age: userState().age }
}

function App() {
  console.log('re-render App')
  // const user = use(getDataWithUser)
  return (
    <Suspense fallback={'Loading...'}>
      <div className="App">
        {/* {JSON.stringify(user)} */}
        <button onClick={() => userState.set((prev) => ({ ...prev, age: prev.age + 1 }))}>Increment Age</button>
        <PageClient />

        <FetchClient />
      </div>
    </Suspense>
  )
}

// useAppState.subscribe((value) => {
//   console.log('State subscribe from the client', value)
// })
export function PageClient() {
  return (
    <main>
      {/* <b>{appState.greeting}</b> */}
      {/* <button onClick={() => useAppState.set({ greeting: 'Hello, Next.js!', counter: 0 })}>Change</button>
      <p>Counter: {counter}</p>
      <button onClick={() => useAppState.set((prev) => ({ ...prev, counter: prev.counter + 1 }))}>Increment</button> */}
    </main>
  )
}

export function FetchClient() {
  // const data = use(derivedCounterFetch)
  console.log('re-render FetchClient')
  return <main>{JSON.stringify(2)}</main>
}

export default App
