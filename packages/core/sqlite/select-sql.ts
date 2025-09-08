import { createState } from '../create-state'
import type { GetState } from '../types'
import type { SyncTable } from './create-sqlite'
import type { DocType } from './table/table.types'
import type { Where } from './table/where'

export type CreateState<Document, Params extends unknown[]> = (...params: Params) => GetState<Document[]>

export interface SqlSeachOptions<Document extends DocType> {
  readonly sorBy?: keyof Document
  readonly order?: 'asc' | 'desc'
  readonly limit?: number
  readonly offset?: number
  readonly where?: Where<Document>
  readonly stepSize?: number
}

let stateId = 0
function getStateId() {
  stateId++
  return `${stateId.toString(36)}-sql`
}

export function selectSql<Document extends DocType, Params extends unknown[] = []>(
  state: SyncTable<Document>,
  compute: (...args: Params) => SqlSeachOptions<Document>,
): CreateState<Document, Params> {
  const { subscribe, updateSearchOptions } = state

  const result: CreateState<Document, Params> = (...params) => {
    const searchId = getStateId()
    const destroy = subscribe(searchId, () => {
      getState.emitter.emit()
    })

    const options = compute(...params)
    const getState = createState<Document[]>({
      destroy() {
        destroy()
        getState.emitter.clear()
        getState.cache.current = undefined
      },
      get() {
        return state.getSnapshot(searchId)
      },
      getSnapshot() {
        return state.getSnapshot(searchId)
      },
    })
    updateSearchOptions<Document>(searchId, options)

    return getState
  }
  return result
}
