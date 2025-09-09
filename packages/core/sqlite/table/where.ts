/* eslint-disable unicorn/no-array-callback-reference */
/* eslint-disable unicorn/no-nested-ternary */
/* eslint-disable no-nested-ternary */
/* eslint-disable sonarjs/no-nested-conditional */
/* eslint-disable sonarjs/cognitive-complexity */

// -------------------------------------------------------------
// Condition operators for each field
// -------------------------------------------------------------
interface Condition<T> {
  readonly is?: T | T[]
  readonly isNot?: T | T[]
  readonly gt?: T
  readonly gte?: T
  readonly lt?: T
  readonly lte?: T
  readonly in?: T[]
  readonly notIn?: T[]
  readonly like?: T | T[]
}

// -------------------------------------------------------------
// Where type: recursive object with operators or nested fields
// -------------------------------------------------------------
export type Where<T extends Record<string, unknown>> =
  | {
      [K in keyof T]?: T[K] extends Record<string, unknown>
        ? Where<T[K]> // nested object
        : Condition<T[K]> | T[K] | T[K][]
    }
  | {
      readonly AND?: Array<Where<T>>
      readonly OR?: Array<Where<T>>
      readonly NOT?: Where<T>
    }

/**
 * Inline a value for SQL query, with proper escaping for strings
 * @param value The value to inline
 * @returns The inlined value as a string
 */
function inlineValue(value: unknown): string {
  if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'boolean') return value ? '1' : '0'
  return `'${String(value).replaceAll("'", "''")}'`
}

/**
 * Get SQL expression for a field, with proper casting based on value type
 * @param field The field name
 * @param value The field value
 * @param tableAlias Optional table alias to prefix the field name
 * @returns The SQL expression for the field
 */
function getFieldExpr(field: string, value: unknown, tableAlias?: string): string {
  const prefix = tableAlias ? `${tableAlias}.` : ''
  if (field === 'KEY') {
    return `"${prefix}key"`
  }
  if (typeof value === 'string') return `CAST(json_extract(${prefix}data, '$.${field}') AS TEXT)`
  if (typeof value === 'number') return `CAST(json_extract(${prefix}data, '$.${field}') AS NUMERIC)`
  if (typeof value === 'boolean') return `CAST(json_extract(${prefix}data, '$.${field}') AS INTEGER)`
  return `json_extract(${prefix}data, '$.${field}')`
}

const OPS_SET: ReadonlySet<string> = new Set(['is', 'isNot', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'like'])

/**
 * Flatten a nested Where object into a single-level object with dot-separated keys
 * @param object The nested Where object
 * @param prefix The prefix for the current recursion level (used internally)
 * @returns A flattened object with dot-separated keys
 */
function flattenWhere(object: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [k, v] of Object.entries(object)) {
    if (k === 'AND' || k === 'OR' || k === 'NOT') {
      result[k] = v
      continue
    }

    const path = prefix ? `${prefix}.${k}` : k

    if (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).some((kk) => OPS_SET.has(kk))) {
      Object.assign(result, flattenWhere(v as Record<string, unknown>, path))
    } else {
      result[path] = v
    }
  }

  return result
}

/**
 * Write SQL WHERE clause from a Where object
 * @param where The Where object defining the conditions
 * @param tableAlias Optional table alias to prefix field names
 * @returns The SQL WHERE clause string (without the "WHERE" keyword)
 */
export function getWhere<T extends Record<string, unknown>>(where: Where<T>, tableAlias?: string): string {
  if (!where || typeof where !== 'object') return ''

  // ----- Logical branches -----
  if (where.AND) {
    const clauses = Array.isArray(where.AND) ? where.AND.map((w) => getWhere(w, tableAlias)).filter(Boolean) : []
    return clauses.length > 0 ? `(${clauses.join(' AND ')})` : ''
  }

  if (where.OR) {
    const clauses = Array.isArray(where.OR) ? where.OR.map((w) => getWhere(w, tableAlias)).filter(Boolean) : []
    return clauses.length > 0 ? `(${clauses.join(' OR ')})` : ''
  }

  if (where.NOT) {
    const clause = getWhere(where.NOT, tableAlias)
    return clause ? `(NOT ${clause})` : ''
  }

  // ----- Field conditions -----
  const flat = flattenWhere(where as Record<string, unknown>)
  let fieldClauses = ''
  let anyField = false

  for (const [key, rawValue] of Object.entries(flat)) {
    if (rawValue == null) continue

    // coerce primitive/array into Condition
    let cond: Condition<unknown>
    if (typeof rawValue !== 'object' || Array.isArray(rawValue)) {
      cond = Array.isArray(rawValue) ? { in: rawValue } : { is: rawValue }
    } else {
      cond = rawValue as Condition<unknown>
    }

    for (const opKey of Object.keys(cond)) {
      if (!OPS_SET.has(opKey)) continue
      const opValue = cond[opKey as keyof Condition<unknown>]
      if (opValue == null) continue

      const values = Array.isArray(opValue) ? opValue : [opValue]
      if (values.length === 0) continue

      // is / isNot / in / notIn
      if (opKey === 'is' || opKey === 'isNot' || opKey === 'in' || opKey === 'notIn') {
        const fieldExpr = getFieldExpr(key, values[0], tableAlias)
        const inList = values.map(inlineValue).join(',')

        const clause =
          opKey === 'is'
            ? values.length > 1
              ? `${fieldExpr} IN (${inList})`
              : `${fieldExpr} = ${inlineValue(values[0])}`
            : opKey === 'isNot'
              ? values.length > 1
                ? `${fieldExpr} NOT IN (${inList})`
                : `${fieldExpr} <> ${inlineValue(values[0])}`
              : opKey === 'in'
                ? `${fieldExpr} IN (${inList})`
                : `${fieldExpr} NOT IN (${inList})`

        fieldClauses += (anyField ? ' AND ' : '') + clause
        anyField = true
        continue
      }

      // gt / gte / lt / lte / like
      for (const v of values) {
        const fieldExpr = getFieldExpr(key, v, tableAlias)
        const clause =
          opKey === 'gt'
            ? `${fieldExpr} > ${inlineValue(v)}`
            : opKey === 'gte'
              ? `${fieldExpr} >= ${inlineValue(v)}`
              : opKey === 'lt'
                ? `${fieldExpr} < ${inlineValue(v)}`
                : opKey === 'lte'
                  ? `${fieldExpr} <= ${inlineValue(v)}`
                  : `${fieldExpr} LIKE ${inlineValue(v)}`
        fieldClauses += (anyField ? ' AND ' : '') + clause
        anyField = true
      }
    }
  }

  return anyField ? `(${fieldClauses})` : ''
}

/**
 * Get SQL WHERE clause from a Where object
 * @param where The Where object defining the conditions
 * @returns The SQL WHERE clause string (without the "WHERE" keyword)
 */
export function getWhereQuery<T extends Record<string, unknown>>(where?: Where<T>): string {
  if (!where) return ''
  const clause = getWhere(where)
  return clause ? `WHERE ${clause}` : ''
}
