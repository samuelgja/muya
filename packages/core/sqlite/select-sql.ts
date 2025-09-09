import { createState } from '../create-state'
import type { GetState } from '../types'
import type { SyncTable } from './create-sqlite'
import type { DocType, DotPath } from './table/table.types'
import type { Where } from './table/where'

export type CreateState<Document, Params extends unknown[]> = (...params: Params) => GetState<Document[]>

export interface SqlSeachOptions<Document extends DocType> {
  readonly sortBy?: DotPath<Document>
  readonly order?: 'asc' | 'desc'
  readonly limit?: number
  readonly offset?: number
  readonly where?: Where<Document>
  readonly stepSize?: number
}

let stateId = 0
/**
 * Generate a unique state ID
 * @returns A unique state ID
 */
function getStateId() {
  stateId++
  return `${stateId.toString(36)}-sql`
}

/**
 * Create a state that derives its value from a SyncTable using a compute function
 * @param state The SyncTable to derive from
 * @param compute A function that takes parameters and returns SqlSeachOptions to filter the SyncTable
 * @returns A function that takes parameters and returns a GetState of the derived documents
 */
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
