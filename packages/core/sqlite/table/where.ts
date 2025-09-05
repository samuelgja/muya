/* eslint-disable sonarjs/no-nested-conditional */
/* eslint-disable sonarjs/cognitive-complexity */
// -------------------------------------------------------------
// Simplified `Where` type: each field may be a `Condition`
// *or* directly a `Document[K]`/`Document[K][]`, shorthand for "is"/"in".
// We also allow the special literal "KEY" to filter by the primary‐key column.
// -------------------------------------------------------------

export interface Field {
  readonly table: string
  readonly field: string
}

interface Condition<
  Document extends Record<string, unknown>,
  K extends keyof Document = keyof Document,
> {
  readonly is?: Document[K] | Array<Document[K]>
  readonly isNot?: Document[K] | Array<Document[K]>
  readonly gt?: Document[K] | Array<Document[K]>
  readonly gte?: Document[K] | Array<Document[K]>
  readonly lt?: Document[K] | Array<Document[K]>
  readonly lte?: Document[K] | Array<Document[K]>
  readonly in?: Document[K] | Array<Document[K]>
  readonly notIn?: Document[K] | Array<Document[K]>
  readonly like?: Document[K] | Array<Document[K]>
}

/**
 * We extend `keyof Document` by the special literal "KEY".
 * That means users can write `{ KEY: ... }` in addition to `{ someField: ... }`.
 *
 * - If K extends keyof Document, then primitive values must match Document[K].
 * - If K === "KEY", then primitive values are treated as strings/Array<string>.
 */
export type Where<Document extends Record<string, unknown>> =
  | {
      [K in keyof Document | 'KEY']?:
        | Condition<Document, K extends keyof Document ? K : keyof Document>
        | (K extends keyof Document ? Document[K] : string)
        | (K extends keyof Document ? Array<Document[K]> : string[])
    }
  | {
      readonly AND?: Array<Where<Document>>
      readonly OR?: Array<Where<Document>>
      readonly NOT?: Where<Document>
    }

// -------------------------------------------------------------
// A tiny helper to escape/inline a single primitive into SQL.
// -------------------------------------------------------------
function inlineValue(value: unknown): string {
  if (typeof value === 'string') {
    return `'${(value as string).split("'").join("''")}'`
  }
  if (typeof value === 'number') {
    return (value as number).toString()
  }
  if (typeof value === 'boolean') {
    return (value as boolean) ? '1' : '0'
  }
  return `'${String(value).split("'").join("''")}'`
}

// -------------------------------------------------------------
// Build the expression for a given field.
// If field === "KEY", refer directly to the primary‐key column (`key`).
// Otherwise, extract from JSON `data`.
// -------------------------------------------------------------
function getFieldExpr(field: string, value: unknown, tableAlias?: string): string {
  const prefix = tableAlias ? `${tableAlias}.` : ''
  if (field === 'KEY') {
    // Use double‐quotes around key to avoid conflicts with reserved words
    return `"${prefix}key"`
  }

  // Otherwise, treat as JSON field under "data"
  if (typeof value === 'string') {
    return `CAST(json_extract(${prefix}data, '$.${field}') AS TEXT)`
  }
  if (typeof value === 'boolean') {
    return `CAST(json_extract(${prefix}data, '$.${field}') AS INTEGER)`
  }
  if (typeof value === 'number') {
    return `CAST(json_extract(${prefix}data, '$.${field}') AS NUMERIC)`
  }
  return `json_extract(${prefix}data, '$.${field}')`
}

// -------------------------------------------------------------
// Valid operators set (for quick membership checks).
// -------------------------------------------------------------
const OPS_SET: ReadonlySet<string> = new Set([
  'is',
  'isNot',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'notIn',
  'like',
])

function isUndefined(value: unknown): value is undefined {
  return value === undefined
}

// -------------------------------------------------------------
// Main recursive parser: turn a `Where<Document>` into a SQL clause
// (without the leading "WHERE").
// -------------------------------------------------------------
export function getWhere<Document extends Record<string, unknown>>(
  where: Where<Document>,
  tableAlias?: string,
): string {
  if (!where || typeof where !== 'object') {
    return ''
  }

  // ----- Logical branches: AND / OR / NOT -----
  if (!isUndefined(where.AND)) {
    const array = where.AND as Array<Where<Document>>
    if (Array.isArray(array) && array.length > 0) {
      let combined = ''
      let firstAdded = false
      for (const sub of array) {
        const clause = getWhere(sub, tableAlias)
        if (!clause) continue
        if (firstAdded) combined += ' AND '
        combined += clause
        firstAdded = true
      }
      return firstAdded ? `(${combined})` : ''
    }
    return ''
  }

  if (!isUndefined(where.OR)) {
    const array = where.OR as Array<Where<Document>>
    if (Array.isArray(array) && array.length > 0) {
      let combined = ''
      let firstAdded = false
      for (const sub of array) {
        const clause = getWhere(sub, tableAlias)
        if (!clause) continue
        if (firstAdded) combined += ' OR '
        combined += clause
        firstAdded = true
      }
      return firstAdded ? `(${combined})` : ''
    }
    return ''
  }

  if (!isUndefined(where.NOT)) {
    const sub = where.NOT as Where<Document>
    if (sub && typeof sub === 'object') {
      const clause = getWhere(sub, tableAlias)
      return clause ? `(NOT ${clause})` : ''
    }
    return ''
  }

  // ----- Field‐based conditions: default is AND across fields -----
  let fieldClauses = ''
  let anyFieldClause = false

  for (const key in where as Record<string, unknown>) {
    if (key === 'AND' || key === 'OR' || key === 'NOT') continue

    const rawValue = (where as Record<string, unknown>)[key]
    if (rawValue == null) continue

    // If the user provided a primitive or an array, coerce it to a Condition:
    //  - single primitive → { is: rawVal }
    //  - array           → { in: rawVal }
    let cond: Condition<Document, typeof key>
    if (typeof rawValue !== 'object' || Array.isArray(rawValue)) {
      cond = Array.isArray(rawValue)
        ? { in: rawValue }
        : ({ is: rawValue } as Condition<Document, typeof key>)
    } else {
      cond = rawValue as Condition<Document, typeof key>
    }

    // Iterate only over real operator keys that exist on this `cond`
    for (const opKey of Object.keys(cond) as Array<keyof typeof cond>) {
      if (!OPS_SET.has(opKey as string)) continue
      const rawOpValue = cond[opKey]
      if (rawOpValue == null) continue

      // Always treat it as an array for uniformity:
      const array = Array.isArray(rawOpValue) ? (rawOpValue as unknown[]) : [rawOpValue]
      if (array.length === 0) continue

      // Handle `is` / `isNot` / `in` / `notIn`
      if (opKey === 'is' || opKey === 'isNot' || opKey === 'in' || opKey === 'notIn') {
        const [firstValue] = array
        const fieldExpr = getFieldExpr(key, firstValue, tableAlias)

        // Build comma‐separated list without using `.map()`
        let inList = ''
        if (array.length > 1) {
          for (const [index, elt] of array.entries()) {
            if (index > 0) inList += ','
            inList += inlineValue(elt)
          }
        }

        switch (opKey) {
          case 'is': {
            fieldClauses +=
              array.length > 1
                ? (anyFieldClause ? ' AND ' : '') + `${fieldExpr} IN (${inList})`
                : (anyFieldClause ? ' AND ' : '') + `${fieldExpr} = ${inlineValue(array[0])}`
            break
          }
          case 'isNot': {
            fieldClauses +=
              array.length > 1
                ? (anyFieldClause ? ' AND ' : '') + `${fieldExpr} NOT IN (${inList})`
                : (anyFieldClause ? ' AND ' : '') + `${fieldExpr} <> ${inlineValue(array[0])}`
            break
          }
          case 'in': {
            fieldClauses +=
              array.length > 1
                ? (anyFieldClause ? ' AND ' : '') + `${fieldExpr} IN (${inList})`
                : (anyFieldClause ? ' AND ' : '') + `${fieldExpr} IN (${inlineValue(array[0])})`
            break
          }
          case 'notIn': {
            fieldClauses +=
              array.length > 1
                ? (anyFieldClause ? ' AND ' : '') + `${fieldExpr} NOT IN (${inList})`
                : (anyFieldClause ? ' AND ' : '') + `${fieldExpr} NOT IN (${inlineValue(array[0])})`
            break
          }
        }

        anyFieldClause = true
        continue
      }

      // Handle comparisons: gt, gte, lt, lte, like
      for (const v of array) {
        const fieldExpr = getFieldExpr(key, v, tableAlias)
        switch (opKey) {
          case 'gt': {
            fieldClauses += (anyFieldClause ? ' AND ' : '') + `${fieldExpr} > ${inlineValue(v)}`
            break
          }
          case 'gte': {
            fieldClauses += (anyFieldClause ? ' AND ' : '') + `${fieldExpr} >= ${inlineValue(v)}`
            break
          }
          case 'lt': {
            fieldClauses += (anyFieldClause ? ' AND ' : '') + `${fieldExpr} < ${inlineValue(v)}`
            break
          }
          case 'lte': {
            fieldClauses += (anyFieldClause ? ' AND ' : '') + `${fieldExpr} <= ${inlineValue(v)}`
            break
          }
          case 'like': {
            fieldClauses += (anyFieldClause ? ' AND ' : '') + `${fieldExpr} LIKE ${inlineValue(v)}`
            break
          }
        }
        anyFieldClause = true
      }
    }
  }

  return anyFieldClause ? `(${fieldClauses})` : ''
}

// -------------------------------------------------------------
// Wrap `parse(...)` in "WHERE (…)". If empty, return "".
// -------------------------------------------------------------
export function getWhereQuery<Document extends Record<string, unknown>>(
  where: Where<Document>,
): string {
  const clause = getWhere(where)
  return clause ? `WHERE ${clause}` : ''
}
