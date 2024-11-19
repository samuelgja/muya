'use client'
import Image from 'next/image'
import styles from './page.module.css'
import { derivedCounter, derivedCounterFetch, useAppState } from './state'
import { use } from '../../../src'
import { Suspense } from 'react'

useAppState.subscribe((value) => {
  console.log('State subscribe from the client', value)
})
export function PageClient() {
  const appState = use(useAppState)
  const counter = use(derivedCounter)
  console.log('re-render')
  return (
    <main className={styles.main}>
      <Image className={styles.logo} src="/next.svg" alt="Next.js logo" width={180} height={38} priority />
      <b>{appState.greeting}</b>
      <button onClick={() => useAppState.set({ greeting: 'Hello, Next.js!', counter: 0 })}>Change</button>
      <p>Counter: {counter}</p>
      <button onClick={() => useAppState.set((prev) => ({ ...prev, counter: prev.counter + 1 }))}>Increment</button>
      <Suspense fallback={'Loading...'}>
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
  return <main className={styles.main}>{JSON.stringify(data)}</main>
}
