export type EmitterSubscribe<P = undefined> = (listener: (...params: P[]) => void) => () => void
export interface Emitter<T, P = undefined> {
  subscribe: EmitterSubscribe<P>
  subscribeToOtherEmitter: (emitter: Emitter<unknown>) => void
  getSnapshot: () => T
  emit: (...params: P[]) => void
  getSize: () => number
  clear: () => void
  contains: (listener: (...params: P[]) => void) => boolean
}

/**
 * Generics parameters are:
 * T: Type of the state
 * R: Type of the snapshot
 * P: Type of the parameters
 * @param getSnapshot
 * @returns
 */
export function createEmitter<T, P = undefined>(getSnapshot: () => T): Emitter<T, P> {
  const listeners = new Set<(...params: P[]) => void>()
  const otherCleaners: Array<() => void> = []
  return {
    clear: () => {
      for (const cleaner of otherCleaners) {
        cleaner()
      }
      listeners.clear()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    emit: (...params) => {
      for (const listener of listeners) {
        listener(...params)
      }
    },
    contains: (listener) => listeners.has(listener),
    getSnapshot,
    getSize: () => listeners.size,
    subscribeToOtherEmitter(emitter) {
      const clean = emitter.subscribe(() => {
        this.emit()
      })
      otherCleaners.push(clean)
    },
  }
}
