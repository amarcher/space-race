import { useSyncExternalStore } from 'react'
import { isMuted, subscribeMuted } from './sfx'

/** Reactive mute state for the header toggle. */
export function useMuted(): boolean {
  return useSyncExternalStore(subscribeMuted, isMuted, isMuted)
}
