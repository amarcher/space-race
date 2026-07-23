import json, pathlib, time, urllib.request
OUT = pathlib.Path("/Users/archer/Programs/space-race/artbin/candidates/print-refresh/marketing")
OUT.mkdir(parents=True, exist_ok=True)
JOBS = [
    ("mk-01-halo-stage.jpg", 401,
     "towering golden sunlit clouds at the bottom fading to deep dark navy starfield at the top, "
     "a large soft glowing ring of light floating in the center middle, god rays, empty calm center "
     "stage for a product, painterly cinematic, no text, no letters, portrait composition"),
    ("mk-02-ascend-beam.jpg", 402,
     "vertical beam of warm golden light rising from radiant clouds below into a dark starry sky, "
     "small sparkling stars, tiny rocket silhouette far away, serene and heroic, lots of dark "
     "negative space in upper half, painterly cinematic, no text, no letters, portrait composition"),
    ("mk-03-card-flight.jpg", 403,
     "a fan of glowing playing cards soaring upward through golden clouds like a flock leaving a "
     "trail of stardust, warm gold and cream against deep navy sky, magical, painterly cinematic "
     "illustration, no text, no letters, portrait composition"),
]
for rel, seed, prompt in JOBS:
    body = json.dumps({"prompt": prompt, "width": 1024, "height": 1408, "seed": seed}).encode()
    req = urllib.request.Request("http://127.0.0.1:8000/generate", data=body,
                                 headers={"content-type": "application/json"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            data = r.read()
        (OUT / rel).write_bytes(data)
        print(f"done: {rel} {len(data)}B {time.time()-t0:.0f}s", flush=True)
    except Exception as e:
        print(f"FAIL: {rel} {e}", flush=True)
print("ALL_DONE")
