#!/usr/bin/env python3
"""Card-back + box-art candidate batch — z-turbo @ 1024x1408 (poker ratio)."""
import json
import pathlib
import time
import urllib.request

OUT = pathlib.Path("/Users/archer/Programs/space-race/artbin/candidates/print-refresh")
(OUT / "card-back").mkdir(parents=True, exist_ok=True)
(OUT / "box-art").mkdir(parents=True, exist_ok=True)

BACK = ("playing card back design, perfectly symmetrical composition, centered, "
        "muted desaturated palette, no text, no letters, no words, elegant, "
        "printed board game quality")
BOX = ("heroic luminous golden light, god rays, majestic sunlit clouds, angelic "
       "radiant atmosphere, painterly cinematic illustration, no text, no letters, no words")

JOBS = [
    ("card-back/cb-01-star-chart.jpg", 101,
     "antique celestial star chart, fine gold constellation lines connecting small stars "
     "on deep ink-navy field, delicate symmetric ornamental border, " + BACK),
    ("card-back/cb-02-engraving.jpg", 102,
     "vintage astronomy engraving of orbital paths around a small sun, sepia and cream "
     "linework on dark slate grey, copperplate etching style, " + BACK),
    ("card-back/cb-03-orbit-circuit.jpg", 103,
     "retro-futurist racing circuit drawn as nested elliptical orbital rings with tiny "
     "rockets, muted teal and aged brass on charcoal, mid-century graphic style, " + BACK),
    ("card-back/cb-04-deco-rocket.jpg", 104,
     "art deco sunburst medallion with streamlined rocket silhouette pointing up, antique "
     "gold and bronze geometry on near-black charcoal, 1930s poster ornament style, " + BACK),
    ("card-back/cb-05-blueprint.jpg", 105,
     "technical blueprint of a rocket, fine white and pale cyan schematic linework, "
     "measurement circles and stars, on desaturated dark slate blue paper texture, " + BACK),
    ("card-back/cb-06-damask.jpg", 106,
     "damask wallpaper repeating tile pattern of tiny rockets planets comets and stars, "
     "muted antique gold motifs on ink black, ornate victorian playing card back, " + BACK),
    ("card-back/cb-07-petrol-nebula.jpg", 107,
     "soft nebula clouds in muted petrol green and dark teal with faint gold stars, "
     "subtle vignette, painterly, restrained and dark, " + BACK),
    ("card-back/cb-08-bronze-comets.jpg", 108,
     "mirrored comet streaks in dusty bronze and copper crossing a charcoal starfield, "
     "symmetric kaleidoscope composition, muted metallic tones, " + BACK),
    ("card-back/cb-09-checker-stars.jpg", 109,
     "racing checkered flag pattern dissolving into a starfield, muted cream and graphite "
     "checkers scattering into small gold stars toward the center, dark navy background, " + BACK),
    ("card-back/cb-10-silver-milkyway.jpg", 110,
     "milky way galaxy band rendered in desaturated silver and blue-grey, vertical "
     "symmetric composition, fine grain stars, quiet and elegant, " + BACK),
    ("card-back/cb-11-midcentury.jpg", 111,
     "mid-century modern space age illustration, concentric planet rings and small atomic "
     "starbursts, muted olive mustard and cream on deep espresso brown, 1960s textbook style, " + BACK),
    ("card-back/cb-12-warp-streaks.jpg", 112,
     "warp speed star streaks radiating from a bright center point, symmetric radial "
     "composition, muted slate blue and warm grey with hints of gold, conveys speed and racing, " + BACK),
    ("box-art/box-01-golden-ascent.jpg", 201,
     "white and gold rocket ship ascending through towering golden clouds toward a ring of "
     "radiant light, halo of sunbeams, awe and hope, " + BOX),
    ("box-art/box-02-neck-and-neck.jpg", 202,
     "two sleek white and gold spaceships racing side by side through golden clouds toward "
     "a brilliant distant star, motion trails, joyful competition, " + BOX),
    ("box-art/box-03-cloud-to-stars.jpg", 203,
     "rocket bursting upward from radiant golden clouds into deep starry navy space above, "
     "transition from warm gold below to cool starfield above, vertical composition, " + BOX),
    ("box-art/box-04-halo-shuttle.jpg", 204,
     "gleaming white space shuttle with gold trim banking through sunlit clouds, enormous "
     "glowing halo ring behind it, lens flare, angelic guardian energy, " + BOX),
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
