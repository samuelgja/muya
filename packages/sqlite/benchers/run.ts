/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable no-console */
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Silence React's "not wrapped in act" advisory — irrelevant for benchmarking.
const originalError = console.error
console.error = (...args: unknown[]) => {
  const first = args[0]
  if (typeof first === 'string' && first.includes('not wrapped in act')) return
  originalError(...args)
}

const { runIteratorBench } = await import('./iterator.bench')
const { runHookBench } = await import('./hook.bench')

console.log(`muya-sqlite benchmarks  (runtime: bun ${process.versions.bun ?? '?'})`)
console.log(`Date: ${new Date().toISOString()}`)

await runIteratorBench()
await runHookBench()

console.log('\nDone.')
