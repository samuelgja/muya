# Muya 🌀
Welcome to Muya - Making state management a breeze, focused on simplicity and scalability for real-world scenarios.

[![Build](https://github.com/samuelgja/muya/actions/workflows/build.yml/badge.svg)](https://github.com/samuelgja/muya/actions/workflows/build.yml)
[![Code quality Check](https://github.com/samuelgja/muya/actions/workflows/code-check.yml/badge.svg)](https://github.com/samuelgja/muya/actions/workflows/code-check.yml)
[![Build Size](https://img.shields.io/bundlephobia/minzip/muya?label=Bundle%20size)](https://bundlephobia.com/result?p=muya)

## 🚀 Features
- Easy State Creation: Kickstart your state management with simple and intuitive APIs.
- Selectors & Merges: Grab exactly what you need from your state and combine multiple states seamlessly.
- Deep Nesting Support: Handle complex state structures without breaking a sweat.
- Optimized Rendering: Prevent unnecessary re-renders
- TypeScript Ready: Fully typed for maximum developer sanity.
- Small Bundle Size: Lightweight and fast, no bloatware here.

## 📦 Installation

```bash
bun add muya
```
or
```bash
yarn add muya
```
or
```bash
npm install muya
```

## 📝 Quick Start

```typescript
import { create } from 'muya'

const useCounter = create(0)

function App() {
  const counter = useCounter()
  return <div onClick={() => useCounter.setState((prev) => prev + 1)}>{counter}</div>
}
```

### Update
Sugar syntax above the `setState` method for partially updating the state.
```typescript
import { create } from 'muya'

const useUser = create({ name: 'John', lastName: 'Doe' })

function App() {
  const user = useUser()
  // this will just partially update only the name field, it's sugar syntax for setState.
  return <div onClick={() => useUser.updateState({ name: 'Nope' })}>{user.name}</div>
}
```

### Selecting parts of the state globally
```tsx
import { create } from 'muya'

const useUser = create({ name: 'John', age: 30 })

// Selecting only the name part of the state
const useName = useUser.select((user) => user.name)

function App() {
  const name = useName()
  return <div onClick={() => useUser.setState((prev) => ({ ...prev, name: 'Jane' }))}>{name}</div>
}

```

### Selecting parts of the state via selectors in components
```tsx
import { create } from 'muya'

const useUser = create({ name: 'John', age: 30 })

function App() {
  const name = useUser((user) => user.name)
  return <div onClick={() => useUser.setState((prev) => ({ ...prev, name: 'Jane' }))}>{name}</div>
}

```

### Merge any states
```typescript
import { create, shallow, merge } from 'muya'

const useName = create(() => 'John')
const useAge = create(() => 30)
const useSomeData = create(() => ({ data: 'some data' }))

const useFullName = merge([useName, useAge, useSomeData], (name, age) => `${name} and ${age}`)

function App() {
  const fullName = useFullName()
  return <div onClick={() => useName.setState((prev) => 'Jane')}>{fullName}</div>
}
```

### Promise based state and lifecycle management working with React Suspense
This methods are useful for handling async data fetching and lazy loading via React Suspense.

#### Immediate Promise resolution
```typescript
import { create } from 'muya';
 // state will try to resolve the promise immediately, can hit the suspense boundary
const counterState = create(Promise.resolve(0));

function Counter() {
  const counter = counterState();
  return (
    <div onClick={() => counterState.setState((prev) => prev + 1)}>
      {counter}
    </div>
  );
}
```

#### Lazy Promise resolution
```typescript
import { create } from 'muya';
// state will lazy resolve the promise on first access, this will hit the suspense boundary if the first access is from component and via `counterState.getState()` method
const counterState = create(() => Promise.resolve(0)); 

function Counter() {
  const counter = counterState();
  return (
    <div onClick={() => counterState.setState((prev) => prev + 1)}>
      {counter}
    </div>
  );
}
```

## 🔍 API Reference

### `create`

Creates a basic atom state.

```typescript
function create<T>(defaultState: T, options?: StateOptions<T>): StateSetter<T>;
```

**Example:**

```typescript
const userState = create({ name: 'John', age: 30 });
```

### `select`

Selects a slice of an existing state directly or via a selector function.

```typescript
// userState is ready to use as hook, so you can name it with `use` prefix
const userState = create({ name: 'John', age: 30 });
// Direct selection outside the component, is useful for accessing the slices of the state in multiple components
const userAgeState = userState.select((user) => user.age);
```

### `merge`
Merges any number states into a single state. 
```typescript
const useName = create(() => 'John');
const useAge = create(() => 30);
const useFullName = merge([useName, useAge], (name, age) => `${name} and ${age}`);
```

### `setState`
Sets the state to a new value or a function that returns a new value.

```typescript
const userState = create({ name: 'John', age: 30 });
userState.setState({ name: 'Jane' });
```

### `updateState`
Partially updates the state with a new value.

```typescript
const userState = create({ name: 'John', age: 30 });
userState.updateState({ name: 'Jane' });
```

### `getState`
Returns the current state value outside the component.

```typescript
const userState = create({ name: 'John', age: 30 });
const user = userState.getState();
```

### `use`
Creates a hook for the state.

```typescript
const useCounter = create(0);
// use inside the component
const counter = useCounter();
```

### `subscribe`
Subscribes to the state changes.

```typescript
const userState = create({ name: 'John', age: 30 });
const unsubscribe = userState.subscribe((state) => console.log(state));
```

### Promise Handling

#### Immediate Promise Resolution

```typescript
import { create } from 'muya';

// State will try to resolve the promise immediately, can hit the suspense boundary
const counterState = create(Promise.resolve(0));

function Counter() {
  const counter = counterState();
  return (
    <div onClick={() => counterState.setState((prev) => prev + 1)}>
      {counter}
    </div>
  );
}
```

#### Lazy Promise Resolution

```typescript
import { create } from 'muya';

// State will lazy resolve the promise on first access, this will hit the suspense boundary if the first access is from component and via `counterState.getState()` method
const counterState = create(() => Promise.resolve(0));

function Counter() {
  const counter = counterState();
  return (
    <div onClick={() => counterState.setState((prev) => prev + 1)}>
      {counter}
    </div>
  );
}
```

#### Promise Rejection Handling

```typescript
import { create } from 'muya';

// State will reject the promise
const counterState = create(Promise.reject('Error occurred'));

function Counter() {
  try {
    const counter = counterState();
    return <div>{counter}</div>;
  } catch (error) {
    return <div>Error: {error}</div>;
  }
}
```

#### Error Throwing

```typescript
import { create } from 'muya';

// State will throw an error
const counterState = create(() => {
  throw new Error('Error occurred');
});

function Counter() {
  try {
    const counter = counterState();
    return <div>{counter}</div>;
  } catch (error) {
    return <div>Error: {error.message}</div>;
  }
}
```

#### Setting a state during promise resolution

```typescript
import { create } from 'muya';

// State will resolve the promise and set the state
const counterState = create(Promise.resolve(0));
// this will abort current promise and set the state to 10
counterState.setState(10); 
function Counter() {
  const counter = counterState();
  return (
    <div onClick={() => counterState.setState((prev) => prev + 1)}>
      {counter}
    </div>
  );
}
```


### Access from outside the component
:warning: Avoid using this method for state management in [React Server Components](https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md), especially in Next.js 13+. It may cause unexpected behavior or privacy concerns.
```typescript
const userState = create({ name: 'John', age: 30 });
const user = userState.getState();
```
---

### Slicing new references
:warning: Slicing data with new references can lead to maximum call stack exceeded error.
It's recommended to not use new references for the state slices, if you need so, use `shallow` or other custom equality checks.
```typescript
import { state, shallow } from 'muya';
const userState = create({ name: 'John', age: 30 });
// this slice will create new reference object on each call
const useName = userState.select((user) => ({newUser: user.name }), shallow);
```

## 🤖 Contributing
Contributions are welcome! Please read the [contributing guidelines](CONTRIBUTING.md) before submitting a pull request.

## 🧪 Testing
Muya comes with a robust testing suite. Check out the state.test.tsx for examples on how to write your own tests.

## 📜 License

Muya is [MIT licensed](LICENSE).
