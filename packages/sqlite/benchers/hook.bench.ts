/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable no-console */
import { Bench } from 'tinybench'
import { act, renderHook, type RenderHookResult } from '@testing-library/react'
import { useSqliteValue } from '../src/use-sqlite'
import type { SyncTable, UseSqliteResult } from '../src/types'
import { makeSeededTable, type Person } from './shared'

type HookValue = UseSqliteResult<Person>

async function mountAndWait(sql: SyncTable<Person>, pageSize: number): Promise<RenderHookResult<HookValue, unknown>> {
  let handle!: RenderHookResult<HookValue, unknown>
  await act(async () => {
    handle = renderHook(() => useSqliteValue<Person>(sql, { pageSize }, []))
  })
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const length = handle.result.current.data?.length ?? 0
    if (length >= pageSize) break
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
  }
  return handle
}

interface FrameProbe {
  start: () => void
  stop: () => number
}

function frameProbe(): FrameProbe {
  let timer: ReturnType<typeof setInterval> | null = null
  let last = 0
  let longest = 0
  return {
    start() {
      longest = 0
      last = performance.now()
      timer = setInterval(() => {
        const now = performance.now()
        const gap = now - last
        if (gap > longest) longest = gap
        last = now
      }, 0)
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
      return longest
    },
  }
}

async function probeMount(sql: SyncTable<Person>, pageSize: number): Promise<{ ms: number; longestFrame: number }> {
  const probe = frameProbe()
  probe.start()
  const start = performance.now()
  const handle = await mountAndWait(sql, pageSize)
  const ms = performance.now() - start
  const longestFrame = probe.stop()
  await act(async () => {
    handle.unmount()
  })
  return { ms, longestFrame }
}

async function probePagination(
  sql: SyncTable<Person>,
  pageSize: number,
  totalItems: number,
): Promise<{ avgMs: number; longestPageMs: number; longestFrame: number }> {
  const handle = await mountAndWait(sql, pageSize)
  const probe = frameProbe()
  probe.start()
  const pageTimes: number[] = []
  const pages = Math.ceil(totalItems / pageSize) - 1
  for (let i = 0; i < pages; i++) {
    const t0 = performance.now()
    await act(async () => {
      await handle.result.current.fetchNextPage()
    })
    pageTimes.push(performance.now() - t0)
  }
  const longestFrame = probe.stop()
  await act(async () => {
    handle.unmount()
  })
  const avgMs = pageTimes.reduce((sum, t) => sum + t, 0) / Math.max(pageTimes.length, 1)
  const longestPageMs = pageTimes.reduce((max, t) => (t > max ? t : max), 0)
  return { avgMs, longestPageMs, longestFrame }
}

export async function runHookBench(): Promise<void> {
  console.log('\n=== hook: initial load (mount → first non-null) ===\n')
  for (const n of [100, 1000, 10_000]) {
    const sql = await makeSeededTable(n)
    const bench = new Bench({ time: 500, warmupTime: 100, warmupIterations: 1 })
    bench.add(`mount + load ${n}`, async () => {
      const handle = await mountAndWait(sql, n)
      await act(async () => {
        handle.unmount()
      })
    })
    await bench.run()
    const r = bench.tasks[0].result
    if (!r || (r.state !== 'completed' && r.state !== 'aborted-with-statistics')) continue
    const probe = await probeMount(await makeSeededTable(n), n)
    console.log(
      `  ${n.toString().padStart(6)} items: ` +
        `mean ${r.latency.mean.toFixed(2)}ms  p99 ${r.latency.p99.toFixed(2)}ms  ` +
        `longest sync frame ${probe.longestFrame.toFixed(2)}ms  (${r.latency.samplesCount} samples)`,
    )
  }

  console.log('\n=== hook: nextPage() walking 10k rows ===\n')
  for (const pageSize of [100, 500, 1000]) {
    const sql = await makeSeededTable(10_000)
    const r = await probePagination(sql, pageSize, 10_000)
    console.log(
      `  pageSize=${pageSize.toString().padStart(4)}: ` +
        `avg ${r.avgMs.toFixed(2)}ms/page  longest page ${r.longestPageMs.toFixed(2)}ms  ` +
        `longest sync frame ${r.longestFrame.toFixed(2)}ms`,
    )
  }
}
