# Muya

A tiny, type-safe state manager for React.

[![Build](https://github.com/samuelgja/muya/actions/workflows/build.yml/badge.svg)](https://github.com/samuelgja/muya/actions/workflows/build.yml)
[![Code Quality](https://github.com/samuelgja/muya/actions/workflows/code-check.yml/badge.svg)](https://github.com/samuelgja/muya/actions/workflows/code-check.yml)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/muya?label=size)](https://bundlephobia.com/result?p=muya)
[![npm](https://img.shields.io/npm/v/muya)](https://www.npmjs.com/package/muya)

---

## Why Muya?

| Feature        | useState + Context | Zustand | Jotai     | Muya            |
| -------------- | ------------------ | ------- | --------- | --------------- |
| Bundle size    | 0kb (built-in)     | ~2.9kb  | ~2.4kb    | **~1.5kb**      |
| Boilerplate    | High               | Low     | Low       | **Minimal**     |
| TypeScript     | Manual             | Good    | Good      | **First-class** |
| Async support  | Manual             | Manual  | Built-in  | **Built-in**    |
| Derived state  | Manual             | Manual  | Built-in  | **Built-in**    |
| React Suspense | No                 | No      | Yes       | **Yes**         |
| Batching       | React handles      | Manual  | Automatic | **Automatic**   |

---

## Installation

```bash
npm install muya
# or
bun add muya
# or
yarn add muya
```

---

## Quick Start

```tsx
import { create } from 'muya'

const counter = create(0)

function Counter() {
  const count = counter() // state is a hook
  return <button onClick={() => counter.set((n) => n + 1)}>Count: {count}</button>
}
```

That's it. No providers, no setup, no boilerplate.

---

## Comparison

### vs useState + useContext

**Before** (React Context):

```tsx
// 1. Create context
const CountContext = createContext(null)

// 2. Create provider component
function CountProvider({ children }) {
  const [count, setCount] = useState(0)
  return <CountContext.Provider value={{ count, setCount }}>{children}</CountContext.Provider>
}

// 3. Create custom hook
function useCount() {
  const context = useContext(CountContext)
  if (!context) throw new Error('Must be in provider')
  return context
}

// 4. Wrap your app
function App() {
  return (
    <CountProvider>
      <Counter />
    </CountProvider>
  )
}

// 5. Finally use it
function Counter() {
  const { count, setCount } = useCount()
  return <button onClick={() => setCount((n) => n + 1)}>{count}</button>
}
```

**After** (Muya):

```tsx
const counter = create(0)

function Counter() {
  const count = counter()
  return <button onClick={() => counter.set((n) => n + 1)}>{count}</button>
}
```

### vs Zustand

**Zustand**:

```tsx
import { create } from 'zustand'

const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}))

function Counter() {
  const count = useStore((state) => state.count)
  const increment = useStore((state) => state.increment)
  return <button onClick={increment}>{count}</button>
}
```

**Muya**:

```tsx
import { create } from 'muya'

const counter = create(0)

function Counter() {
  const count = counter()
  return <button onClick={() => counter.set((n) => n + 1)}>{count}</button>
}
```

---

## Core API

### `create(initial, isEqual?)`

Create a state. The state itself is a hook.

```tsx
// Simple value
const name = create('Ada')

// Object
const user = create({ id: 1, name: 'Ada', role: 'admin' })

// Lazy (computed on first read)
const expensive = create(() => computeExpensiveValue())

// Async
const data = create(fetch('/api/data').then((r) => r.json()))
const lazyData = create(() => fetch('/api/data').then((r) => r.json()))

// With equality check (skip updates when equal)
const position = create({ x: 0, y: 0 }, (prev, next) => prev.x === next.x && prev.y === next.y)
```

### State Methods

```tsx
const counter = create(0)

// Read (outside React)
counter.get() // 0

// Update
counter.set(5)
counter.set((prev) => prev + 1)

// Subscribe (outside React)
const unsubscribe = counter.listen((value) => console.log(value))

// Derive new state
const doubled = counter.select((n) => n * 2)

// Debug name (for DevTools)
counter.withName('counter')

// Cleanup
counter.destroy()
```

### `select([states], derive, isEqual?)`

Derive state from multiple sources.

```tsx
import { create, select } from 'muya'

const firstName = create('Ada')
const lastName = create('Lovelace')

const fullName = select([firstName, lastName], (first, last) => `${first} ${last}`)

function Greeting() {
  const name = fullName() // 'Ada Lovelace'
  return <h1>Hello, {name}</h1>
}
```

### `useValue(state, selector?)`

Hook for reading state with optional selector.

```tsx
import { create, useValue } from 'muya'

const user = create({ id: 1, name: 'Ada', role: 'admin' })

function UserName() {
  // Only re-renders when name changes
  const name = useValue(user, (u) => u.name)
  return <span>{name}</span>
}
```

### `useValueLoadable(state, selector?)`

Hook for async states without Suspense. Returns `[value, isLoading, isError, error]`.

```tsx
import { create, useValueLoadable } from 'muya'

const data = create(() => fetch('/api/data').then((r) => r.json()))

function DataView() {
  const [value, isLoading, isError, error] = useValueLoadable(data)

  if (isLoading) return <Spinner />
  if (isError) return <Error message={error.message} />
  return <Display data={value} />
}
```

---

## Async States

### Async Initialization

```tsx
// Promise (loads immediately)
const user = create(fetch('/api/user').then((r) => r.json()))

// Lazy async (loads on first read)
const user = create(() => fetch('/api/user').then((r) => r.json()))
```

### Async Updates

```tsx
const user = create(() => fetchUser())

// Override immediately (cancels pending)
user.set({ id: 1, name: 'New User' })

// Wait for current value, then update
user.set((prev) => ({ ...prev, name: 'Updated' }))
```

### Async Selectors

```tsx
const userId = create(1)

const userDetails = userId.select(async (id) => {
  const response = await fetch(`/api/users/${id}`)
  return response.json()
})

// Suspends on first read
function UserProfile() {
  const details = userDetails()
  return <Profile {...details} />
}
```

### With Suspense

```tsx
const data = create(() => fetchData())

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <DataView />
    </Suspense>
  )
}

function DataView() {
  const value = data() // suspends until resolved
  return <div>{value}</div>
}
```

### Without Suspense

```tsx
const data = create(() => fetchData())

function DataView() {
  const [value, isLoading, isError, error] = useValueLoadable(data)

  if (isLoading) return <Loading />
  if (isError) return <Error error={error} />
  return <div>{value}</div>
}
```

---

## Patterns

### Computed Values

```tsx
const items = create([
  { id: 1, name: 'Apple', price: 1.5, quantity: 2 },
  { id: 2, name: 'Banana', price: 0.5, quantity: 5 },
])

const total = items.select((list) => list.reduce((sum, item) => sum + item.price * item.quantity, 0))

const count = items.select((list) => list.length)
```

### Actions

```tsx
const cart = create({ items: [], discount: 0 })

const cartActions = {
  addItem: (item) =>
    cart.set((state) => ({
      ...state,
      items: [...state.items, item],
    })),

  applyDiscount: (percent) =>
    cart.set((state) => ({
      ...state,
      discount: percent,
    })),

  clear: () => cart.set({ items: [], discount: 0 }),
}

// Usage
cartActions.addItem({ id: 1, name: 'Book', price: 20 })
```

### Shallow Equality

```tsx
import { create, shallow } from 'muya'

const list = create(
  [1, 2, 3],
  shallow, // built-in shallow comparison
)

// Won't notify if array contents are the same
list.set([1, 2, 3])
```

### Batching

Multiple updates in the same event are batched automatically:

```tsx
function checkout() {
  cart.set((c) => applyDiscount(c))
  total.set((t) => t - 10)
  inventory.set((i) => decrementStock(i))
  // React sees one render
}
```

---

## DevTools

Muya auto-connects to Redux DevTools in development.

```tsx
const counter = create(0).withName('counter')
const user = create({ name: 'Ada' }).withName('user')
```

---

## SQLite Companion

For large, queryable lists with pagination. Works with expo-sqlite, better-sqlite3, or in-memory.

```tsx
import { createSqliteState, useSqliteValue } from 'muya/sqlite'

type Task = { id: string; title: string; done: boolean; priority: number }

const tasks = createSqliteState<Task>({
  backend,
  tableName: 'tasks',
  key: 'id',
  indexes: ['priority', 'done'],
})
```

### React Hook with Pagination

```tsx
function TaskList() {
  const [rows, actions] = useSqliteValue(tasks, { sortBy: 'priority', order: 'desc', limit: 20 }, [])

  return (
    <>
      {rows.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
      <button onClick={actions.next}>Load more</button>
      <button onClick={actions.reset}>Reset</button>
    </>
  )
}
```

### CRUD Operations

```tsx
// Create
await tasks.set({ id: '1', title: 'Buy milk', done: false, priority: 1 })

// Batch create
await tasks.batchSet([
  { id: '2', title: 'Walk dog', done: false, priority: 2 },
  { id: '3', title: 'Read book', done: true, priority: 3 },
])

// Read
const task = await tasks.get('1')
const title = await tasks.get('1', (t) => t.title)

// Update
await tasks.set({ id: '1', title: 'Buy milk', done: true, priority: 1 })

// Delete
await tasks.delete('1')

// Batch delete
await tasks.batchDelete(['2', '3'])

// Count
const total = await tasks.count()
const pending = await tasks.count({ where: { done: false } })
```

### Querying

```tsx
// Search with where clause
for await (const task of tasks.search({
  where: { done: false, priority: { gt: 1 } },
  orderBy: 'priority',
  order: 'desc',
})) {
  console.log(task.title)
}

```

**Where clause operators:**

| Operator | Example                         | Description            |
| -------- | ------------------------------- | ---------------------- |
| equals   | `{ done: false }`               | Exact match            |
| gt       | `{ priority: { gt: 5 } }`       | Greater than           |
| gte      | `{ priority: { gte: 5 } }`      | Greater than or equal  |
| lt       | `{ priority: { lt: 5 } }`       | Less than              |
| lte      | `{ priority: { lte: 5 } }`      | Less than or equal     |
| like     | `{ title: { like: '%milk%' } }` | SQL LIKE pattern match |

---

## TypeScript

Full type inference out of the box:

```tsx
const user = create({ id: 1, name: 'Ada', role: 'admin' as const })
// Type: State<{ id: number; name: string; role: 'admin' }>

const role = user.select((u) => u.role)
// Type: State<'admin'>

const name = useValue(user, (u) => u.name)
// Type: string
```

---

## FAQ

**Is Muya a replacement for Redux/Zustand/Jotai?**
Muya is intentionally minimal. If you need middleware, devtools plugins, or large ecosystem, consider those alternatives.

**How do I avoid re-renders?**
Use `isEqual` function with `create`/`select`, or use a selector with `useValue` to subscribe to a slice.

**Can I use Suspense?**
Yes. Async states suspend on first read. Use `useValueLoadable` if you prefer loading states over Suspense.

**Does it work with React Native?**
Yes, Muya has no DOM dependencies.

---

## License

MIT
