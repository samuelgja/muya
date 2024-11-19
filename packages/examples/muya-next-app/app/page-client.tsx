'use client'
import Image from 'next/image'
import styles from './page.module.css'

import { Suspense, useEffect } from 'react'
import { globalData } from './state'

export function PageClient() {
  console.log('re-render')
  useEffect(() => {
    console.log(globalData.call())
  })
  return <main className={styles.main}>Hello</main>
}
