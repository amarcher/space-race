import { useCallback, useRef } from 'react'

/** Returns a STABLE function identity that always invokes the LATEST callback.
 * Lets a once-registered WebSocket handler read fresh React state/closures
 * without re-subscribing on every render. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useCallbackRef<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn)
  ref.current = fn
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(((...args: unknown[]) => ref.current(...args)) as T, [])
}
