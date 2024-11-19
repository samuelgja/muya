import styles from './page.module.css'

import { PageClient } from './page-client'

export default function Home() {
  return (
    <div className={styles.page}>
      <PageClient />
    </div>
  )
}
