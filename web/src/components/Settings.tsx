// Settings modal — home of the selectable Gameplay Modes. Settings text is fine
// here (the no-words rule is for the PLAY surface, not the settings sheet).
//
// The toggles persist to localStorage and apply to the NEXT new game/round. If
// the player flips a toggle mid-game, we surface a subtle "takes effect next
// game" note rather than mutating the live rules.
import { useState } from 'react'
import type { GameRules } from '../game/rules'
import { saveRules } from '../settings'
import { playSfx } from '../audio/sfx'
import { Icon } from './Icon'
import './Settings.css'

interface SettingsProps {
  rules: GameRules
  /** persist + lift the chosen rules; the parent applies them on the next new game */
  onChange: (rules: GameRules) => void
  onClose: () => void
  /** true while a game is actually in progress → show the "next game" note */
  gameInProgress: boolean
}

export function Settings({ rules, onChange, onClose, gameInProgress }: SettingsProps) {
  // local mirror so the toggle flips instantly; persisted + lifted on each change
  const [draft, setDraft] = useState<GameRules>(rules)
  // becomes true once the user changes anything during a live game
  const [touched, setTouched] = useState(false)

  const set = <K extends keyof GameRules>(key: K, value: GameRules[K]) => {
    const next = { ...draft, [key]: value }
    setDraft(next)
    saveRules(next)
    onChange(next)
    if (gameInProgress) setTouched(true)
    playSfx('ui-click')
  }

  return (
    <div className="settings" onClick={onClose}>
      <div className="settings__sheet" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <header className="settings__head">
          <h2 className="settings__title">Settings</h2>
          <button className="settings__close" onClick={onClose} aria-label="Close settings" title="Close">
            ✕
          </button>
        </header>

        <section className="settings__section">
          <h3 className="settings__section-title">Gameplay</h3>

          <Toggle
            label="Scry draw"
            help="Peek at the top 3 cards and pick one."
            checked={draft.scry}
            onChange={(v) => set('scry', v)}
          />

          <Toggle
            label="Momentum meter"
            help="Bank a charge each time you advance; spend a full meter for a free double-jump."
            checked={draft.momentum}
            onChange={(v) => set('momentum', v)}
          />
        </section>

        {touched && (
          <p className="settings__note" role="status">
            <Icon name="restart" /> Takes effect on the next game.
          </p>
        )}
      </div>
    </div>
  )
}

function Toggle({
  label,
  help,
  checked,
  onChange,
}: {
  label: string
  help: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="toggle">
      <span className="toggle__text">
        <span className="toggle__label">{label}</span>
        <span className="toggle__help">{help}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`toggle__switch ${checked ? 'toggle__switch--on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle__knob" />
      </button>
    </label>
  )
}
