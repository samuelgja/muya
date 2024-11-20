import './App.css'
import { derivedCounter, derivedCounterFetch, useAppState } from './state'
import { use } from '../../../core'
import { Suspense, useEffect, useLayoutEffect } from 'react'
import { create as zustand } from 'zustand'
import { AsyncLocalStorage } from 'async_hooks'
const zzz = zustand(async () => ({ username: 'test', somethingElse: Promise.resolve('test') }))

function App() {
  console.log(AsyncLocalStorage)
  return (
    <Suspense fallback={'Loading...'}>
      <div className="App">
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
  const data = use(derivedCounterFetch)
  console.log('re-render FetchClient')
  return <main>{JSON.stringify(data)}</main>
}

export default App
