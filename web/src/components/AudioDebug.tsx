import { useEffect, useState } from 'react'
import { audioDebugBeep, audioDebugRms, audioDebugState, playSfx, setMuted } from '../audio/sfx'

/**
 * Hidden audio diagnostic panel — opened by 7 quick taps on the header title
 * (see Table.tsx). Exists to debug "the app is silent" ON DEVICE, where there's
 * no console: shows every pipeline stage plus a live output-signal meter, and
 * two test tones that isolate the asset pipeline from output routing.
 *
 *   - BEEP  = pure oscillator through the master chain (no fetch/decode)
 *   - SFX   = a real decoded sample (the full pipeline)
 *   - meter = RMS of the final mix; moving bar + silent device ⇒ OS routing,
 *             flat bar ⇒ the web pipeline never produced signal
 */
export function AudioDebug({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState(audioDebugState())
  const [rms, setRms] = useState(-1)
  const [peak, setPeak] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => {
      setState(audioDebugState())
      const r = audioDebugRms()
      setRms(r)
      setPeak((p) => Math.max(p, r))
    }, 200)
    return () => window.clearInterval(t)
  }, [])
  const row = (k: string, v: string | number | boolean, bad = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ opacity: 0.7 }}>{k}</span>
      <b style={{ color: bad ? '#ff7a8a' : '#7df0a0' }}>{String(v)}</b>
    </div>
  )
  return (
    <div
      style={{
        position: 'fixed',
        left: 10,
        bottom: 10,
        zIndex: 999,
        width: 250,
        padding: '10px 12px',
        borderRadius: 12,
        background: 'rgba(4, 6, 20, 0.94)',
        border: '1px solid rgba(125, 240, 255, 0.5)',
        color: '#fff',
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: 11,
        lineHeight: 1.7,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <b style={{ color: '#7df0ff' }}>AUDIO DEBUG</b>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 12 }}>
          ✕
        </button>
      </div>
      {row('context', state.ctxState, state.ctxState !== 'running')}
      {row('unlocked', state.unlocked, !state.unlocked)}
      {row('buffers', `${state.buffers}/11`, state.buffers < 11)}
      {row('fetch fails', state.fetchFails, state.fetchFails > 0)}
      {row('muted', state.muted, state.muted)}
      {row('master gain', state.masterGain.toFixed(2), state.masterGain === 0)}
      {row('plays fired', state.plays)}
      {row('out peak', peak.toFixed(4), peak === 0)}
      {state.lastLoadError && (
        <div style={{ color: '#ff7a8a', wordBreak: 'break-all', fontSize: 10, lineHeight: 1.4 }}>
          {state.lastLoadError}
        </div>
      )}
      <div style={{ height: 6, borderRadius: 3, background: '#222', margin: '6px 0' }}>
        <div
          style={{
            height: '100%',
            borderRadius: 3,
            width: `${Math.min(100, Math.max(rms > 0 ? 4 : 0, rms * 300))}%`,
            background: '#7df0a0',
            transition: 'width 120ms linear',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => audioDebugBeep()} style={btn}>
          BEEP
        </button>
        <button onClick={() => playSfx('warp')} style={btn}>
          SFX
        </button>
        <button onClick={() => setMuted(false)} style={btn}>
          UNMUTE
        </button>
      </div>
    </div>
  )
}

const btn: React.CSSProperties = {
  flex: 1,
  padding: '6px 0',
  borderRadius: 8,
  border: '1px solid rgba(125, 240, 255, 0.5)',
  background: 'rgba(20, 40, 70, 0.8)',
  color: '#7df0ff',
  fontSize: 11,
  fontWeight: 700,
}
