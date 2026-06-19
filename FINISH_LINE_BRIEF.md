# Finish Line Brief

This is the decision document for getting `1000 Light-Years` out of the image loop and into a printable party favor.

## The Core Alignment

The project is not stuck because the image prompts are bad. It is stuck because the entity system needs to be easier to reason about before the art can be judged fairly.

Use this rule:

> A hazard is the problem. A remedy is the physical fix. A safety is the permanent protection that makes the problem impossible or irrelevant.

If a card cannot satisfy that sentence, it is a concept problem before it is an art problem.

## Current Entity Map

| Threat lane | Current hazard | Current remedy | Current safety | Concept strength | Main art risk | Recommendation |
|---|---|---|---|---|---|---|
| Collision / damage | Asteroid Strike | Repair Drone | Ace Pilot | Medium | Ace Pilot prevents impact by skill, but does not visually mirror the object being fixed. | Keep unless we want stricter word-family matching. |
| Fuel / resource | Empty Tank | Fuel Cell | Antimatter Fuel Cell | Strong | Very clear escalation: empty tank -> fuel cell -> impossible-to-empty super fuel. | Keep. This is one of the cleanest lanes. |
| Engine / motion | Busted Thruster | New Thruster | Diamond Thruster | Strong | Diamond Thruster can read like treasure unless framed as indestructible propulsion. | Keep, but art must emphasize thruster first, diamond second. |
| Restraint / slow | Tractor Beam | Beam Cutter | Rescue Shuttle | Weak-medium | Rescue Shuttle is thematically broad and does not obviously prevent a tractor beam. | Consider alternatives. |
| Stop / restart | Black Hole | Ignition | Rescue Shuttle | Weak-medium | Rescue Shuttle rescuing from a black hole is readable, but it covers two hazards and may feel like a catch-all. | Keep only if we accept it as the special safety. |

## Alternative Entity Sets

These alternatives are not all better. They are here to make the choices explicit.

| Lane | Current set | Alternative A: stricter physical logic | Alternative B: more kid-readable | Alternative C: more dramatic space opera |
|---|---|---|---|---|
| Collision | Asteroid Strike -> Repair Drone -> Ace Pilot | Meteor Storm -> Shield Projector -> Force Field | Space Rock -> Space Mechanic -> Super Pilot | Asteroid Barrage -> Repair Swarm -> Evasive Ace |
| Fuel | Empty Tank -> Fuel Cell -> Antimatter Fuel Cell | Fuel Leak -> Fuel Patch -> Antimatter Core | Out of Gas -> Fuel Can -> Infinite Fuel | Reactor Drain -> Plasma Cell -> Antimatter Reactor |
| Engine | Busted Thruster -> New Thruster -> Diamond Thruster | Engine Failure -> Replacement Engine -> Reinforced Engine | Broken Rocket -> New Rocket -> Super Rocket | Thruster Rupture -> Fusion Thruster -> Diamond Drive |
| Restraint | Tractor Beam -> Beam Cutter -> Rescue Shuttle | Tractor Beam -> Beam Cutter -> Signal Jammer | Space Trap -> Laser Cutter -> Rescue Ship | Gravity Snare -> Phase Cutter -> Rescue Shuttle |
| Stop | Black Hole -> Ignition -> Rescue Shuttle | Black Hole -> Escape Burn -> Gravity Shield | Stuck in Space -> Blast Off -> Rescue Ship | Singularity -> Ignition Burst -> Wormhole Beacon |

## Best Minimal Revision

If we want to preserve most existing art and reduce conceptual discomfort, change only the two Rescue Shuttle lanes:

| Current | Proposed | Why |
|---|---|---|
| Tractor Beam -> Beam Cutter -> Rescue Shuttle | Tractor Beam -> Beam Cutter -> Signal Jammer | The safety now prevents the beam before it grabs you. The remedy cuts the beam after it happens. |
| Black Hole -> Ignition -> Rescue Shuttle | Black Hole -> Ignition -> Rescue Shuttle | Keep Rescue Shuttle as the special safety only for the STOP lane. It feels heroic and distinct. |

This would require one new safety card concept/art pass: `Signal Jammer`. It also makes `Rescue Shuttle` easier to art-direct because it no longer has to explain two unrelated immunities.

## Art Direction By Entity Type

| Type | What the card must communicate | Visual test | Current color logic |
|---|---|---|---|
| Distance | How far / fast the player moves. | Can someone sort 25, 50, 75, 100, 200 by intensity without reading? | Cockpit viewport, increasing warp intensity. |
| Hazard | A bad thing has happened and movement is blocked. | Does it look like an emergency before the title is read? | Red-dominant cosmic danger. |
| Remedy | The matching fix has arrived. | Does it visibly answer the exact hazard? | Green-dominant repair / relief. |
| Safety | This problem can no longer hurt me. | Does it feel rarer and more powerful than both hazard and remedy? | Angelic white/gold, mythic contrast. |

## Tooling Vision

Use `manifest.csv` as the game object model, not just a Figma fill sheet.

Recommended next schema:

| Field | Purpose |
|---|---|
| `lane` | Groups hazard/remedy/safety together, e.g. `fuel`, `engine`, `stop`. |
| `mechanic` | `distance`, `hazard`, `remedy`, `safety`. |
| `blocks` | For hazards, what state they impose. |
| `answers` | For remedies/safeties, which hazard they answer. |
| `concept_sentence` | One plain-English sentence that explains why the card exists. |
| `art_must_read_as` | The image-generation target before style. |
| `art_must_not_read_as` | The common failure mode. |
| `status` | `locked`, `needs-concept`, `needs-art`, `print-ready`. |

That creates a better loop:

1. Lock the entity row.
2. Write the concept sentence.
3. Approve the hazard/remedy/safety relationship.
4. Generate art against the `art_must_read_as` field.
5. Judge art against the row, not against vibes.

## Deadline Windows

The submission window should be named:

> Proof Order Trigger

That is the date when all print PDFs must be uploaded and the single proof copy ordered.

| Window | When | What it means | Risk |
|---|---:|---|---|
| Comfortable | T-8 weeks | Start Figma/art sprint. | Low. Time exists for concept changes. |
| Proof Order Trigger | T-5 weeks | Submit the single proof copy. | Healthy. A re-proof is still survivable. |
| Final Order Trigger | T-2 weeks | Submit the final party quantity after proof QA. | Normal. Depends on printer queue. |
| Compressed | T-3 weeks | Skip proof and submit final order directly. | Medium-high. You are buying speed with risk. |
| Emergency | T-10 days or less | Print cards-only fast or local print-and-sleeve. | High. Treat box/rules as optional. |

If the party date is not pinned, pin it before doing any more art. Without that date, every decision feels equally urgent and nothing can be safely cut.

## Print Timing Reality Check

For a single polished proof copy, assume 2-3 weeks unless the checkout page gives a better date.

| Printer path | What to expect | Use when |
|---|---|---|
| The Game Crafter | Queue-based production plus shipping. Their estimated ship date is production completion, not delivery. They have normal, urgent, parts-only, and bulk queues. | Best for the actual game with tuck box and rules insert. |
| MakePlayingCards | FAQ says standard personalized items arrive in 8-10 business days, rush in 5-6 business days. | Useful fallback for cards-only or simpler packaging. |
| PrintNinja | Their process is closer to manufacturing; turnaround guidance is measured in weeks, not days. | Not a party-deadline prototype path. |

The live Game Crafter queue must be checked at order time in cart/status because it changes. Do not let the plan depend on a stale queue estimate.

## What To Do Next

1. Decide whether `Rescue Shuttle` stays as a two-hazard safety.
2. If not, replace the Tractor Beam safety with `Signal Jammer`.
3. Add `lane`, `concept_sentence`, `art_must_read_as`, and `status` columns to `manifest.csv`.
4. Lock all concept rows before regenerating more art.
5. Treat the tuck box and rules insert as layout work, not creative exploration.
