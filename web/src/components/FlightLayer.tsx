import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { FLIGHT_MS, type Rect } from '../motion'
import { Card } from './Card'
import './FlightLayer.css'

export interface FlightSpec {
  from: Rect
  to: Rect
  /** card kind to show in flight; omit (with faceDown) for a deck back */
  kind?: string
  faceDown?: boolean
}

interface ActiveFlight extends FlightSpec {
  id: number
  spin: number
}

/**
 * A queue of cards tweening between piles. `fly()` returns a promise that
 * resolves when the card lands — callers defer the actual state commit until
 * then, so the card is never in two places at once.
 */
export function useFlights() {
  const [flights, setFlights] = useState<ActiveFlight[]>([])
  const idRef = useRef(0)

  const fly = useCallback((spec: FlightSpec): Promise<void> => {
    return new Promise((resolve) => {
      const id = ++idRef.current
      // a little alternating spin so back-to-back flights don't look stamped out
      const spin = (id % 2 === 0 ? 1 : -1) * (4 + (id % 5))
      setFlights((f) => [...f, { ...spec, id, spin }])
      window.setTimeout(() => {
        setFlights((f) => f.filter((x) => x.id !== id))
        resolve()
      }, FLIGHT_MS)
    })
  }, [])

  return { flights, fly }
}

function Flight({ f }: { f: ActiveFlight }) {
  // start parked over the source, then on the next frame slide to the target so
  // the CSS transition has two distinct states to animate between.
  const [go, setGo] = useState(false)
  useLayoutEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)))
    return () => cancelAnimationFrame(r)
  }, [])

  const dx = f.to.left - f.from.left
  const dy = f.to.top - f.from.top
  const scale = f.to.width / f.from.width

  return (
    <div
      className="flight"
      style={{
        left: `${f.from.left}px`,
        top: `${f.from.top}px`,
        width: `${f.from.width}px`,
        transform: go
          ? `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${f.spin}deg)`
          : 'translate(0px, 0px) scale(1) rotate(0deg)',
      }}
    >
      <Card kind={f.kind} faceDown={f.faceDown} size="md" showName={false} />
    </div>
  )
}

export function FlightLayer({ flights }: { flights: ActiveFlight[] }) {
  return (
    <div className="flightlayer" aria-hidden>
      {flights.map((f) => (
        <Flight key={f.id} f={f} />
      ))}
    </div>
  )
}
