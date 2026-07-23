#!/usr/bin/env python3
"""Card-back batch 2 — human sketchiness + Wes Anderson wallpaper directions."""
import json
import pathlib
import time
import urllib.request

OUT = pathlib.Path("/Users/archer/Programs/space-race/artbin/candidates/print-refresh/card-back-2")
OUT.mkdir(parents=True, exist_ok=True)

TAIL = (", centered symmetric composition, portrait format, flat matte print quality, "
        "muted desaturated palette, no text, no letters, no numbers, no words")

JOBS = [
    # ── human sketchiness / eccentric Galilean ──
    ("cb2-01-galileo-notebook.jpg", 301,
     "page from Galileo's astronomy notebook, hand-drawn eccentric elliptical orbit "
     "diagrams in sepia ink around a small hand-sketched radiant sun, tiny moons plotted "
     "as circles along the ellipses, aged cream laid paper, delicate ink wash shading, "
     "hand-ruled ornamental border" + TAIL),
    ("cb2-02-davinci-rocket.jpg", 302,
     "renaissance sketchbook study of a fanciful rocket ship in brown iron-gall ink, "
     "fine crosshatching, construction lines and small orbital diagrams surrounding it, "
     "aged parchment with soft foxing" + TAIL),
    ("cb2-03-hand-etched-chart.jpg", 303,
     "hand-engraved celestial chart with charmingly irregular human linework, nested "
     "eccentric circles and looping comet paths, cream ink on deep slate brown, vintage "
     "scientific plate, central medallion" + TAIL),
    ("cb2-04-chalk-slate.jpg", 304,
     "hand-drawn astronomy diagram in white and pale gold chalk on a deep charcoal slate "
     "board, eccentric nested orbits with small comets and planets, dusty chalk texture, "
     "slightly wobbly hand-drawn lines" + TAIL),
    ("cb2-05-woodcut.jpg", 305,
     "vintage woodcut print of a small rocket arcing past stylized planets and stars, "
     "hand-carved linocut texture, slightly imperfect ink registration, two-color print "
     "in muted indigo and warm cream, decorative hand-cut border" + TAIL),
    ("cb2-06-etched-tile.jpg", 306,
     "hand-etched repeating pattern of small suns, crescent moons and eccentric orbit "
     "rings, sepia and faded gold ink on aged cream paper, vintage astronomical plate "
     "style, tiled wallpaper grid" + TAIL),
    # ── Wes Anderson wallpaper ──
    ("cb2-07-rocket-diamond-grid.jpg", 307,
     "ornate wallpaper pattern of tiny rockets and ringed planets alternating in a "
     "diamond lattice grid, dusty mustard and faded teal on muted cream, Wes Anderson "
     "symmetrical whimsy, vintage hotel wallpaper" + TAIL),
    ("cb2-08-damask-planets.jpg", 308,
     "victorian damask wallpaper with hidden ringed planets and tiny rockets woven into "
     "the foliate scrollwork, antique gold on deep forest green, seamless repeating "
     "tile, elegant and understated" + TAIL),
    ("cb2-09-toile-space.jpg", 309,
     "toile de jouy wallpaper of miniature space vignettes, tiny hand-illustrated "
     "rockets, telescopes and astronomers, single-color faded slate blue ink on warm "
     "cream, repeating pastoral-style scenes" + TAIL),
    ("cb2-10-nouveau-comets.jpg", 310,
     "art nouveau repeating wallpaper of comets with long flowing curved tails and small "
     "gold stars, muted sage and antique gold on soft charcoal, elegant whiplash "
     "curves, symmetric" + TAIL),
    ("cb2-11-grand-hotel-crest.jpg", 311,
     "symmetrical ornamental crest with a small rocket at the center surrounded by a "
     "laurel wreath of stars and orbit rings, dusty salmon, faded gold and slate on "
     "muted cream, grand hotel emblem style, flat graphic illustration" + TAIL),
    ("cb2-12-orbit-specimen-grid.jpg", 312,
     "wallpaper of many small eccentric elliptical orbit diagrams, each with a tiny "
     "planet on its ellipse, hand-inked museum specimen chart aesthetic, mustard and "
     "slate on aged cream, quirky repeating grid" + TAIL),
]

for rel, seed, prompt in JOBS:
    body = json.dumps({"prompt": prompt, "width": 1024, "height": 1408,
                       "seed": seed}).encode()
    req = urllib.request.Request("http://127.0.0.1:8000/generate", data=body,
                                 headers={"content-type": "application/json"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            data = resp.read()
        (OUT / rel).write_bytes(data)
        print(f"done: {rel} {len(data)}B {time.time()-t0:.0f}s", flush=True)
    except Exception as e:
        print(f"FAIL: {rel} {e}", flush=True)

print("ALL_DONE")
