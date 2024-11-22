
# **Muya 🌀**

Muya is simple and lightweight react state management library.

---

[![Build](https://github.com/samuelgja/muya/actions/workflows/build.yml/badge.svg)](https://github.com/samuelgja/muya/actions/workflows/build.yml)
[![Code Quality Check](https://github.com/samuelgja/muya/actions/workflows/code-check.yml/badge.svg)](https://github.com/samuelgja/muya/actions/workflows/code-check.yml)
[![Build Size](https://img.shields.io/bundlephobia/minzip/muya?label=Bundle%20size)](https://bundlephobia.com/result?p=muya)


- **Simplified API**: Only `create` and `select`.
- **Batch Updates**: Built-in batching ensures efficient `muya` state updates internally.
- **TypeScript Support**: Type first.
- **Lightweight**: Minimal bundle size.

---

## 📦 **Installation**

Install with your favorite package manager:
```bash
bun add muya@latest
```
```bash
npm install muya@latest
```
```bash
yarn add muya@latest
```

---

## 📝 **Quick Start**

### **Create and Use State**

```typescript
import { create } from 'muya';

const useCounter = create(0);

// Access in a React component
function Counter() {
  const count = useCounter(); // Call state directly
  return (
    <div>
      <button onClick={() => useCounter.set((prev) => prev + 1)}>Increment</button>
      <p>Count: {count}</p>
    </div>
  );
}
```

---

### **Select and Slice State**

Use `select` to derive a slice of the state:

```typescript
const state = create({ count: 0, value: 42 });

const countSlice = state.select((s) => s.count);

// Also async is possible, but Muya do not recommend 
// It can lead to spaghetti re-renders code which is hard to maintain and debug
const asyncCountSlice = state.select(async (s) => {
  const data = await fetchData();
  return data.count;
});
```

---

### **Combine Multiple States**

Combine multiple states into a derived state via `select` method:

```typescript
import { create, select } from 'muya'

const state1 = create(1);
const state2 = create(2);

const sum = select([state1, state2], (s1, s2) => s1 + s2);
```

### **Equality Check**

Customize equality checks to prevent unnecessary updates:

```typescript
const state = create({ a: 1, b: 2 }, (prev, next) => prev.b === next.b);

// Updates only when `b` changes
state.set((prev) => ({ ...prev, a: prev.a + 1 }));
```

Or in select methods:

```typescript
const derived = select([state1, state2], (s1, s2) => s1 + s2, (prev, next) => prev === next);
```

---


## 🖥️ **Using State in Components**

Access state directly or through `useValue` hook:

### **Option 1: Access State Directly**
Each state can be called as the hook directly
```typescript
const userState = create(0);

function App() {
  const user = userState(); // Directly call state
  return <p>User: {user}</p>;
}
```

### **Option 2: Use the Hook**
Or for convenience, there is `useValue` method
```typescript
import { useValue } from 'muya';

function App() {
  const user = useValue(userState); // Access state via hook
  return <p>User: {user}</p>;
}
```

### **Option 3: Slice with Hook**
For efficient re-renders, `useValue` provides a slicing method.
```typescript
function App() {
  const count = useValue(state, (s) => s.count); // Use selector in hook
  return <p>Count: {count}</p>;
}
```

---

## 📖 **API Overview**

### **`create`**

Create a new state:

```typescript
const state = create(initialValue, isEqual?);

// Methods:
state.get(); // Get current value
state.set(value); // Update value
state.listen(listener); // Subscribe to changes
state.select(selector, isEqual?); // Create derived state
state.destroy(); // Unsubscribe from changes, useful for dynamic state creation in components
state.withName(name); // Add a name for debugging, otherwise it will be auto generated number
```

### **`select`**

Combine or derive new states:

```typescript
const derived = select([state1, state2], (s1, s2) => s1 + s2);

// Methods:
derived.get(); // Get current value
derived.listen(listener); // Subscribe to changes
derived.select(selector, isEqual?); // Create nested derived state
derived.destroy(); // Unsubscribe from changes, useful for dynamic state creation in components
derived.withName(name); // Add a name for debugging, otherwise it will be auto generated number
```

### **`useValue`**

React hook to access state:

```typescript
const value = useValue(state, (s) => s.slice); // Optional selector
```

---

## ⚠️ **Notes**

- **Equality Check**: Prevent unnecessary updates by passing a custom equality function to `create` or `select`.
- **Batch Updates**: Muya batches internal updates for better performance, reducing communication overhead similarly how react do.
- **Async Selectors / Derives**: Muya has support for async selectors / derives, but do not recommend to use as it can lead to spaghetti re-renders code which is hard to maintain and debug, if you want so, you can or maybe you should consider using other alternatives like `Jotai`.



`Muya` encourage use async updates withing sync state like this:
```typescript
const state = create({ data: null });
async function update() {
  const data = await fetchData();
  state.set({ data });
}
```
---

But of course you can do

Note: Handling async updates for the state (`set`) will cancel the previous pending promise.
```typescript
const state = create(0)
const asyncState = state.select(async (s) => {
  await longPromise(100)
  return s + 1
})
```
---

### Debugging
`Muya` in dev mode automatically connects to the `redux` devtools extension if it is installed in the browser. For now devtool api is simple - state updates.

## 🙏 **Acknowledgments**

This library is a fun, experimental project and not a replacement for robust state management tools. For more advanced use cases, consider libraries like `Zustand`, `Jotai`, or `Redux`. 
If you enjoy `Muya`, please give it a ⭐️! :)
