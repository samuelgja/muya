/* eslint-disable unicorn/consistent-function-scoping */
import { subMemo } from '../sub-memo'

describe('memo-fn', () => {
  it('should create memo fn', () => {
    function toBeMemoized(): boolean {
      return true
    }

    const memoized = subMemo(toBeMemoized)
    expect(memoized.call().emitter).toBeDefined()
  })
})
