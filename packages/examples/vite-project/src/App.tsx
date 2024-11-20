// // import './App.css'
// // import { use, create } from '../../../core'
// // import { Suspense } from 'react'
// // import { context } from '../../../core/subscriber'

// // const userState = create({ name: 'John', age: 30 })

// // export async function getDataWithUser(customParameter: string) {
// //   const result = await fetch('https://jsonplaceholder.typicode.com/todos/1')
// //   const json = await result.json()
// //   return { ...json, age: userState().age, customParameter }
// // }

// // export async function getDataWithUser2() {
// //   const result = await fetch('https://jsonplaceholder.typicode.com/todos/1')
// //   const json = await result.json()
// //   return { ...json, age: userState().age, other: getDataWithUser('value') }
// // }

// // function App() {
// //   console.log('re-render App')

// //   return (
// //     <Suspense fallback={'Loading...'}>
// //       <div className="App">
// //         <button onClick={() => userState.set((prev) => ({ ...prev, age: prev.age + 1 }))}>Increment Age</button>
// //         <PageClient />

// //         <FetchClient />
// //       </div>
// //     </Suspense>
// //   )
// // }

// // export function PageClient() {
// //   console.log('re-render PageClient')
// //   const user = use(getDataWithUser2)
// //   const beforeUser = use(getDataWithUser)
// //   return <main>{JSON.stringify(user)}</main>
// // }

// // export function FetchClient() {
// //   // const data = use(derivedCounterFetch)
// //   console.log('re-render FetchClient')
// //   return <main>{JSON.stringify(2)}</main>
// // }

// // export default App

// import './App.css'
// import { atom, useAtom, useSetAtom } from 'jotai'
// import { Suspense } from 'react'
// import { atomFamily } from 'jotai/utils'

// const userState = atom({ name: 'John', age: 30 })

// const getDataWithUserAtom = atomFamily((customParameter) =>
//   atom(async (get) => {
//     const user = get(userState)
//     const response = await fetch('https://jsonplaceholder.typicode.com/todos/1')
//     const json = await response.json()
//     return { ...json, age: user.age, customParameter }
//   }),
// )

// const getDataWithUser2Atom = atom(async (get) => {
//   const user = get(userState)
//   const response = await fetch('https://jsonplaceholder.typicode.com/todos/1')
//   const json = await response.json()
//   const other = await get(getDataWithUserAtom('value'))
//   return { ...json, age: user.age, other }
// })

// function App() {
//   console.log('re-render App')
//   const setUserState = useSetAtom(userState)

//   return (
//     <Suspense fallback={'Loading...'}>
//       <div className="App">
//         <button onClick={() => setUserState((prev) => ({ ...prev, age: prev.age + 1 }))}>Increment Age</button>
//         <PageClient />
//         <FetchClient />
//       </div>
//     </Suspense>
//   )
// }

// function PageClient() {
//   console.log('re-render PageClient')
//   const [user] = useAtom(getDataWithUser2Atom)
//   const [beforeUser] = useAtom(getDataWithUserAtom(''))
//   return <main>{JSON.stringify(user)}</main>
// }

// function FetchClient() {
//   console.log('re-render FetchClient')
//   return <main>{JSON.stringify(2)}</main>
// }

// export default App

import { Suspense, useCallback, useState } from 'react'
import { create, use } from '../../../core'
// Define state for the counters
const counter1Atom = create(0)
const counter2Atom = create(0)

function derivedSumAtomFamily(multiplier: number) {
  return counter1Atom() + counter2Atom() * multiplier
}

// Define atoms for the three states
const state1Atom = create(0)
const state2Atom = create(0)
const state3Atom = create(0)
// Use just a function
function sum() {
  return state1Atom() + state2Atom() + state3Atom()
}

function multiply() {
  return sum() * 1
}

function isOdd() {
  console.log('CALL')
  return multiply() % 2 === 1
}

export default function App() {
  const isOddValue = use(isOdd)
  return (
    <main style={{ flexDirection: 'column', display: 'flex' }}>
      <button onClick={() => state1Atom.set((c) => c + 1)}>Increment counter 1"</button>
      <button onClick={() => state1Atom.set((c) => c + 1)}>Increment counter 2"</button>
      <button onClick={() => state3Atom.set((m) => m + 1)}>Increment counter 3"</button>
      Is ODD: {isOddValue ? 'Yes' : 'No'}
      <Suspense fallback={'Loading...'}>
        <Component />
      </Suspense>
    </main>
  )
}

const counter = create(1)

async function fetchData() {
  const response = await fetch(`https://jsonplaceholder.typicode.com/todos/${counter()}`)
  return response.json()
}

function Component() {
  const data = use(fetchData)

  return (
    <div>
      <button onClick={() => counter.set((prev) => prev + 1)}>Increment</button>
      <p>{JSON.stringify(data)}</p>
    </div>
  )
}
