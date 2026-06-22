// One-off generator for the game's sound effects via the ElevenLabs Sound
// Effects API. Reads the API key from ONE source (in priority order), never
// prints the key (logs only its length), and writes each clip to
// web/public/sfx/<name>.mp3.
//
//   node web/scripts/gen-sfx.mjs            # generate any missing clips
//   node web/scripts/gen-sfx.mjs --force    # regenerate all
//
// Key sources, first that resolves wins:
//   1. $ELEVENLABS_API_KEY (or the var named by $SFX_KEY_VAR) in the environment
//   2. ~/.elevenlabs/api_key  (the elevenlabs CLI's stored key — raw text)
//
// Short, game-y, kid-friendly prompts; prompt_influence 0.3; durations 0.3–3s.

import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..') // .../space-race
const OUT_DIR = resolve(REPO_ROOT, 'web', 'public', 'sfx')

const CLI_KEY_FILE = resolve(homedir(), '.elevenlabs', 'api_key')

// ElevenLabs keys are `sk_` + base62; strip anything outside that charset (a BOM
// / newline / stray whitespace would otherwise 401). Tolerates undefined input.
const sanitize = (s) => (s ?? '').replace(/[^A-Za-z0-9_]/g, '')

function loadKey() {
  // 1) explicit env var (e.g. ELEVENLABS_API_KEY="$(cat ~/.elevenlabs/api_key)")
  const envName = process.env.SFX_KEY_VAR || 'ELEVENLABS_API_KEY'
  const fromEnv = sanitize(process.env[envName])
  if (fromEnv) return { key: fromEnv, source: `$${envName}` }

  // 2) the elevenlabs CLI's stored key (raw text, single line)
  if (existsSync(CLI_KEY_FILE)) {
    const val = sanitize(readFileSync(CLI_KEY_FILE, 'utf8'))
    if (val) return { key: val, source: '~/.elevenlabs/api_key' }
  }

  throw new Error(`No ElevenLabs key found. Set $ELEVENLABS_API_KEY or store it at ${CLI_KEY_FILE}.`)
}

// name -> { prompt, duration }. Kept short and punchy; the engine adds rate
// jitter so even repeated triggers stay fresh.
const SFX = {
  'card-flick': { prompt: 'quick card flick swoosh, clean UI, very short', duration: 0.5 },
  distance: { prompt: 'spaceship thruster accelerate whoosh, short', duration: 1.1 },
  hazard: {
    prompt: 'electrical short-circuit spark, metal clank, alarm blip, sci-fi malfunction',
    duration: 1.4,
  },
  remedy: { prompt: 'power-up restore hum, bright confirm, short', duration: 1.0 },
  safety: { prompt: 'energy shield activate shimmer with sparkle, sci-fi', duration: 1.2 },
  warp: { prompt: 'hyperspace jump whoosh, sci-fi, powerful', duration: 1.8 },
  slingshot: { prompt: 'triumphant sci-fi stinger, quick, bright', duration: 1.2 },
  win: { prompt: 'short cheerful victory chime, kids game, bright and happy', duration: 1.8 },
  'ui-click': { prompt: 'soft UI click, subtle, very short', duration: 0.3 },
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
