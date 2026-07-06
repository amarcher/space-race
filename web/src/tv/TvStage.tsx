// TV SPECTATOR — a one-way mirror of the phone's game.
//
// The phone (`?mode=tv-play`) runs the REAL game (engine + AI) and broadcasts its
// GameState to the relay. This TV (`?mode=tv-stage`) connects as a receiver,
// gets each broadcast, and renders the EXISTING <TableView> READ-ONLY (no `play`
// prop → static board / piles / icon-log, hand hidden). It submits NOTHING and
// holds no game logic — it just reflects whatever the phone publishes. With no
// `?mode=` flag this file never mounts.

import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../game'
import { TableView } from '../components/TableView'
import { ArcadeClient } from './arcadeClient'
import { arcadeOrigin } from './mode'
import '../components/Table.css' // the real table layout (gutter icon log, plane tilt, piles)
import './Tv.css'

export function TvStage() {
  const [game, setGame] = useState<GameState | null>(null)
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting')
  const clientRef = useRef<ArcadeClient | null>(null)

  useEffect(() => {
    const c = new ArcadeClient('controller', arcadeOrigin())
    clientRef.current = c
    c.onStatus(setStatus)
    // every phone broadcast arrives as a relay `from_stage` payload = the GameState
    c.onRelay((_from, payload) => {
      if (payload && typeof payload === 'object') setGame(payload as GameState)
    })
    return () => c.close()
  }, [])

  const turnLabel = !game
    ? 'Waiting for a player…'
    : game.phase === 'roundOver'
      ? game.winner != null
        ? `${game.players[game.winner].name} wins!`
        : 'Round over'
      : game.players[game.turn].name === 'You'
        ? `Your turn — ${game.phase}`
        : `${game.players[game.turn].name}'s turn — ${game.phase}`

  return (
    <div className="tv-stage-root">
      <div className="table">
        <header className="table__bar">
          <h1>Space Race</h1>
          <div className="table__bar-actions tv__bar-meta">
            <span className="tv__turn">{turnLabel}</span>
            <span className={`tv__conn tv__conn--${status}`} title={`arcade: ${arcadeOrigin()}`}>
              {status === 'open' ? (game ? 'live' : 'connected') : status}
            </span>
          </div>
        </header>

        {game ? (
          // the SAME presenter the normal app uses, read-only (no play bundle)
          <TableView game={game} showLog />
        ) : (
          <div className="tv__wait">
            <p>Mirroring your game…</p>
            <p className="tv__hint">
              Open the game on your phone with <b>?mode=tv-play</b> to spectate it here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
