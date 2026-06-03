import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import babel from '@babel/core'
import path from 'node:path'
import fs from 'node:fs'
import React from 'react'
import { render, act, cleanup, waitFor } from '@testing-library/react'

// A component, written exactly how a consumer would, that reads a muya state via `useValue`.
// We run it through the real React Compiler (babel-plugin-react-compiler) with `compilationMode: 'all'`
// so the component body is wrapped in the compiler's memoization cache (`react/compiler-runtime`).
// If `useValue` were not a proper hook, the compiler would treat the read as a pure value and freeze it
// at its initial value — the exact SSR/app bug this guards against.
const componentSource = `
import React from 'react'
import { create, useValue } from '../src/index'
export const counterStore = create(0)
export function increment() { counterStore.set((current) => current + 1) }
export function Demo() {
  const count = useValue(counterStore)
  return React.createElement('div', { 'data-testid': 'value' }, count)
}
`

const compiledPath = path.join(import.meta.dir, '__compiled-react-compiler-demo.mjs')
let compiled: { Demo: React.ComponentType; increment: () => void }

beforeAll(async () => {
  const result = babel.transformSync(componentSource, {
    filename: 'react-compiler-demo.jsx',
    plugins: [['babel-plugin-react-compiler', { target: '19', compilationMode: 'all' }]],
  })
  const code = result?.code ?? ''
  // Guard: prove the component was actually compiled/memoized, otherwise the test is vacuous.
  if (!code.includes('react/compiler-runtime')) {
    throw new Error('React Compiler did not compile the component; test would be meaningless')
  }
  fs.writeFileSync(compiledPath, code)
  compiled = (await import(compiledPath)) as typeof compiled
}, 120_000)

afterAll(() => {
  cleanup()
  fs.rmSync(compiledPath, { force: true })
})

describe('React Compiler compatibility', () => {
  it('useValue stays reactive after the component is compiled by React Compiler', async () => {
    const { getByTestId } = render(React.createElement(compiled.Demo))
    expect(getByTestId('value').textContent).toBe('0')

    act(() => {
      compiled.increment()
    })
    await waitFor(() => expect(getByTestId('value').textContent).toBe('1'))

    act(() => {
      compiled.increment()
    })
    await waitFor(() => expect(getByTestId('value').textContent).toBe('2'))
  })
})
