#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["fastapi", "uvicorn", "httpx"]
# ///
"""Candidate picker for Space Race deck art.

Browse all 22 card slots side-by-side with their existing _v1 image and any
candidates in artbin/candidates/. Edit the prompt and regenerate a fresh batch
via the local image-gen server. Promote a candidate to _v1.

Run:
    cd ~/Programs/space-race/picker && uv run server.py
Open http://127.0.0.1:8001
"""

from __future__ import annotations

import json
import re
import shutil
import string
import time
from pathlib import Path
from random import randint

import httpx
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "prompts.json"
ARTBIN = ROOT.parent / "artbin"
CANDIDATES = ARTBIN / "candidates"
STATIC = ROOT / "static"

CANDIDATES.mkdir(parents=True, exist_ok=True)


def load_config() -> dict:
    return json.loads(CONFIG_PATH.read_text())


def save_config(cfg: dict) -> None:
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2) + "\n")


def find_v1(slot_id: str) -> str | None:
    """Return relative URL of the canonical _v1 winner for a slot, if any."""
    for ext in ("jpg", "jpeg", "png"):
        p = ARTBIN / f"{slot_id}_v1.{ext}"
        if p.exists():
            return f"/artbin/{p.name}"
    return None


_CANDIDATE_RE = re.compile(r"^(?P<slot>.+)_(?P<suffix>[a-z]+)\.(?P<ext>jpg|jpeg|png)$")


def list_candidates(slot_id: str) -> list[dict]:
    """All candidate files for slot, sorted by suffix order."""
    out: list[dict] = []
    for p in CANDIDATES.iterdir():
        if not p.is_file():
            continue
        m = _CANDIDATE_RE.match(p.name)
        if not m or m["slot"] != slot_id:
            continue
        out.append({"filename": p.name, "suffix": m["suffix"], "url": f"/artbin/candidates/{p.name}"})
    out.sort(key=lambda c: (len(c["suffix"]), c["suffix"]))
    return out


def next_suffixes(slot_id: str, count: int) -> list[str]:
    """Generate the next N unused suffixes for this slot (a, b, ..., z, aa, ab, ...)."""
    used = {c["suffix"] for c in list_candidates(slot_id)}
    out: list[str] = []
    i = 0

    def to_suffix(n: int) -> str:
        # 0=a..25=z, 26=aa..51=az, 52=ba..
        if n < 26:
            return string.ascii_lowercase[n]
        return to_suffix(n // 26 - 1) + string.ascii_lowercase[n % 26]

    while len(out) < count:
        s = to_suffix(i)
        if s not in used:
            out.append(s)
        i += 1
    return out


app = FastAPI(title="space-race picker")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC / "index.html")


app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/artbin/{name}")
def artbin_file(name: str) -> FileResponse:
    p = (ARTBIN / name).resolve()
    if not str(p).startswith(str(ARTBIN.resolve())) or not p.is_file():
        raise HTTPException(404)
    return FileResponse(p)


@app.get("/artbin/candidates/{name}")
def candidate_file(name: str) -> FileResponse:
    p = (CANDIDATES / name).resolve()
    if not str(p).startswith(str(CANDIDATES.resolve())) or not p.is_file():
        raise HTTPException(404)
    return FileResponse(p)


@app.get("/api/slots")
def api_slots() -> JSONResponse:
    cfg = load_config()
    slots = []
    for s in cfg["slots"]:
        slots.append({
            **s,
            "v1_url": find_v1(s["id"]),
            "candidates": list_candidates(s["id"]),
        })
    return JSONResponse({
        "image_gen_url": cfg["image_gen_url"],
        "default_count": cfg["default_count"],
        "default_width": cfg["default_width"],
        "default_height": cfg["default_height"],
        "slots": slots,
    })


class RegenerateRequest(BaseModel):
    slot_id: str
    prompt: str = Field(min_length=1, max_length=4000)
    count: int = Field(default=3, ge=1, le=8)
    width: int | None = Field(default=None, ge=256, le=2048)
    height: int | None = Field(default=None, ge=256, le=2048)
    save_prompt: bool = True


@app.post("/api/regenerate")
def api_regenerate(req: RegenerateRequest) -> JSONResponse:
    cfg = load_config()
    slot = next((s for s in cfg["slots"] if s["id"] == req.slot_id), None)
    if slot is None:
        raise HTTPException(404, f"unknown slot {req.slot_id}")

    if req.save_prompt and slot["prompt"] != req.prompt:
        slot["prompt"] = req.prompt
        save_config(cfg)

    width = req.width or cfg["default_width"]
    height = req.height or cfg["default_height"]
    suffixes = next_suffixes(req.slot_id, req.count)
    image_gen = cfg["image_gen_url"]

    results = []
    t0 = time.time()
    with httpx.Client(timeout=600.0) as client:
        for sfx in suffixes:
            seed = randint(1, 2**31 - 1)
            try:
                r = client.post(
                    f"{image_gen}/generate",
                    json={"prompt": req.prompt, "width": width, "height": height, "seed": seed},
                )
                r.raise_for_status()
                out = CANDIDATES / f"{req.slot_id}_{sfx}.jpg"
                out.write_bytes(r.content)
                results.append({
                    "filename": out.name,
                    "suffix": sfx,
                    "url": f"/artbin/candidates/{out.name}",
                    "seed": seed,
                    "ok": True,
                })
            except httpx.HTTPError as e:
                results.append({"suffix": sfx, "seed": seed, "ok": False, "error": str(e)})

    return JSONResponse({
        "slot_id": req.slot_id,
        "elapsed_s": round(time.time() - t0, 1),
        "results": results,
    })


class PromoteRequest(BaseModel):
    slot_id: str
    candidate_filename: str


@app.post("/api/promote")
def api_promote(req: PromoteRequest) -> JSONResponse:
    src = (CANDIDATES / req.candidate_filename).resolve()
    if not str(src).startswith(str(CANDIDATES.resolve())) or not src.is_file():
        raise HTTPException(404, "candidate not found")

    ext = src.suffix.lstrip(".").lower()
    if ext == "jpeg":
        ext = "jpg"
    dst = ARTBIN / f"{req.slot_id}_v1.{ext}"

    # Backup any existing winner
    backup_url = None
    for old_ext in ("jpg", "jpeg", "png"):
        old = ARTBIN / f"{req.slot_id}_v1.{old_ext}"
        if old.exists():
            stamp = time.strftime("%Y%m%dT%H%M%S")
            backup = ARTBIN / f"{req.slot_id}_v1.previous-{stamp}.{old_ext}"
            shutil.move(str(old), str(backup))
            backup_url = f"/artbin/{backup.name}"

    shutil.copy2(src, dst)
    return JSONResponse({"v1_url": f"/artbin/{dst.name}", "backup_url": backup_url})


class DeleteRequest(BaseModel):
    candidate_filename: str


@app.post("/api/delete_candidate")
def api_delete(req: DeleteRequest) -> JSONResponse:
    p = (CANDIDATES / req.candidate_filename).resolve()
    if not str(p).startswith(str(CANDIDATES.resolve())) or not p.is_file():
        raise HTTPException(404, "candidate not found")
    p.unlink()
    return JSONResponse({"deleted": req.candidate_filename})


class SlotUpdateRequest(BaseModel):
    slot_id: str
    status: str = Field(default="", max_length=40)
    notes: str = Field(default="", max_length=1200)


@app.post("/api/slot_update")
def api_slot_update(req: SlotUpdateRequest) -> JSONResponse:
    cfg = load_config()
    slot = next((s for s in cfg["slots"] if s["id"] == req.slot_id), None)
    if slot is None:
        raise HTTPException(404, f"unknown slot {req.slot_id}")

    slot["status"] = req.status
    slot["notes"] = req.notes
    save_config(cfg)
    return JSONResponse({"slot_id": req.slot_id, "status": req.status, "notes": req.notes})


@app.get("/api/health")
def health() -> JSONResponse:
    cfg = load_config()
    image_gen_ok = False
    image_gen_info: dict | str = "unreachable"
    try:
        r = httpx.get(f"{cfg['image_gen_url']}/health", timeout=2.0)
        if r.status_code == 200:
            image_gen_ok = True
            image_gen_info = r.json()
    except httpx.HTTPError as e:
        image_gen_info = str(e)
    return JSONResponse({
        "ok": True,
        "image_gen_ok": image_gen_ok,
        "image_gen": image_gen_info,
        "candidates_dir": str(CANDIDATES),
        "artbin_dir": str(ARTBIN),
    })


if __name__ == "__main__":
    import os
    import uvicorn
    uvicorn.run(app, host=os.environ.get("PICKER_HOST", "127.0.0.1"), port=8001)
