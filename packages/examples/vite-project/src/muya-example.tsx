import { atomFamily } from 'jotai/utils'
import { atom, useAtom, useSetAtom } from 'jotai'
import React, { useState } from 'react'

// Define atoms for the counters
const counter1Atom = atom(0)
const counter2Atom = atom(0)

// Use `atomFamily` to create parameterized atoms
const derivedSumAtomFamily = atomFamily((multiplier: number) =>
  atom((get) => {
    const counter1 = get(counter1Atom)
    const counter2 = get(counter2Atom)
    return (counter1 + counter2) * multiplier
  }),
)

export default function App() {
  const [counter1, setCounter1] = useAtom(counter1Atom)
  const [counter2, setCounter2] = useAtom(counter2Atom)
  const [multiplier, setMultiplier] = useState(1)

  // Use the derived atom from the atomFamily with the multiplier
  const [derivedSum] = useAtom(derivedSumAtomFamily(multiplier))
  return (
    <main style={{ flexDirection: 'column', display: 'flex' }}>
      <button onClick={() => setCounter1((c) => c + 1)}>Increment counter 1 "value: {counter1}"</button>
      <button onClick={() => setCounter2((c) => c + 1)}>Increment counter 2 "value: {counter2}"</button>
      <button onClick={() => setMultiplier((m) => m + 1)}>Increment multiplier "value: {multiplier}"</button>
      Result of multiplier: {derivedSum}
    </main>
  )
}
