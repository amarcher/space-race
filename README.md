# Space Race: 1000 Light-Years

A cosmic race to 1,000 light-years — a Mille Bornes-style space card game that
now exists in **three forms**:

1. **Web app** — free in the browser: https://game.spaceexplorer.tech
2. **iOS app** — [Space Race: 1000 Light-Years on the App Store](https://apps.apple.com/us/app/space-race-1000-light-years/id6788064058)
3. **Physical board game** — *First Edition*, printed via The Game Crafter
   (107-card poker deck, tuck box, illustrated rulebook). First production run
   ordered 2026-07-23.

Possible next chapter (TBD): use the app and website as a sales channel for
the physical game once copies are in hand.

## Live links

- **Play the game** — https://game.spaceexplorer.tech (also https://web-phi-tawny-67.vercel.app)
- **App Store** — https://apps.apple.com/us/app/space-race-1000-light-years/id6788064058
- **The Game Crafter (game editor)** — https://www.thegamecrafter.com/make/games/AE2D3926-864B-11F1-B4CD-6383B6BFA688

## Web game

The game (human vs. computer, plus a TV second-screen mode) lives in
[`web/`](./web) — Vite + React + TypeScript. See [`web/PLAN.md`](./web/PLAN.md).
It auto-deploys via Vercel: pushes to `main` ship to production, pull requests
get preview URLs.

```bash
cd web && npm install && npm run dev   # http://localhost:5180
```

## iOS app

Shipped. Capacitor wrapper around the web game, fully offline with bundled
assets. History and release process: [`docs/ios-roadmap.md`](./docs/ios-roadmap.md).

## Physical board game (First Edition)

The print pipeline, The Game Crafter product details, locked design decisions,
and the arrival-QA checklist all live in [`print/README.md`](./print/README.md).

```
space-race/
├── print/                  HTML renderers → exact TGC pixel specs + key art
├── exports/                final uploaded print files (cards, box, booklet)
├── manifest.csv            deck contents (card names, counts, art mapping)
├── artbin/                 source art + candidate generations
├── picker/                 local web app to compare/promote art candidates
├── prompts/                original card-art prompt archive
├── index.html              original pitch deck (historical)
├── TODAY.md / CHECKLIST.md / FINISH_LINE_BRIEF.md   archived planning docs
└── web/                    the game itself (web + iOS)
```
