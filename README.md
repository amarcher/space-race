# Space Race

A cosmic race to 1,000 light-years — a free space card game (a Mille Bornes
reskin, formerly titled "1000 Light-Years"). Playable in the browser today; an
iOS app (Capacitor) is in progress — see [`docs/ios-roadmap.md`](./docs/ios-roadmap.md).

## Live links

- **Play the game** — https://game.spaceexplorer.tech (also https://web-phi-tawny-67.vercel.app)
- **Figma file** — https://www.figma.com/design/THJUuA3J8VpDYejlGWggQU/1000-Years

## Web game

The game (human vs. computer, plus a TV second-screen mode) lives in
[`web/`](./web) — Vite + React + TypeScript. See [`web/PLAN.md`](./web/PLAN.md).
It auto-deploys via Vercel: pushes to `main` ship to production, pull requests
get preview URLs.

```bash
cd web && npm install && npm run dev   # http://localhost:5180
```

## iOS app

The roadmap for wrapping the web game with Capacitor and shipping it to the App
Store — fully offline, assets bundled — is at
[`docs/ios-roadmap.md`](./docs/ios-roadmap.md).

## Physical deck archive

This repo began as the workspace for a printed deck of the same game. Those
materials are kept as an archive:

```
space-race/
├── index.html              pitch deck (original design decisions)
├── TODAY.md                kickoff moves (archive)
├── CHECKLIST.md            day-by-day build tracker (archive)
├── manifest.csv            deck contents for Figma batch-fill
├── prompts/                card-art prompts, ready to paste
├── artbin/                 art generations land here
└── exports/                Figma PDF exports land here (for Game Crafter)
```

- **Art generations** → `artbin/` · name per manifest: `s1-01-black-hole_v2.png`
- **PDF exports** (from Figma) → `exports/` · one file per card, plus back + tuck box + insert
- **Reference images** → `artbin/` alongside the generations
