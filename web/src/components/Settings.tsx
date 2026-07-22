// Settings modal — home of the selectable Gameplay Modes. Settings text is fine
// here (the no-words rule is for the PLAY surface, not the settings sheet).
//
// The toggles persist to localStorage and apply to the NEXT new game/round. If
// the player flips a toggle mid-game, we surface a subtle "takes effect next
// game" note rather than mutating the live rules.
import { useState } from 'react'
import { SCRY_REVEAL, type GameRules } from '../game/rules'
import { saveRules } from '../settings'
import { LABEL_HIDE_GAMES, type Prefs } from '../prefs'
import { playSfx } from '../audio/sfx'
import { Icon } from './Icon'
import './Settings.css'

interface SettingsProps {
  rules: GameRules
  /** persist + lift the chosen rules; the parent applies them on the next new game */
  onChange: (rules: GameRules) => void
  /** interface prefs — the parent persists them and applies them IMMEDIATELY
   * (they're presentation/flow, not game rules, so no "next game" gate) */
  prefs: Prefs
  onChangePrefs: (prefs: Prefs) => void
  onClose: () => void
  /** true while a game is actually in progress → show the "next game" note */
  gameInProgress: boolean
}

export function Settings({ rules, onChange, prefs, onChangePrefs, onClose, gameInProgress }: SettingsProps) {
  // local mirror so the toggle flips instantly; persisted + lifted on each change
  const [draft, setDraft] = useState<GameRules>(rules)
  const [prefsDraft, setPrefsDraft] = useState<Prefs>(prefs)
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

  const setPref = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    const next = { ...prefsDraft, [key]: value }
    setPrefsDraft(next)
    onChangePrefs(next) // applies immediately — no "next game" note
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
            help="Peek at the top cards and pick one."
            checked={draft.scry}
            onChange={(v) => set('scry', v)}
          />

          {draft.scry && (
            <Choice
              label="Cards to peek"
              help="How many top-of-deck cards a scry draw reveals."
              value={draft.scryReveal ?? SCRY_REVEAL}
              options={[2, 3]}
              onChange={(v) => set('scryReveal', v)}
            />
          )}

          <Toggle
            label="Catch-up valve"
            help="When you fall far behind, your next draw lets you scout the stars and pick the card you need."
            checked={draft.catchUp}
            onChange={(v) => set('catchUp', v)}
          />

          <Toggle
            label="Momentum meter"
            help="Bank a charge each time you advance; spend a full meter for a free double-jump."
            checked={draft.momentum}
            onChange={(v) => set('momentum', v)}
          />

          <Toggle
            label="Self-healing hazards"
            help="Blocking hazards clear themselves after a few turns."
            checked={draft.selfHeal}
            onChange={(v) => set('selfHeal', v)}
          />
        </section>

        <section className="settings__section">
          <h3 className="settings__section-title">Interface</h3>

          <Toggle
            label="Auto-hide card labels"
            help={`Stop naming cards over the art once you've played ${LABEL_HIDE_GAMES} games — by then you know them.`}
            checked={prefsDraft.autoHideLabels}
            onChange={(v) => setPref('autoHideLabels', v)}
          />

          <Toggle
            label="Auto-draw"
            help="When the discard pile is empty there's nothing to pick up — start your turn by drawing automatically."
            checked={prefsDraft.autoDraw}
            onChange={(v) => setPref('autoDraw', v)}
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

/** A small segmented selector for a numeric rule dial (e.g. scry reveal: 2 / 3). */
function Choice({
  label,
  help,
  value,
  options,
  onChange,
}: {
  label: string
  help: string
  value: number
  options: number[]
  onChange: (v: number) => void
}) {
  return (
    <div className="toggle choice">
      <span className="toggle__text">
        <span className="toggle__label">{label}</span>
        <span className="toggle__help">{help}</span>
      </span>
      <div className="choice__seg" role="radiogroup" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={value === opt}
            className={`choice__opt ${value === opt ? 'choice__opt--on' : ''}`}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}
