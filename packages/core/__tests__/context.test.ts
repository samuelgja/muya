/* eslint-disable sonarjs/pseudo-random */
/* eslint-disable sonarjs/no-nested-functions */

import { createContext } from '../create-context'
import { longPromise } from './test-utils'

describe('context', () => {
  it('should check context', () => {
    const context = createContext({ name: 'John Doe' })

    const main = () => {
      context.run({ name: 'Jane Doe' }, () => {
        expect(context.use()).toEqual({ name: 'Jane Doe' })
      })
    }
    expect(context.use()).toEqual({ name: 'John Doe' })
    main()
    expect(context.use()).toEqual({ name: 'John Doe' })
  })

  it('should test async context', (done) => {
    const context = createContext<string>('empty')
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const awaiter = async () => new Promise((resolve) => setTimeout(resolve, 10))
    context.run('outer', () => {
      expect(context.use()).toEqual('outer')

      // Wrap the asynchronous callback to preserve 'outer' context
      setTimeout(
        context.wrap(async () => {
          try {
            await awaiter()
            expect(context.use()).toEqual('outer')
            innerDone()
          } catch (error) {
            done(error)
          }
        }),
        10,
      )

      context.run('inner', () => {
        expect(context.use()).toEqual('inner')

        // Wrap the asynchronous callback to preserve 'inner' context
        setTimeout(
          context.wrap(() => {
            try {
              expect(context.use()).toEqual('inner')
              innerDone()
            } catch (error) {
              done(error)
            }
          }),
          10,
        )
      })

      expect(context.use()).toEqual('outer')
    })

    let completed = 0
    function innerDone() {
      completed += 1
      if (completed === 2) {
        done()
      }
    }
  })
  it('should test async nested context', (done) => {
    const context = createContext(0)
    context.run(1, () => {
      expect(context.use()).toEqual(1)
      context.run(2, () => {
        context.run(3, () => {
          expect(context.use()).toEqual(3)
          setTimeout(
            context.wrap(() => {
              expect(context.use()).toEqual(3)
            }),
            10,
          )
          expect(context.use()).toEqual(3)
        })
        setTimeout(
          context.wrap(() => {
            expect(context.use()).toEqual(2)
          }),
          10,
        )
        expect(context.use()).toEqual(2)
        context.run(3, () => {
          expect(context.use()).toEqual(3)
          setTimeout(
            context.wrap(() => {
              expect(context.use()).toEqual(3)
              context.run(4, () => {
                expect(context.use()).toEqual(4)
                setTimeout(
                  context.wrap(() => {
                    expect(context.use()).toEqual(4)
                    done()
                  }),
                  10,
                )
                expect(context.use()).toEqual(4)
              })
            }),
            10,
          )
          expect(context.use()).toEqual(3)
        })
        // check back to 2
        expect(context.use()).toEqual(2)
      })
      // check back to 1
      expect(context.use()).toEqual(1)
    })
    // check back to 0
    expect(context.use()).toEqual(0)
  })
  it('should stress test context with async random code', async () => {
    const stressCount = 10_000
    const context = createContext(0)
    for (let index = 0; index < stressCount; index++) {
      context.run(index, () => {
        expect(context.use()).toEqual(index)
      })
    }

    const promises: Promise<unknown>[] = []
    for (let index = 0; index < stressCount; index++) {
      context.run(index, () => {
        expect(context.use()).toEqual(index)
        const promise = new Promise((resolve) => {
          setTimeout(
            context.wrap(() => {
              expect(context.use()).toEqual(index)
              resolve(index)
            }),
            Math.random() * 100,
          )
        })
        promises.push(promise)
      })
    }
    await Promise.all(promises)
  })

  it('should-test-default-value-with-ctx', async () => {
    const ctx = createContext({ counter: 1 })
    await ctx.run({ counter: 10 }, async () => {
      await longPromise(10)
      expect(ctx.use().counter).toBe(10)
    })
    ctx.run({ counter: 12 }, () => {
      expect(ctx.use().counter).toBe(12)
    })
  })
  it('should test nested context', () => {
    let currentCount = 0
    const context = createContext({ count: 0 })
    function container() {
      const isIn = context.use()
      expect(isIn.count).toBe(currentCount)
      context.run({ count: currentCount + 1 }, () => {
        const inner = context.use()
        expect(inner.count).toBe(currentCount + 1)
        context.run({ count: currentCount + 2 }, () => {
          const innerInner = context.use()
          expect(innerInner.count).toBe(currentCount + 2)
        })
      })
    }

    container()
    container()
  })
})
