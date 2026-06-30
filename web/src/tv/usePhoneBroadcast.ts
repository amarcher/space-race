import { useCallback, useEffect, useRef } from 'react'
import type { GameState } from '../game'
import { ArcadeClient, type RelayRoomState } from './arcadeClient'
import { arcadeHttpOrigin, arcadeOrigin } from './mode'

// PHONE → TV broadcast (one-way). The phone connects to the arcade relay as the
// authoritative `stage` and pushes its full GameState to every connected TV
// (`to_all` → each TV receives it as `from_stage`). The TV submits nothing back.
//
// Privacy: hands NEVER leave the phone. We redact both players' `hand` to []
// before broadcasting — the TV's read-only <TableView> renders the board/piles/
// log (distance piles, battle lanes, safeties), not hands, so it needs no hand
// data. This means even a rogue LAN client that connects can't read the hand.

function redact(game: GameState): GameState {
  return { ...game, players: game.players.map((p) => ({ ...p, hand: [] })) }
}

/** Returns a STABLE `broadcast(game)` to call on every game-state change. Opens
 * the relay socket once; re-broadcasts the latest state when a new TV connects
 * (so a late-joining spectator syncs immediately). No-op until the socket opens. */
export function usePhoneBroadcast(): (game: GameState) => void {
  const clientRef = useRef<ArcadeClient | null>(null)
  const lastRef = useRef<GameState | null>(null)
  const peerCountRef = useRef(0)

  useEffect(() => {
    // best-effort: select the relay app so its broadcast `state` is the tiny client
    // roster (lets us detect a late-joining TV) rather than the laser app's 30 Hz
    // cursor state. Harmless if it's already relay; the WS reconnect covers a miss.
    fetch(`${arcadeHttpOrigin()}/app?name=relay`).catch(() => {})
    const c = new ArcadeClient('stage', arcadeOrigin())
    clientRef.current = c
    // When the roster GROWS (a TV connected), re-send the latest state once so the
    // newcomer mirrors immediately instead of waiting for the next move. Gated on a
    // count increase so the 30 Hz roster broadcast doesn't spam GameState.
    c.onState((s: RelayRoomState) => {
      const n = (s.clients ?? []).length
      if (n > peerCountRef.current && lastRef.current) c.sendToAll(redact(lastRef.current))
      peerCountRef.current = n
    })
    return () => c.close()
  }, [])

  return useCallback((game: GameState) => {
    lastRef.current = game
    clientRef.current?.sendToAll(redact(game))
  }, [])
}
