import { create, select } from '../../../core'

// Define atoms for the three states
const state1Atom = create(0)
const state2Atom = create(0)
const state3Atom = create(0)

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
        }}>
        Increment All"
      </button>
      <ComponentChild1 />
    </main>
  )
}

const sumState = select([state1Atom, state2Atom, state3Atom], (a, b, c) => a + b + c)

function ComponentChild1() {
  console.log('ComponentChild1 render')
  // Use the state atom in the child component
  const state1 = sumState()
  return <div>Sum of states: {state1}</div>
}
