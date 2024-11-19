export type EmitterSubscribe<P = undefined> = (listener: (...params: P[]) => void) => () => void
export interface Emitter<T, R = T, P = undefined> {
  subscribe: EmitterSubscribe<P>
  getSnapshot: () => R
  emit: (...params: P[]) => void
  size: number
  clear: () => void
}

export function createEmitter<T, R = T, P = undefined>(getSnapshot: () => R): Emitter<T, R, P> {
  const listeners = new Set<(...params: P[]) => void>()
  return {
    clear: () => {
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
    getSnapshot,
    size: listeners.size,
  }
}
