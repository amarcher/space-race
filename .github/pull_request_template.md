<!-- What changed and why, written to be read: the commit log is the history. -->

## Calls made

<!-- Judgment calls shipped for veto. "None" is a fine answer. -->

## Verified

<!-- Each line names what actually ran, or says plainly that it did not.
     A PR without this section does not merge on its own (race-agent/prwatch.py). -->

- Gate: `cd web && npm ci && npm run build` (tsc -b && vite build) —
- Preview (the Vercel preview this PR gets — opened and looked at, or not) —
- Simulator / device (Capacitor, iOS, Android work: which one ran it, or none available) —
- Store (App Store Connect / Amazon / Play state checked, and what was not touched) —
