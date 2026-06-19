# 1000 Light-Years · Milo's Space Race

Project workspace for the birthday card game.

## Live links

- **Play the game** — https://game.spaceexplorer.tech (also https://web-phi-tawny-67.vercel.app)
- **Figma file** — https://www.figma.com/design/THJUuA3J8VpDYejlGWggQU/1000-Years
- **Pitch deck** — [`index.html`](./index.html)

## Web game

A playable browser version (human vs. computer) lives in [`web/`](./web) — Vite +
React + TypeScript. See [`web/PLAN.md`](./web/PLAN.md). It auto-deploys via Vercel:
pushes to `main` ship to production, pull requests get preview URLs.

```bash
cd web && npm install && npm run dev   # http://localhost:5180
```

## Start here

1. **Tomorrow morning** — open [`TODAY.md`](./TODAY.md) for the three moves that unblock everything else (~1 hour total)
2. **Full plan** — open [`index.html`](./index.html) in a browser · source of truth for every design decision
3. **11-day build** — see [`CHECKLIST.md`](./CHECKLIST.md) after the three kickoff moves are done

## Structure

```
space-race/
├── index.html              pitch deck (all design decisions)
├── TODAY.md                the 3 kickoff moves
├── CHECKLIST.md            day-by-day build tracker
├── manifest.csv            deck contents for Figma batch-fill
├── prompts/                Nano Banana prompts, ready to paste
│   ├── base-prompts.md     the two base prompt templates
│   ├── session-1-cosmic.md 15 cosmic cards (Black Hole anchor + 14)
│   ├── session-2-angelic.md 4 safeties (Rescue Shuttle anchor + 3)
│   └── session-3-auxiliary.md 3 auxiliary backgrounds
├── artbin/                 Nano Banana outputs land here
└── exports/                Figma PDF exports land here (for Game Crafter)
```

## Decisions locked

Full rationale in the pitch deck. Headlines:

- **Theme** · Deep Space Race — cosmic dark for 15 cards, angelic light for 4 safeties
- **Name** · 1000 Light-Years (generic); Milo-ness in a removable sleeve
- **Architecture** · Core = timeless deck; Sleeve = ribbon tag + "Milo Reads the Rules" card + optional foil seal
- **Printer** · Game Crafter · Linen Finish Premium · custom tuck box
- **Proof trigger** · T-5 weeks before party (set calendar reminder)
- **QR** · YouTube unlisted → Bitly dynamic redirect → lives on the Milo card (not the tuck box)
- **Budget** · ~$450 total (15 decks + proof + supplies + Milo cards)

## What goes where

- **Art generations** (Nano Banana outputs) → `artbin/` · name per manifest: `s1-01-black-hole_v2.png`
- **PDF exports** (from Figma) → `exports/` · one file per card, plus back + tuck box + insert + Milo card
- **Reference images** (for Nano Banana sessions) → `artbin/` alongside the generations

## The three kickoff moves

One hour, tomorrow morning. See [`TODAY.md`](./TODAY.md).
