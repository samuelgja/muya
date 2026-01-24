# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Muya is a tiny, type-safe React state management library with a minimal API (`create`, `select`, `useValue`). It features internal batching, optional equality checks, TypeScript-first design, and an optional SQLite companion module for queryable lists.

## Commands

```bash
# Install dependencies
bun install

# Build (outputs to lib/ with CJS, ESM, and types)
bun run build

# Run all tests
bun test ./packages/**

# Run a single test file
bun test ./packages/core/__tests__/create.test.tsx

# Run tests matching a pattern
bun test ./packages/core/__tests__/create.test.tsx --filter "should get basic value"

# Lint with auto-fix
bun run lint

# Format code
bun run format

# Type check
bun run typecheck

# Full check (typecheck → lint → test → format) - also runs on pre-push hook
bun run code-check
```

## Architecture

```
packages/core/
├── index.ts              # Public exports: create, select, useValue, shallow, types, is
├── create.ts             # Core state factory - creates State<T> objects
├── create-state.ts       # Internal state implementation with get/set/listen/select
├── select.ts             # Derived state from multiple sources
├── use-value.ts          # React hook for reading state with optional selector
├── scheduler.ts          # STATE_SCHEDULER - batches multiple set() calls
├── types.ts              # Core TypeScript types
├── utils/
│   ├── create-emitter.ts # Event subscription system for state listeners
│   ├── common.ts         # Async/update handlers for lazy and Promise-based states
│   ├── shallow.ts        # Shallow equality comparison
│   └── is.ts             # Type guards (isFunction, isPromise, etc.)
├── debug/
│   └── development-tools.ts  # Redux DevTools integration
└── sqlite/               # Optional SQLite companion module
    ├── create-sqlite.ts  # SQLite state factory
    ├── use-sqlite.ts     # React hook with pagination (next/reset actions)
    └── table/            # WHERE clause parsing, pagination, tokenization
```

**Key Patterns:**
- States are callable hooks: `const count = counter()` in components
- Lazy initialization: `create(() => value)` defers computation until first read
- Async states suspend on first read, then update synchronously
- `set(prev => next)` waits for pending promises; `set(value)` overrides immediately

## Code Style

- ESLint flat config with React Hooks, Unicorn, SonarJS rules
- Prettier: no semicolons, single quotes, trailing commas, 130 char width
- JSDoc required for exports (via eslint-plugin-jsdoc)
- Allowed abbreviations: idx, doc, props, param, ref, db, cb, ctx

## Testing

- Jest + React Testing Library + Happy DOM (configured in bunfig.toml)
- Test files in `packages/core/__tests__/` and `packages/core/sqlite/__tests__/`
- For async states/selectors, use `await waitFor(...)` for expectations
