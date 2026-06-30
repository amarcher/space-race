// A tiny typed WebSocket client for the GTV Arcade daemon (:8771), ported from
// gtv-arcade/web/arcade.js with the RELAY layer (directed/private messages) and a
// CONFIGURABLE origin (the game runs on Vite/Vercel, the daemon on a different
// host:port — see mode.ts). Auto-reconnects with capped backoff. Dependency-free.
//
// The daemon's Origin allow-list passes us because it matches on the HOSTNAME
// (localhost / the Mac's LAN IP) regardless of port, so a cross-origin connect
// from http://localhost:5180 or http://<lan-ip>:5180 is accepted.

export type ArcadeRole = 'stage' | 'controller'
export type ArcadeStatus = 'connecting' | 'open' | 'closed'

type RelayCb = (from: number, payload: unknown, kind: 'from_stage' | 'from_controller') => void

export interface RosterEntry {
  id: number
  role: ArcadeRole
}

/** The relay app's broadcast `state`: the connected-client roster. */
export interface RelayRoomState {
  app?: string
  clients?: RosterEntry[]
}

export class ArcadeClient {
  role: ArcadeRole
  id: number | null = null
  app: string | null = null

  private wsUrl: string
  private ws: WebSocket | null = null
  private stateCb: ((s: RelayRoomState) => void) | null = null
  private statusCb: ((s: ArcadeStatus) => void) | null = null
  private welcomeCb: ((info: { id: number; role: ArcadeRole }) => void) | null = null
  private relayCb: RelayCb | null = null
  private backoff = 250
  private readonly backoffMax = 5000
  private closedByUs = false

  constructor(role: ArcadeRole, originBase: string) {
    this.role = role
    // originBase like "ws://192.168.4.38:8771"
    this.wsUrl = `${originBase}/ws?role=${encodeURIComponent(role)}`
    this.connect()
  }

  onState(cb: (s: RelayRoomState) => void) { this.stateCb = cb; return this }
  onStatus(cb: (s: ArcadeStatus) => void) { this.statusCb = cb; return this }
  onWelcome(cb: (info: { id: number; role: ArcadeRole }) => void) { this.welcomeCb = cb; return this }
  onRelay(cb: RelayCb) { this.relayCb = cb; return this }

  private status(s: ArcadeStatus) {
    if (this.statusCb) { try { this.statusCb(s) } catch { /* ignore */ } }
  }

  private connect() {
    this.status('connecting')
    let ws: WebSocket
    try {
      ws = new WebSocket(this.wsUrl)
    } catch {
      this.scheduleReconnect()
      return
    }
    this.ws = ws
    ws.onopen = () => { this.backoff = 250; this.status('open') }
    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>
      try { msg = JSON.parse(ev.data as string) } catch { return }
      if (!msg || typeof msg !== 'object') return
      const t = msg.type
      if (t === 'state') {
        if (this.stateCb) { try { this.stateCb(msg.state as RelayRoomState) } catch { /* ignore */ } }
      } else if (t === 'welcome') {
        this.id = msg.id as number
        this.role = msg.role as ArcadeRole
        this.app = (msg.app as string) ?? null
        if (this.welcomeCb) { try { this.welcomeCb({ id: this.id, role: this.role }) } catch { /* ignore */ } }
      } else if (t === 'app') {
        this.app = (msg.app as string) ?? null
      } else if (t === 'from_stage' || t === 'from_controller') {
        if (this.relayCb) {
          try { this.relayCb(msg.from as number, msg.payload, t) } catch { /* ignore */ }
        }
      }
    }
    ws.onclose = () => {
      this.status('closed')
      if (!this.closedByUs) this.scheduleReconnect()
    }
    ws.onerror = () => { try { ws.close() } catch { /* ignore */ } }
  }

  private scheduleReconnect() {
    const wait = this.backoff
    this.backoff = Math.min(this.backoffMax, this.backoff * 2)
    setTimeout(() => this.connect(), wait)
  }

  private send(obj: unknown): boolean {
    const ws = this.ws
    if (!ws || ws.readyState !== 1) return false // 1 === OPEN
    try { ws.send(JSON.stringify(obj)); return true } catch { return false }
  }

  // ---- relay helpers -------------------------------------------------------
  sendToStage(payload: unknown) { return this.send({ type: 'to_stage', payload }) }
  sendToController(id: number, payload: unknown) { return this.send({ type: 'to_controller', to: id, payload }) }
  sendToAll(payload: unknown) { return this.send({ type: 'to_all', payload }) }

  close() {
    this.closedByUs = true
    if (this.ws) { try { this.ws.close() } catch { /* ignore */ } }
  }
}
