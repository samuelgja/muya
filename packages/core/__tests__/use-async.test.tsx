/* eslint-disable @typescript-eslint/ban-ts-comment */
import { renderHook } from '@testing-library/react-hooks'
import { create } from '../create'
import { use } from '../use'
import { Suspense } from 'react'
import { waitFor } from '@testing-library/react'

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

    const suspenseFunction = jest.fn()
    function Loading() {
      suspenseFunction()
      return <div>Loading...</div>
    }

    const { result } = renderHook(
      () => {
        reRendersBefore()
        const data = use(getDataWithUser)
        return data
      },
      // @ts-expect-error
      { wrapper: ({ children }) => <Suspense fallback={<Loading />}>{children}</Suspense> },
    )

    await waitFor(() => {
      expect(result.current).toEqual({ userId: 1, id: 1, title: 'delectus aut autem', completed: false, age: 30 })
    })
    expect(suspenseFunction).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual({ userId: 1, id: 1, title: 'delectus aut autem', completed: false, age: 30 })
  })
})
