import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { derivedCounter, derivedCounterFetch, useAppState } from './state'
import { use } from '../../../core'
import { Suspense } from 'react'
function App() {
  // const username = useIt(userState)
  const age = use(useAppState)
  // const full = useCreate(userState)

  console.log('RENDER', performance.now())
  return (
    <Suspense fallback={'Loading...'}>
      <div className="App">
        <PageClient />

        <FetchClient />
      </div>
    </Suspense>
  )
}

useAppState.subscribe((value) => {
  console.log('State subscribe from the client', value)
})
export function PageClient() {
  const appState = use(useAppState)
  const counter = use(derivedCounter)
  console.log('re-render')
  return (
    <main>
      <b>{appState.greeting}</b>
      <button onClick={() => useAppState.set({ greeting: 'Hello, Next.js!', counter: 0 })}>Change</button>
      <p>Counter: {counter}</p>
      <button onClick={() => useAppState.set((prev) => ({ ...prev, counter: prev.counter + 1 }))}>Increment</button>
      <Suspense fallback={'Fetch loading...'}>
        <div style={{ maxWidth: 100 }}>
          <FetchClient />
        </div>
      </Suspense>
    </main>
  )
}

export function FetchClient() {
  const data = use(derivedCounterFetch)
  console.log('re-render FetchClient')
  return <main>{JSON.stringify(data)}</main>
}

export default App
