/* eslint-disable unicorn/consistent-function-scoping */
import { memoizedSubscriber } from '../../memoized-subscriber'

describe('memo-fn', () => {
  it('should create memo fn', () => {
    function toBeMemoized(): boolean {
      return true
    }

    const memoized = memoizedSubscriber(toBeMemoized)
    expect(memoized.call().emitter).toBeDefined()
  })
})
