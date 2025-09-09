let stateId = 0
/**
 * Get a unique state ID
 * @returns The unique state ID
 */
export function getId(): string {
  stateId++
  return stateId.toString(36)
}
