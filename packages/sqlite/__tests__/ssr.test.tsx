import { describe, it, expect } from 'bun:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { createSqliteState } from '../src/create-sqlite'
import { useSqliteValue } from '../src/use-sqlite'
import { useSqliteCount } from '../src/use-sqlite-count'
import { bunMemoryBackend } from '../src/table/bun-backend'

interface Person {
  id: string
  name: string
}

const backend = bunMemoryBackend()

describe('sqlite server-side rendering', () => {
  it('useSqliteValue renders on the server without "Missing getServerSnapshot"', () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'SSRValue', key: 'id' })
    sql.set({ id: '1', name: 'Ada' })
    const Comp = () => {
      const { data, isLoading } = useSqliteValue(sql)
      return React.createElement('div', null, isLoading ? 'loading' : JSON.stringify(data))
    }
    const html = renderToString(React.createElement(Comp))
    expect(html).toContain('<div>')
  })

  it('useSqliteCount renders on the server without "Missing getServerSnapshot"', () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'SSRCount', key: 'id' })
    sql.set({ id: '1', name: 'Ada' })
    const Comp = () => {
      const count = useSqliteCount(sql)
      return React.createElement('div', null, `count:${count}`)
    }
    const html = renderToString(React.createElement(Comp))
    expect(html).toContain('count:')
  })

  it('does not subscribe to the table during server render (no SSR leak / DB work)', () => {
    const sql = createSqliteState<Person>({ backend, tableName: 'SSRNoSub', key: 'id' })
    sql.set({ id: '1', name: 'Ada' })
    const original = sql.subscribe.bind(sql)
    let subscribeCalls = 0
    ;(sql as { subscribe: typeof sql.subscribe }).subscribe = (listener) => {
      subscribeCalls++
      return original(listener)
    }
    const Comp = () => React.createElement('div', null, String(useSqliteValue(sql).isLoading))
    renderToString(React.createElement(Comp))
    // start() is deferred to the client getSnapshot(); the server never subscribes or loads.
    expect(subscribeCalls).toBe(0)
  })
})
