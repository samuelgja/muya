/* eslint-disable jsdoc/require-jsdoc */
import { createSqliteState } from '../src/create-sqlite'
import type { SyncTable } from '../src/types'
import { bunMemoryBackend } from '../src/table/bun-backend'

export interface Person {
  id: string
  name: string
  age: number
  bio: string
}

export function generatePeople(count: number): Person[] {
  const people: Person[] = new Array(count)
  for (let index = 0; index < count; index++) {
    people[index] = {
      id: `person-${index}`,
      name: `Person ${index}`,
      age: 20 + (index % 60),
      bio: `Bio for person ${index} — lorem ipsum dolor sit amet`,
    }
  }
  return people
}

let counter = 0
export async function makeSeededTable(count: number): Promise<SyncTable<Person>> {
  counter++
  const sql = createSqliteState<Person>({
    backend: bunMemoryBackend(),
    tableName: `Bench_${counter}`,
    key: 'id',
    indexes: ['age'],
  })
  await sql.batchSet(generatePeople(count))
  return sql
}

export function fmt(ms: number): string {
  return ms < 10 ? ms.toFixed(2) : ms.toFixed(1)
}
