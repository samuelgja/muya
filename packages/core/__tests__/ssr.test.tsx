import { describe, it, expect } from 'bun:test'
import React, { Suspense } from 'react'
import { renderToString } from 'react-dom/server'
import { create } from '../src/create'
import { select } from '../src/select'
import { useValue } from '../src/use-value'
import { useValueLoadable } from '../src/use-value-loadable'

describe('server-side rendering', () => {
  it('useValue renders on the server without "Missing getServerSnapshot"', () => {
    const counter = create(5)
    const Comp = () => React.createElement('div', null, useValue(counter))
    const html = renderToString(React.createElement(Comp))
    expect(html).toContain('5')
  })

  it('useValue with a selector renders on the server', () => {
    const user = create({ name: 'Ada' })
    const Comp = () =>
      React.createElement(
        'div',
        null,
        useValue(user, (u) => u.name),
      )
    const html = renderToString(React.createElement(Comp))
    expect(html).toContain('Ada')
  })

  it('select() derived state renders on the server', () => {
    const first = create(2)
    const second = create(3)
    const sum = select([first, second], (x, y) => x + y)
    const Comp = () => React.createElement('div', null, useValue(sum))
    const html = renderToString(React.createElement(Comp))
    expect(html).toContain('5')
  })

  it('useValueLoadable renders on the server', () => {
    const counter = create(7)
    const Comp = () => React.createElement('div', null, useValueLoadable(counter)[0])
    const html = renderToString(React.createElement(Comp))
    expect(html).toContain('7')
  })

  it('useValueLoadable renders the loading state on the server for a promise state', () => {
    const data = create(async (): Promise<number> => 5)
    const Comp = () => {
      const [value, isLoading] = useValueLoadable(data)
      return React.createElement('div', null, isLoading ? 'loading' : String(value))
    }
    const html = renderToString(React.createElement(Comp))
    expect(html).toContain('loading')
  })

  it('useValue suspends on the server for a promise state without "Missing getServerSnapshot"', () => {
    const data = create(async (): Promise<number> => 5)
    const Comp = () => React.createElement('div', null, useValue(data))
    const html = renderToString(
      React.createElement(Suspense, { fallback: React.createElement('span', null, 'loading') }, React.createElement(Comp)),
    )
    expect(html).toContain('loading')
  })
})
