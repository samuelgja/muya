'use client'
import Image from 'next/image'

import styles from './page.module.css'
import { useAppState } from './state'

export default function Home() {
  const appState = useAppState()
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Image className={styles.logo} src="/next.svg" alt="Next.js logo" width={180} height={38} priority />
        <b>{appState.greeting}</b>
        <button onClick={() => useAppState.updateState({ greeting: 'Hello, Next.js!' })}>Change</button>
      </main>
    </div>
  )
}
