
# Muya 🌀

Welcome to **Muya v2**—a state management library that makes managing state a breeze, focusing on simplicity and scalability for real-world applications.

[![Build](https://github.com/samuelgja/muya/actions/workflows/build.yml/badge.svg)](https://github.com/samuelgja/muya/actions/workflows/build.yml)
[![Code Quality Check](https://github.com/samuelgja/muya/actions/workflows/code-check.yml/badge.svg)](https://github.com/samuelgja/muya/actions/workflows/code-check.yml)
[![Build Size](https://img.shields.io/bundlephobia/minzip/muya?label=Bundle%20size)](https://bundlephobia.com/result?p=muya)

---

## 🚀 Features

- **Simple State Creation**: Easily create global state with an intuitive API.
- **Functional Derivations**: Derive / Compute new state using plain functions, embracing functional programming.
- **Async Support**: Async derived states work out of the box, with support for React Suspense.
- **Performance Optimizations**: WIP Batch state updates for optimized rendering.
- **TypeScript Support**: Fully typed for a better developer experience.
- **Small Bundle Size**: Lightweight and efficient—no unnecessary bloat.

---

Info: [Muya v2](https://medium.com/p/106de3d04c43)

### 💡 How It Works
Muya v2 uses its own custom context system to track dependencies and notify components when state changes. When you use a function that accesses state in your component, Muya tracks which states are used and re-renders the component when any of them change.

This allows you to write derived state as plain functions, making your code more intuitive and closer to standard JavaScript. No need to define selectors or use special APIs—just use functions!

--- 

## 📦 Installation

```bash
npm install muya@2.0.0-beta.2
```

Or using Yarn:

```bash
yarn add muya@2.0.0-beta.2
```

Or using Bun:

```bash
bun add muya@2.0.0-beta.2
```

---

## 📝 Quick Start

Here's how to get started with **Muya v2**:

### Creating State

```typescript
import { create } from 'muya';

const counter = create(0);
```

### Using State in Components

```tsx
import React from 'react';
import { use } from 'muya';

function Counter() {
  const count = use(counter);

  return (
    <div>
      <button onClick={() => counter.set((prev) => prev + 1)}>
        Increment
      </button>
      <p>Count: {count}</p>
    </div>
  );
}
```

---

## 📚 Examples

### Deriving / Selecting State with Functions

You can derive new state using plain functions:

```typescript
const counter = create(0);

function doubled() {
  return counter() * 2;
}
```

Use it in a component:

```tsx
function DoubledCounter() {
  const value = use(doubled);

  return <p>Doubled Count: {value}</p>;
}
```

### Complex Derivations

Create more complex derived states by composing functions:

```tsx
import { create, use } from 'muya';

const state1 = create(0);
const state2 = create(0);
const state3 = create(0);

function sum() {
  return state1() + state2() + state3();
}

function multiply() {
  return sum() * 2; // Example multiplier
}

function isOdd() {
  return multiply() % 2 === 1;
}

function App() {
  const isOddValue = use(isOdd);

  return (
    <div>
      <button onClick={() => state1.set((c) => c + 1)}>Increment Counter 1</button>
      <button onClick={() => state2.set((c) => c + 1)}>Increment Counter 2</button>
      <button onClick={() => state3.set((c) => c + 1)}>Increment Counter 3</button>
      <p>Is ODD: {isOddValue ? 'Yes' : 'No'}</p>
    </div>
  );
}
```


### Derive state with parameters
```tsx

import React, { useCallback, useState } from 'react';
import { create, use } from 'muya';

const counter1 = create(0);
const counter2 = create(0);

function multipliedSum(multiplier: number) {
  return (counter1() + counter2()) * multiplier;
}

function MultipliedCounter() {
  const [multiplier, setMultiplier] = useState(1);
  // make sure to use useCallback to memoize the function
  const multiply = useCallback(() => multipliedSum(multiplier), [multiplier]);
  const result = use(multiply);

  return (
    <div>
      <button onClick={() => counter1.set((c) => c + 1)}>
        Increment Counter 1
      </button>
      <button onClick={() => counter2.set((c) => c + 1)}>
        Increment Counter 2
      </button>
      <button onClick={() => setMultiplier((m) => m + 1)}>
        Increment Multiplier
      </button>
      <p>Result: {result}</p>
    </div>
  );
}
```

### Async derives State

```tsx
import { create } from 'muya';

const counter = create(1);

async function fetchData() {
  const response = await fetch(`https://jsonplaceholder.typicode.com/todos/${counter()}`);
  return response.json();
}

// make sure this component is wrapped in a <Suspense> component
function Component() {
  const data = use(fetchData);

  return (
    <div>
      <button onClick={() => counter.set((prev) => prev + 1)}>Increment</button>
      <p>{JSON.stringify(data)}</p>
    </div>
  );
}


```
---




## 📖 Documentation

#### `create`

```typescript
  function create<T>(initialState: T): State<T>;
```

Create return state block or atom, setting a new value to the state will trigger a re-render of all components using the state.
```typescript
  const counter = create(0);
  // set new value
  counter.set(1);
```

Get the state value outside of react
```typescript
  const value = counter();
  // call it like a function
  console.log(value()); // 1
```

Each state created by create has the following properties and methods:

- id: number: Unique identifier for the state.
- (): T: The state is callable to get the current value.
- set(value: T | ((prev: T) => T)): Update the state value.
- listen(listener: (value: T) => void): () => void: Subscribe to state changes.

#### `use` hook
Use hook to get state value in react component
```typescript
  function use<T>(state: State<T> | (() => T)): T;
```
example
```tsx
  const counter = create(0);

  // in react component
  const count = use(counter);
```

Also custom selector to avoid re-rendering the app
```tsx
  const doubled = create({doubled:true});
  // in react component
  const value = use(doubled, (state) => state.doubled);
```





### ⚠️ Notes
Memoization: When using derived functions with parameters, you should memoize them using useCallback to prevent unnecessary re-renders and prevent function calls.
```tsx
Copy code
const multiply = useCallback(() => multipliedSum(multiplier), [multiplier]);
```
Async Functions: Async functions used in use should handle errors appropriately and may need to use React's Suspense for loading states.
Also keep in note, setting new state in async derives, will cancel the pending previous one in the queue.

```tsx
Copy code
function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DataComponent />
    </Suspense>
  );
}
```

Error Handling: If an async function throws an error, you can catch it using React's error boundaries.

### 🤖 Contributing
Contributions are welcome! Please read the contributing guidelines before submitting a pull request.

### 🧪 Testing
Muya comes with a robust testing suite. Check out the state.test.tsx for examples on how to write your own tests.


### 🙏 Acknowledgments
Special thanks to reddit to motivate me for v2 :D 

