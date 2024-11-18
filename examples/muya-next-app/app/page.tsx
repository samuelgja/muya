import styles from './page.module.css'
import { useAppState } from './state'
import { PageClient } from './page-client'

console.log('State subscribe from the server')
export default function Home() {
  const appState = useAppState.get()
  return (
    <div className={styles.page}>
      {`${appState.greeting} From the server`}
      <PageClient />
    </div>
  )
}
