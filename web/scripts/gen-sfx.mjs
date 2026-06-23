// One-off generator for the game's sound effects via the ElevenLabs Sound
// Effects API. Reads the API key from ONE source (in priority order), never
// prints the key (logs only its length), and writes each clip to
// web/public/sfx/<name>.mp3.
//
//   node web/scripts/gen-sfx.mjs            # generate any missing clips
//   node web/scripts/gen-sfx.mjs --force    # regenerate all
//
// Key sources, first that resolves wins (a key is NEVER printed or committed):
//   1. $ELEVENLABS_API_KEY (or the var named by $SFX_KEY_VAR) in the environment
//   2. web/.env.local        (ELEVENLABS_API_KEY=… line; gitignored)
//   3. ~/.elevenlabs/api_key  (the elevenlabs CLI's stored key — raw text)
//
// Short, game-y, kid-friendly prompts; prompt_influence 0.3; durations 0.3–3s.

import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..') // .../space-race
const OUT_DIR = resolve(REPO_ROOT, 'web', 'public', 'sfx')

const ENV_LOCAL_FILE = resolve(REPO_ROOT, 'web', '.env.local') // gitignored, never committed
const CLI_KEY_FILE = resolve(homedir(), '.elevenlabs', 'api_key')

// ElevenLabs keys are `sk_` + base62; strip anything outside that charset (a BOM
// / newline / stray whitespace would otherwise 401). Tolerates undefined input.
const sanitize = (s) => (s ?? '').replace(/[^A-Za-z0-9_]/g, '')

// pull ELEVENLABS_API_KEY=... out of a dotenv file without depending on dotenv
function keyFromEnvFile(file) {
  if (!existsSync(file)) return ''
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$/)
    if (m) return sanitize(m[1].replace(/^["']|["']$/g, ''))
  }
  return ''
}

function loadKey() {
  // 1) the process environment
  const fromEnv = sanitize(process.env[process.env.SFX_KEY_VAR || 'ELEVENLABS_API_KEY'])
  if (fromEnv) return { key: fromEnv, source: '$ELEVENLABS_API_KEY' }

  // 2) the project-local, gitignored web/.env.local
  const fromLocal = keyFromEnvFile(ENV_LOCAL_FILE)
  if (fromLocal) return { key: fromLocal, source: 'web/.env.local' }

  // 3) the elevenlabs CLI's stored key (raw text, single line)
  if (existsSync(CLI_KEY_FILE)) {
    const val = sanitize(readFileSync(CLI_KEY_FILE, 'utf8'))
    if (val) return { key: val, source: '~/.elevenlabs/api_key' }
  }

  throw new Error(
    `No ElevenLabs key found. Set $ELEVENLABS_API_KEY, add ELEVENLABS_API_KEY=… to ${ENV_LOCAL_FILE}, or store it at ${CLI_KEY_FILE}.`,
  )
}

// name -> { prompt, duration }. Kept short and punchy; the engine adds rate
// jitter so even repeated triggers stay fresh.
const SFX = {
  'card-flick': { prompt: 'quick card flick swoosh, clean UI, very short', duration: 0.5 },
  distance: { prompt: 'spaceship thruster accelerate whoosh, short', duration: 1.1 },
  // CARD-TAKEOVER cues — these now play UNDER a full-screen ~2.5s hero moment, so
  // they earn a little more body than a routine one-shot (low-end on the hazard
  // impact, a clean bell on remedy, a bright fanfare on safety, a big whoosh on
  // warp) while staying short + non-fatiguing on repeat.
  hazard: {
    prompt:
      'heavy sci-fi impact: deep sub-bass boom and metal crunch on the hit, then an electrical short-circuit spark and a brief malfunction alarm blip',
    duration: 1.4,
  },
  remedy: {
    prompt: 'bright clean confirm chime, a single glassy bell ding with a warm power-restore hum underneath, hopeful, short',
    duration: 1.0,
  },
  safety: {
    prompt: 'short bright triumphant fanfare with a sparkling energy-shield shimmer rising over it, heroic sci-fi, uplifting',
    duration: 1.2,
  },
  warp: { prompt: 'powerful hyperspace jump: a deep rising whoosh that launches into a fast streaking warp, big and cinematic', duration: 1.8 },
  slingshot: { prompt: 'triumphant sci-fi stinger, quick, bright', duration: 1.2 },
  win: { prompt: 'short cheerful victory chime, kids game, bright and happy', duration: 1.8 },
  // WIN takeover — a fuller triumphant swell that lands as the tally rises over the
  // ~3.8s hero hold: a rising orchestral/synth swell building into a bright happy
  // hit with a sparkle tail. Bigger and more cinematic than the plain `win` chime.
  'win-takeover': {
    prompt:
      'triumphant victory swell for a kids space game: a warm rising synth-and-brass crescendo that blooms into a bright cheerful chord hit with a sparkling magical tail, joyful and celebratory',
    duration: 3.0,
  },
  // LOSS takeover — DISTINCT from win: dignified, soft, gentle. A calm descending
  // pad with a single warm low tone resolving — encouraging, never harsh or sad.
  'lose-takeover': {
    prompt:
      'gentle dignified end tone for a kids space game, NOT a victory chime: a soft warm descending synth pad with a single low resolving note, calm and reassuring, a graceful "good try" feeling, no harsh sounds',
    duration: 2.6,
  },
  'ui-click': { prompt: 'soft UI click, subtle, very short', duration: 0.5 }, // API min is 0.5s
}

const ENDPOINT = 'https://api.elevenlabs.io/v1/sound-generation'

async function generate(name, { prompt, duration }, key) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text: prompt, duration_seconds: duration, prompt_influence: 0.3 }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${name}: HTTP ${res.status} ${res.statusText} ${body.slice(0, 200)}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const out = resolve(OUT_DIR, `${name}.mp3`)
  writeFileSync(out, buf)
  return buf.length
}

async function main() {
  const force = process.argv.includes('--force')
  mkdirSync(OUT_DIR, { recursive: true })

  // the key is loaded lazily — only when something actually needs generating, so
  // a verify run with all clips already present needs no key
  let cred = null
  const key = () => {
    if (!cred) {
      cred = loadKey()
      console.log(`Using key from ${cred.source} (len ${cred.key.length}, starts sk_: ${cred.key.startsWith('sk_')})`)
    }
    return cred.key
  }

  let total = 0
  for (const [name, spec] of Object.entries(SFX)) {
    const out = resolve(OUT_DIR, `${name}.mp3`)
    if (!force && existsSync(out) && statSync(out).size > 0) {
      const size = statSync(out).size
      total += size
      console.log(`  skip  ${name.padEnd(11)} (exists, ${(size / 1024).toFixed(1)} KB)`)
      continue
    }
    process.stdout.write(`  gen   ${name.padEnd(11)} …`)
    try {
      const size = await generate(name, spec, key())
      total += size
      console.log(` ${(size / 1024).toFixed(1)} KB`)
    } catch (e) {
      console.log(` FAILED: ${e.message}`)
      process.exitCode = 1
    }
  }
  console.log(`Total: ${(total / 1024).toFixed(1)} KB across ${Object.keys(SFX).length} clips`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
