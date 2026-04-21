# muya-sqlite

A tiny SQLite companion for [muya](https://github.com/samuelgjabel/muya) — reactive, paginated, type-safe queries over a SQLite table that stays in sync as data changes.

- **Push-driven**: subscribes to mutations on the underlying table; views update automatically when anyone calls `set`/`delete`/`batchSet`.
- **TanStack-style hook return**: `data`, `status`, `isLoading`, `isFetching`, `isStale`, `isError`, `error`, `hasNextPage`, `fetchNextPage`, `refetch`.
- **React 19 native**: built on `useSyncExternalStore`, concurrent-safe, no `QueryClientProvider` required.
- **Zero peer dep weight**: only `muya` and `react`.

## Install

```bash
bun add muya muya-sqlite
# or
npm i muya muya-sqlite
```

Peer deps: `muya >= 2.5.8`, `react >= 18 < 20`.

## Quickstart

```tsx
import { createSqliteState, useSqliteValue } from 'muya-sqlite'
import { bunMemoryBackend } from 'muya-sqlite/dist/esm/table/bun-backend'

interface Person {
  id: string
  name: string
  age: number
}

const people = createSqliteState<Person>({
  backend: bunMemoryBackend(),
  tableName: 'people',
  key: 'id',
  indexes: ['age'],
})

await people.batchSet([
  { id: '1', name: 'Alice', age: 30 },
  { id: '2', name: 'Bob', age: 25 },
])

function PeopleList() {
  const { data, status, hasNextPage, fetchNextPage } = useSqliteValue(people, {
    sortBy: 'age',
    pageSize: 50,
  })

  if (status === 'pending') return <p>Loading…</p>
  if (status === 'error') return <p>Failed to load</p>

  return (
    <>
      <ul>
        {data?.map((p) => (
          <li key={p.id}>{p.name} ({p.age})</li>
        ))}
      </ul>
      {hasNextPage && <button onClick={() => fetchNextPage()}>Load more</button>}
    </>
  )
}
```

When another part of the app calls `people.set({...})` or `people.delete(...)`, the rendered list updates automatically.

## API

### `createSqliteState<Document>(options)`

Returns a `SyncTable<Document>` — a reactive wrapper over the underlying SQLite table.

| Option | Type | Notes |
|---|---|---|
| `backend` | `Backend \| Promise<Backend>` | SQLite backend (e.g. `bunMemoryBackend()`, `expoBackend(db)`). |
| `tableName` | `string` | Required. SQL table name. |
| `key` | `keyof Document \| string` | Path to the primary key (supports dot-paths e.g. `'person.id'`). |
| `indexes` | `Array<keyof Document \| string>` | Optional. Fields to index. |
| `disablePragmaOptimization` | `boolean` | Optional escape hatch. |

Returned `SyncTable<Document>` has:

```ts
subscribe(listener)            // listen for mutations
set(doc)                       // upsert
batchSet(docs[])               // upsert many
delete(key)                    // delete one
batchDelete(keys[])            // delete many
deleteBy(where)                // delete matching
clear()                        // remove all
get(key, selector?)            // fetch one
search(options)                // async iterator over the result set
count(options?)                // count matching rows
groupBy(field, options?)       // group + aggregate
```

### `useSqliteValue<Document, Selected = Document>(state, options?, deps?)`

The reactive hook. Reads from the table, subscribes to mutations, paginates lazily.

```ts
const result = useSqliteValue(state, options, deps)
```

**Options** (all optional):

| Field | Type | Notes |
|---|---|---|
| `where` | `Where<Document>` | Filter clause (e.g. `{ age: { gt: 25 } }`). |
| `sortBy` | `keyof Document \| string` | Sort key. |
| `order` | `'asc' \| 'desc'` | Sort direction. Default `'asc'`. |
| `limit` | `number` | Max total rows. |
| `pageSize` | `number` | Rows per `fetchNextPage`. Default 100. |
| `select` | `(doc: Document) => Selected` | Projection. Hook will only re-render when the projected value changes (shallow). |

**`deps`** is a React-style dependency array. Changing any element re-runs the query from scratch.

**Returns** `UseSqliteResult<Selected | Document>`:

| Field | Type | Meaning |
|---|---|---|
| `data` | `readonly T[] \| null` | The current rows. `null` until first load completes. |
| `status` | `'pending' \| 'success' \| 'error'` | Query status. |
| `isLoading` | `boolean` | True only on initial load (`status === 'pending'` AND `data === null`). |
| `isFetching` | `boolean` | True during any in-flight fetch (initial, `fetchNextPage`, `refetch`). |
| `isStale` | `boolean` | True when `deps` changed but the new query hasn't finished yet. Useful for dimming the UI. |
| `isError` | `boolean` | Sugar for `status === 'error'`. |
| `error` | `Error \| null` | The thrown error if any. |
| `hasNextPage` | `boolean` | False once the iterator is exhausted (lookahead-accurate — no extra empty fetch needed). |
| `fetchNextPage` | `() => Promise<void>` | Pull and append the next page. Concurrent calls serialize into a queue. |
| `refetch` | `() => Promise<void>` | Discard current results and re-run from scratch. |

### `useSqliteCount<Document>(state, options?, deps?)`

Reactive row count. Returns `number`.

```ts
const total = useSqliteCount(people, { where: { age: { gte: 18 } } }, [])
```

## Recipes

### Filter from input — keep the UI responsive

Wrap the consumer's `setState` in `startTransition` so React keeps input snappy while the query reruns:

```tsx
import { useState, useTransition } from 'react'

function SearchablePeople() {
  const [filter, setFilter] = useState('')
  const [, startTransition] = useTransition()

  const { data, isStale } = useSqliteValue(
    people,
    { where: { name: { like: `%${filter}%` } } },
    [filter],
  )

  return (
    <>
      <input
        onChange={(e) => startTransition(() => setFilter(e.target.value))}
      />
      <ul style={{ opacity: isStale ? 0.5 : 1 }}>
        {data?.map((p) => <li key={p.id}>{p.name}</li>)}
      </ul>
    </>
  )
}
```

### Pagination with a transition

```tsx
function Page() {
  const [, startTransition] = useTransition()
  const result = useSqliteValue(people, { pageSize: 50 })

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await result.fetchNextPage()
        })
      }
      disabled={!result.hasNextPage}
    >
      Load more
    </button>
  )
}
```

### Project to a slice

```tsx
const { data: names } = useSqliteValue(
  people,
  { select: (p) => p.name },
  [],
)
// names: readonly string[] | null
```

The hook only re-renders when the projected value differs (shallow comparison) — updates to other fields are silently ignored.

### Listen for errors

```tsx
const { isError, error, refetch } = useSqliteValue(people)

if (isError) {
  return (
    <div>
      <p>Failed: {error?.message}</p>
      <button onClick={() => refetch()}>Retry</button>
    </div>
  )
}
```

## Performance notes

- For lists with **more than ~1k visible rows**, virtualize the renderer (e.g. `@tanstack/react-virtual`). The hook itself loads chunks lazily, but rendering N row components is the consumer's cost.
- For very large `pageSize` (>256), the iterator yields to the macro-task queue every 256 rows so the browser can paint and process input mid-load. Below 256 there is zero overhead.
- Inserts that change the visible window currently re-pull pages 1..N to maintain sort order. For heavy-write workloads, prefer smaller `pageSize`.

## Why not TanStack Query?

`useInfiniteQuery` is pull/cache-driven (query → cache → maybe revalidate). `muya-sqlite` is push-driven — every mutation streams to subscribers as it happens, so the table itself is the truth. Trying to wrap `useInfiniteQuery` here would mean either a forced `QueryClientProvider` peer dep or hand-bridging mutations into a foreign cache. Same return shape, none of the weight. If you genuinely want both, build a thin adapter.

## Why not `useTransition` inside the hook?

`useTransition` is a *consumer* concern — "this state change of mine is non-urgent." A library that publishes via `useSyncExternalStore` doesn't own a setter that would benefit from being marked non-urgent; it just notifies React when the store changes. Put the transition where the urgency decision lives: the consumer's `setState`. Our async actions (`refetch`, `fetchNextPage`) return `Promise<void>` so React 19's async transitions track them automatically.

## License

MIT
