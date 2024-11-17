'use client'
import Image from 'next/image'

import styles from './page.module.css'
import { useAppState } from './state'

useAppState.subscribe((value) => {
  console.log('State subscribe from the client', value)
})
export function PageClient() {
  const appState = useAppState()
  return (
    <main className={styles.main}>
      <Image className={styles.logo} src="/next.svg" alt="Next.js logo" width={180} height={38} priority />
      <b>{appState.greeting}</b>
      <button onClick={() => useAppState.updateState({ greeting: 'Hello, Next.js!' })}>Change</button>
    </main>
  )
}
