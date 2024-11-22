
# **Muya 🌀**

Muya is simple and lightweight react state management library.

---

## 🚀 **Key Features**

- **Simplified API**: Only `create` and `select`.
- **Batch Updates**: Built-in batching ensures efficient `muya` state updates internally.
- **TypeScript Support**: Type first.
- **Lightweight**: Minimal bundle size.

---
[![Build](https://github.com/samuelgja/muya/actions/workflows/build.yml/badge.svg)](https://github.com/samuelgja/muya/actions/workflows/build.yml)
[![Code Quality Check](https://github.com/samuelgja/muya/actions/workflows/code-check.yml/badge.svg)](https://github.com/samuelgja/muya/actions/workflows/code-check.yml)
[![Build Size](https://img.shields.io/bundlephobia/minzip/muya?label=Bundle%20size)](https://bundlephobia.com/result?p=muya)

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

const counter = create(0);

// Access in a React component
function Counter() {
  const count = counter(); // Call state directly
  return (
    <div>
      <button onClick={() => counter.set((prev) => prev + 1)}>Increment</button>
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

// Derive a specific slice
const countSlice = state.select((s) => s.count);
```

---

### **Combine Multiple States**

Combine multiple states into a derived state:

```typescript
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

```typescript
const userState = create(0);

function App() {
  const user = userState(); // Directly call state
  return <p>User: {user}</p>;
}
```

### **Option 2: Use the Hook**

```typescript
import { useValue } from 'muya';

function App() {
  const user = useValue(userState); // Access state via hook
  return <p>User: {user}</p>;
}
```

### **Option 3: Slice with Hook**

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
- **Async Derives**: This library doesn’t manage async derived state natively, if you want so, please consider using alternatives like `Jotai`.

---

## 🙏 **Acknowledgments**

This library is a fun, experimental project and not a replacement for robust state management tools. For more advanced use cases, consider libraries like `Zustand`, `Jotai`, or `Redux`. 
If you enjoy `Muya`, please give it a ⭐️! :)
