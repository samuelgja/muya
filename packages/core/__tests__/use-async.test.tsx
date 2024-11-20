// const userState = create({ name: 'John', age: 30 })

// export async function getDataWithUser() {
//   const result = await fetch('https://jsonplaceholder.typicode.com/todos/1')
//   const json = await result.json()
//   return { ...json, age: userState().age }
// }

import { act, renderHook } from '@testing-library/react-hooks'
import { create } from '../create'
import { use } from '../use'
import { subscriber } from '../subscriber'
import { Suspense } from 'react'
import { longPromise } from './test-utils'

describe('use-create', () => {
  const reRendersBefore = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should test sub hook', async () => {
    const userState = create({ name: 'John', age: 30 })
    async function getDataWithUser() {
      const result = await fetch('https://jsonplaceholder.typicode.com/todos/1')
      const json = await result.json()
      return { age: userState().age, ...json }
    }

    const suspenseFn = jest.fn()
    function Loading() {
      suspenseFn()
      return <div>Loading...</div>
    }

    const { result, waitFor } = renderHook(
      () => {
        reRendersBefore()
        console.log('re-render getDataWithUser')
        const data = use(getDataWithUser)
        console.log(data)
        return data
      },
      { wrapper: ({ children }) => <Suspense fallback={<Loading />}>{children}</Suspense> },
    )

    await longPromise(1000)
    await waitFor(() => {})
    expect(suspenseFn).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual({ userId: 1, id: 1, title: 'delectus aut autem', completed: false, age: 30 })
  })
})
