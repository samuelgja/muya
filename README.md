# **Muya 🌀**

*A tiny, type-safe state manager for React with a dead-simple mental model:*
- **Create a state**
- **Read it in components**
- **Update it**
- **Derive more states when you need to**

---

[![Build](https://github.com/samuelgja/muya/actions/workflows/build.yml/badge.svg)](https://github.com/samuelgja/muya/actions/workflows/build.yml)
[![Code Quality](https://github.com/samuelgja/muya/actions/workflows/code-check.yml/badge.svg)](https://github.com/samuelgja/muya/actions/workflows/code-check.yml)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/muya?label=Bundle%20size)](https://bundlephobia.com/result?p=muya)

## ✨ Highlights
- **2-call API**: `create` and `select` (plus a tiny hook `useValue`)
- **React-friendly**: internal batching; opt-in equality checks to skip renders
- **Type-first**: full TypeScript support
- **Lightweight**: built for small mental & bundle footprint

---

## 📦 Install
```bash
bun add muya@latest
# or
npm i muya@latest
# or
yarn add muya@latest
```

---

## 🏃 Quick Start

```tsx
import { create } from 'muya'

// 1) Make a state
const counter = create(0)

// 2) Read it inside React
export function Counter() {
  const count = counter() // state is a hook
  return (
    <div>
      <button onClick={() => counter.set(n => n + 1)}>+1</button>
      <p>Count: {count}</p>
    </div>
  )
}
```

---

## 🧩 Selecting / Deriving

Create derived states from one or many sources.

```ts
import { create, select } from 'muya'

const a = create(1)
const b = create(2)

// Single source
const doubleA = a.select(n => n * 2)

// Multiple sources
const sum = select([a, b], (x, y) => x + y)
```

**Equality checks** (to avoid re-emits):

```ts
const obj = create({ a: 1, b: 2 }, (prev, next) => prev.b === next.b)
obj.set(p => ({ ...p, a: p.a + 1 })) // does not notify (b unchanged)
```

You can also add an equality function on a `select`:

```ts
const stable = select([a, b], (x, y) => x + y, (prev, next) => prev === next)
```

---

## 🎣 Using in Components

Muya states are callable hooks. Prefer that.  
If you want a hook wrapper or slicing, use `useValue`.

```tsx
import { create, useValue } from 'muya'

const user = create({ id: 'u1', name: 'Ada', admin: false })

// Option 1: call the state directly
function Profile() {
  const u = user()
  return <div>{u.name}</div>
}

// Option 2: useValue for a selector
function OnlyName() {
  const name = useValue(user, u => u.name)
  return <div>{name}</div>
}
```

---

## ⚡ Async & Lazy (the 2-minute mental model)

**Immediate vs Lazy**
```ts
create(0)          // immediate: value exists now
create(() => 0)    // lazy: computed on first read (.get() / component render)
```

**Async sources**
```ts
async function fetchInitial() { return 0 }
create(fetchInitial)          // lazy + async
create(Promise.resolve(0))    // immediate + async
```

**Setting with async state**
- `state.set(2)` **overrides immediately** (cancels previous pending promise)
- `state.set(prev => prev + 1)` **waits for the current promise to resolve** so `prev` is always the resolved value

**Async selectors**
```ts
const base = create(0)
const plusOne = base.select(async n => {
  await doWork()
  return n + 1
})
```
- Async selects **suspend** the first time (and when their upstream async value requires it)
- A sync selector reading an async parent will **suspend once** on initial load

> Tip: Prefer keeping selectors **sync** and performing async work **before** calling `set`. It keeps render trees predictable.

---

## 🧪 API (short and sweet)

### `create<T>(initial, isEqual?) => State<T>`
**State methods**
- `get(): T` — read current value (resolves lazy/async when needed)
- `set(value | (prev) => next)` — update value (batched)
- `listen(fn)` — subscribe, returns `unsubscribe`
- `select(selector, isEqual?)` — derive new state from this state
- `destroy()` — clear listeners and dispose
- `withName(name)` — add a debug label (DevTools)

### `select([states], derive, isEqual?) => State<R>`
Derive a state from one or multiple states.

### `useValue(state, selector?)`
React hook to read a state or a slice.

---

## 🪵 DevTools
In **dev**, Muya auto-connects to Redux DevTools if present and reports state updates by name.  
Use `state.withName('CartItems')` to make timelines readable.

---

## 🤝 Patterns & Anti-patterns

**✅ Good**
- Keep selectors pure and fast
- Use equality checks to avoid unnecessary updates
- Do async outside, then `set` synchronously

**⚠️ Be cautious**
- Deep async chains of selectors → harder to debug and may re-suspend often
- Long-running async work inside selectors → push it out of render path

---

## 🧭 Examples

**Boolean flags derived from async state (suspends only once):**
```tsx
const user = create(fetchUser) // async lazy
const isAdmin = user.select(u => u.role === 'admin')
// First mount suspends while user loads, subsequent updates are instant
```

**Batching inside events:**
```ts
function onCheckout() {
  cart.set(c => applyDiscount(c))
  total.set(t => t - 10)
  // Muya batches internally; React sees one commit
}
```

---

## 🗃️ (Optional) Muya + SQLite Companion

If you’re using the companion `muya/sqlite` package, you can manage large, queryable lists with React-friendly pagination:

```ts
import { createSqliteState } from 'muya/sqlite'
import { useSqliteValue } from 'muya/sqlite'

type Person = { id: string; name: string; age: number }

const people = createSqliteState<Person>({
  backend,            // e.g. expo-sqlite / bunMemoryBackend
  tableName: 'People',
  key: 'id',
  indexes: ['age'],   // optional
})

// In React: stepwise fetching + where/order/limit
function PeopleList() {
  const [rows, actions] = useSqliteValue(people, { sorBy: 'age', order: 'asc', limit: 50 }, [])
  return (
    <>
      <ul>{rows.map(p => <li key={p.id}>{p.name}</li>)}</ul>
      <button onClick={() => actions.next()}>Load more</button>
      <button onClick={() => actions.reset()}>Reset</button>
    </>
  )
}
```

**Quick ops**
```ts
await people.batchSet([{ id:'1', name:'Alice', age:30 }])
await people.set({ id:'2', name:'Bob', age:25 })
await people.delete('1')
const alice = await people.get('2', p => p.name)  // 'Bob'
const count = await people.count({ where: { age: { gt: 20 } } })
for await (const p of people.search({ where: { name: { like: '%Ali%' }}})) { /* … */ }
```

---

## ❓ FAQ

**Is Muya a replacement for Redux/Zustand/Jotai?**  
No—Muya is intentionally tiny. If you need complex middleware, effects, or ecosystem plugins, those tools are great choices.

**Can I use Suspense?**  
Yes. Async states/selectors will suspend on first read (and when upstream requires it).

**How do I avoid re-renders?**  
Provide an `isEqual(prev, next)` to `create` or `select`, or select a smaller slice in `useValue`.

---

## 🧪 Testing Tips
- State reads/writes are synchronous, but **async sources/selectors** resolve over time. In tests, use `await waitFor(...)` around expectations that depend on async resolution.

---

## 📜 License
MIT — if you like Muya, a ⭐️ is always appreciated!

---

### Changelog / Contributing
See repo issues and PRs. Keep changes small and measured—Muya’s value is simplicity.
