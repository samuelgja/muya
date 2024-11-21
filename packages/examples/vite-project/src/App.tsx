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

// import { composeWithDevTools } from 'redux-devtools-extension'
// const devTools = composeWithDevTools({
//   name: 'MyStateLibrary',
//   trace: true,
// })

import { Suspense } from 'react'
import { create, use } from '../../../core'

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
  console.log('RENDER', isOddValue)
  return (
    <main style={{ flexDirection: 'column', display: 'flex' }}>
      <button onClick={() => state1Atom.set((c) => c + 1)}>Increment counter 1"</button>
      <button onClick={() => state1Atom.set((c) => c + 1)}>Increment counter 2"</button>
      <button onClick={() => state3Atom.set((m) => m + 1)}>Increment counter 3"</button>
      <div> Is ODD: {isOddValue ? 'Yes' : 'No'}</div>
      <Suspense fallback={'Loading...'}>
        <ComponentFetchData />
      </Suspense>
      <Suspense fallback={'Loading...'}>
        <ComponentFetchParent />
      </Suspense>
    </main>
  )
}

const longWait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const counter = create(1)
async function fetchDataParent() {
  isOdd()
  const response = await fetch(`https://jsonplaceholder.typicode.com/todos/${counter()}`)
  return response.json()
}

async function fetchData() {
  await longWait(1000)
  await fetchDataParent()
  const response = await fetch(`https://jsonplaceholder.typicode.com/todos/${counter()}`)
  return response.json()
}

function ComponentFetchParent() {
  console.log('RENDER ASYNC')
  const data = use(fetchDataParent)
  console.log('RENDER ASYNC', data)

  return (
    <div>
      <button onClick={() => counter.set((prev) => prev + 1)}>Increment</button>
      <p>{JSON.stringify(data)}</p>
    </div>
  )
}
function ComponentFetchData() {
  console.log('RENDER ASYNC')
  const data = use(fetchData)
  console.log('RENDER ASYNC', data)

  return (
    <div>
      <button onClick={() => counter.set((prev) => prev + 1)}>Increment</button>
      <p>{JSON.stringify(data)}</p>
    </div>
  )
}
