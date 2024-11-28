import { Suspense } from 'react'
import { create, select } from '../../../core'
const longPromise = (ms: number): Promise<number> => new Promise((resolve) => setTimeout(() => resolve(ms), ms))
// Define atoms for the three states
const state1Atom = create(0)
const state2Atom = create(0)
const state3Atom = create(longPromise(1000))

export default function App() {
  console.log('App render')
  return (
    <main style={{ flexDirection: 'column', display: 'flex' }}>
      <button onClick={() => state1Atom.set((c) => c + 1)}>Increment counter 1"</button>
      <button onClick={() => state1Atom.set((c) => c + 1)}>Increment counter 2"</button>
      <button onClick={() => state3Atom.set((m) => m + 1)}>Increment counter 3"</button>
      <button
        onClick={() => {
          state1Atom.set((c) => c + 1)
          state2Atom.set((c) => c + 1)
          state3Atom.set((m) => m + 1)
        }}
      >
        Increment All"
      </button>
      <Suspense fallback="loading">
        <ComponentChild1 />
      </Suspense>
      <Suspense fallback="loading">
        <ComponentChildAsync />
      </Suspense>
      <Suspense fallback="loading">
        <ComponentChildAsyncBackSync />
      </Suspense>
    </main>
  )
}

const sumState = select([state1Atom, state2Atom, state3Atom], (a, b, c) => {
  console.log({ a, b, c })
  return a + b + c
})

function ComponentChild1() {
  console.log('ComponentChild1 render')
  // Use the state atom in the child component
  const state1 = sumState()
  return <div>Sum of states: {state1}</div>
}

const sumStateAsync = select([state1Atom, state2Atom, state3Atom], async (a, b, c) => a + b + c)

function ComponentChildAsync() {
  // this component will re-render each time twice, once for the suspense, second for the actual value
  console.log('ComponentChildAsync render')
  // Use the state atom in the child component
  const state1 = sumStateAsync()
  return <div>Sum of states: {state1}</div>
}

const sumStateAsyncBackSync = select([sumStateAsync], (a) => a)

function ComponentChildAsyncBackSync() {
  // this component will re-render each time twice, once for the suspense, second for the actual value
  console.log('ComponentChildAsyncBackSync render')
  // Use the state atom in the child component
  const state1 = sumStateAsyncBackSync()
  return <div>Sum of states: {state1}</div>
}
