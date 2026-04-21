/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable no-console */
import { Bench } from 'tinybench'
import { makeSeededTable, type Person } from './shared'

const SIZES = [100, 1000, 10_000]

export async function runIteratorBench(): Promise<void> {
  console.log('\n=== iterator (drain N rows via state.search) ===\n')
  for (const n of SIZES) {
    const sql = await makeSeededTable(n)
    const bench = new Bench({ time: 500, warmupTime: 100 })

    bench.add(`drain ${n} rows`, async () => {
      let count = 0
      for await (const item of sql.search<Person>({ pageSize: n })) {
        if (item) count++
      }
      if (count !== n) throw new Error(`expected ${n}, got ${count}`)
    })

    await bench.run()
    const r = bench.tasks[0].result
    if (!r || (r.state !== 'completed' && r.state !== 'aborted-with-statistics')) continue
    console.log(
      `  drain ${n.toString().padStart(6)}: ` +
        `mean ${r.latency.mean.toFixed(2)}ms  p99 ${r.latency.p99.toFixed(2)}ms  ` +
        `(${r.latency.samplesCount} samples)`,
    )
  }
}
