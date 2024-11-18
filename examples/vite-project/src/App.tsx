import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { create, useCreate } from '../../src'

const userState = create({ userName: 'John', age: 25 })
const ageState = create(() => userState((data) => data.age))
const userName = create(() => userState((data) => data.userName))

function App() {
  const username = useCreate(userName)
  const age = useCreate(ageState)
  // const full = useCreate(userState)
  console.log({ age })
  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Username: {username}</h1>
      <button onClick={() => userState.set((prev) => ({ ...prev, userName: 'Jane' }))}>Change name</button>
      <div className="card">
        <button onClick={() => userState.set((prev) => ({ ...prev, age: prev.age + 1 }))}>age is: {age}</button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">Click on the Vite and React logos to learn more</p>
    </>
  )
}

export default App
