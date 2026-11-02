#!/usr/bin/env node
// Capture a staged board (web/src/components/Table.tsx `?stage=`) at an exact
// device size through Chrome's DevTools protocol. Headless Chrome's
// --virtual-time-budget cannot be used here: the hand is a physics world that
// settles on real animation frames, so this waits real seconds instead.
//
//   node capture.mjs <out.png> <width> <height> <dpr> <url> [waitMs]
//
// Sizes (CSS px) the store asks for, at the given scale:
//   iPhone Duo outer   466x678  @3 → 1398x2034   (add &insets=0,79,0,0 for the strip)
//   iPhone Duo inner   669x951  @3 → 2007x2853
//   iPhone 6.9"        440x956  @3 → 1320x2868   (ASC takes 1284x2778 for this app)
//   iPad 13"          1032x1376 @2 → 2064x2752
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const [out, w, h, dpr, url, waitMs = '9000'] = process.argv.slice(2)
if (!url) { console.error('usage: capture.mjs <out.png> <w> <h> <dpr> <url> [waitMs]'); process.exit(2) }
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const profile = `/tmp/space-race-capture-${process.pid}`
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
const port = await new Promise((res, rej) => {
  let buf = ''
  chrome.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if (m) res(m[1]) })
  chrome.on('exit', () => rej(new Error('chrome exited before listening')))
})
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = pages.find((p) => p.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })

await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: +dpr, mobile: true })
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await send('Page.enable')
await send('Page.navigate', { url })
await new Promise((r) => setTimeout(r, +waitMs))
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
console.log(`wrote ${out} (${w}x${h} @${dpr})`)
ws.close()
chrome.kill()
