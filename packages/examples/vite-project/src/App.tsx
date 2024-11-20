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

import { useCallback, useState } from 'react'
import { create, use } from '../../../core'
// Define state for the counters
const counter1Atom = create(0)
const counter2Atom = create(0)

function derivedSumAtomFamily(multiplier: number) {
  return counter1Atom() + counter2Atom() * multiplier
}

export default function App() {
  const counter1 = use(counter1Atom)
  const counter2 = use(counter2Atom)

  const [multiplier, setMultiplier] = useState(0)
  const multiply = useCallback(() => derivedSumAtomFamily(multiplier), [multiplier])

  const derivedSum = use(multiply)

  return (
    <main style={{ flexDirection: 'column', display: 'flex' }}>
      <button onClick={() => counter1Atom.set((c) => c + 1)}>Increment counter 1 "value: {counter1}"</button>
      <button onClick={() => counter2Atom.set((c) => c + 1)}>Increment counter 2 "value: {counter2}"</button>
      <button onClick={() => setMultiplier((m) => m + 1)}>Increment multiplier "value: {multiplier}"</button>
      Result of multiplier: {derivedSum}
    </main>
  )
}
