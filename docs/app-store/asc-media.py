#!/usr/bin/env python3
"""Put App Store screenshots / previews on a version page from the CLI.

App Store Connect's *media manager* is manual-only — the drag target and file
picker can't be automated (CSP). The REST API has no such limitation, and this
is the whole flow: reserve an asset, PUT the bytes through the upload
operations ASC hands back, commit with the MD5, wait for delivery, then set the
display order.

    ./docs/app-store/asc-media.py show
    ./docs/app-store/asc-media.py upload <localization-id> \
        --display-type APP_IPHONE_67 \
        docs/app-store/compose/out/iphone69-{marquee,slingshot,scry,race,table,rules}.png
    ./docs/app-store/asc-media.py upload-preview <localization-id> \
        --preview-type IPHONE_67 docs/app-store/previews/app-preview-6.9.mp4

WHICH SLOT: see screenshots/README.md. The 6.9" (1320x2868) slot is the one the
API calls APP_IPHONE_67 — there is no APP_IPHONE_69. And the two enums are NOT
spelled alike: screenshots take APP_IPHONE_67, previews take a bare IPHONE_67.
Pass a bogus value to either and ASC enumerates every accepted one in the
error, which is how both were settled.

NEEDS AN EDITABLE VERSION. Media hangs off an appStoreVersionLocalization, and
a READY_FOR_SALE version's is frozen — so this runs against the *next* version
page at release time. `show` prints the id to pass.

Auth is the ASC API key: ASC_API_KEY_ID / ASC_API_ISSUER_ID from the
environment (they're exported in ~/.zshrc), private key read from
~/.appstoreconnect/private_keys/AuthKey_<id>.p8. Nothing secret lives here.
"""
import argparse
import base64
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

API = "https://api.appstoreconnect.apple.com"
APP_ID = "6788064058"  # Space Race: 1000 Light-Years


# --- auth -------------------------------------------------------------------
# ES256 JWT signed via openssl, so this stays a stdlib-only script (no pyjwt).

def _b64u(raw: bytes) -> bytes:
    return base64.urlsafe_b64encode(raw).rstrip(b"=")


def _der_to_jose(der: bytes) -> bytes:
    """ECDSA SEQUENCE{INTEGER r, INTEGER s} -> the raw r||s JOSE wants."""
    assert der[0] == 0x30
    i = 2 if der[1] < 0x80 else 2 + (der[1] & 0x7F)
    out = b""
    for _ in range(2):
        assert der[i] == 0x02
        length = der[i + 1]
        out += der[i + 2 : i + 2 + length].lstrip(b"\x00").rjust(32, b"\x00")
        i += 2 + length
    return out


def token() -> str:
    key_id = os.environ.get("ASC_API_KEY_ID")
    issuer = os.environ.get("ASC_API_ISSUER_ID")
    if not key_id or not issuer:
        sys.exit("Set ASC_API_KEY_ID and ASC_API_ISSUER_ID (see ~/.zshrc).")
    p8 = os.path.expanduser(f"~/.appstoreconnect/private_keys/AuthKey_{key_id}.p8")
    if not os.path.exists(p8):
        sys.exit(f"No private key at {p8}")
    now = int(time.time())
    header = {"alg": "ES256", "kid": key_id, "typ": "JWT"}
    claims = {"iss": issuer, "iat": now, "exp": now + 19 * 60, "aud": "appstoreconnect-v1"}
    signing = b".".join(
        _b64u(json.dumps(part, separators=(",", ":")).encode()) for part in (header, claims)
    )
    der = subprocess.run(
        ["openssl", "dgst", "-sha256", "-sign", p8], input=signing, capture_output=True, check=True
    ).stdout
    return (signing + b"." + _b64u(_der_to_jose(der))).decode()


_TOKEN = None


def api(method, path, body=None, raw=None, headers=None, ok=(200, 201, 204)):
    global _TOKEN
    if _TOKEN is None:
        _TOKEN = token()
    url = path if path.startswith("http") else API + path
    head = {} if raw is not None else {"Authorization": "Bearer " + _TOKEN}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        head["Content-Type"] = "application/json"
    if raw is not None:
        data = raw
    if headers:
        head.update(headers)
    req = urllib.request.Request(url, data=data, headers=head, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            payload = resp.read()
            if payload and resp.headers.get("content-type", "").startswith("application/json"):
                return json.loads(payload)
            return {}
    except urllib.error.HTTPError as err:
        detail = err.read().decode(errors="replace")
        try:
            detail = "\n".join(
                f"  {e.get('code')}: {e.get('detail')}" for e in json.loads(detail)["errors"]
            )
        except Exception:
            pass
        sys.exit(f"{method} {url} -> {err.code}\n{detail}")


# --- read -------------------------------------------------------------------

def cmd_show(_args):
    versions = api(
        "GET",
        f"/v1/apps/{APP_ID}/appStoreVersions?limit=10"
        "&fields[appStoreVersions]=versionString,appStoreState",
    )["data"]
    for version in versions:
        attrs = version["attributes"]
        state = attrs["appStoreState"]
        editable = state not in ("READY_FOR_SALE", "REMOVED_FROM_SALE", "DEVELOPER_REMOVED_FROM_SALE")
        print(f"\n{attrs['versionString']}  {state}{'  <- editable' if editable else ''}")
        locs = api(
            "GET",
            f"/v1/appStoreVersions/{version['id']}/appStoreVersionLocalizations"
            "?fields[appStoreVersionLocalizations]=locale",
        )["data"]
        for loc in locs:
            print(f"  {loc['attributes']['locale']}  localization {loc['id']}")
            for kind, attr in (("appScreenshotSets", "screenshotDisplayType"),
                               ("appPreviewSets", "previewType")):
                for aset in api("GET", f"/v1/appStoreVersionLocalizations/{loc['id']}/{kind}")["data"]:
                    members = "appScreenshots" if kind == "appScreenshotSets" else "appPreviews"
                    assets = api("GET", f"/v1/{kind}/{aset['id']}/{members}")["data"]
                    states = {
                        (a["attributes"].get("assetDeliveryState") or {}).get("state")
                        for a in assets
                    }
                    print(f"    {aset['attributes'][attr]:<24} {len(assets)} asset(s) "
                          f"{'/'.join(sorted(s or '?' for s in states)) or '-'}")


# --- write ------------------------------------------------------------------

def _reserve_and_send(kind, set_id, path, extra_attrs=None):
    """Reserve one asset in `set_id`, PUT its bytes, commit it. Returns its id."""
    blob = open(path, "rb").read()
    name = os.path.basename(path)
    attrs = {"fileName": name, "fileSize": len(blob)}
    attrs.update(extra_attrs or {})
    rel = "appScreenshotSet" if kind == "appScreenshots" else "appPreviewSet"
    rel_type = "appScreenshotSets" if kind == "appScreenshots" else "appPreviewSets"
    created = api("POST", f"/v1/{kind}", {
        "data": {
            "type": kind,
            "attributes": attrs,
            "relationships": {rel: {"data": {"type": rel_type, "id": set_id}}},
        }
    })["data"]

    for op in created["attributes"]["uploadOperations"]:
        chunk = blob[op["offset"] : op["offset"] + op["length"]]
        api(op["method"], op["url"], raw=chunk,
            headers={h["name"]: h["value"] for h in op.get("requestHeaders", [])})

    api("PATCH", f"/v1/{kind}/{created['id']}", {
        "data": {
            "type": kind,
            "id": created["id"],
            "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(blob).hexdigest()},
        }
    })

    # ASC validates dimensions/codec asynchronously; a bad size fails HERE, not
    # at reserve time, so waiting is the only way to know an upload really took.
    for _ in range(60):
        state = api("GET", f"/v1/{kind}/{created['id']}")["data"]["attributes"]["assetDeliveryState"]
        if state["state"] == "COMPLETE":
            print(f"  {name}: COMPLETE")
            return created["id"]
        if state["state"] == "FAILED":
            sys.exit(f"  {name}: FAILED — {json.dumps(state.get('errors'))}")
        time.sleep(2)
    sys.exit(f"  {name}: still {state['state']} after 2 min")


def _find_or_make_set(kind, attr, loc_id, type_value):
    existing = api("GET", f"/v1/appStoreVersionLocalizations/{loc_id}/{kind}")["data"]
    for aset in existing:
        if aset["attributes"][attr] == type_value:
            print(f"reusing existing {type_value} set {aset['id']}")
            return aset["id"]
    made = api("POST", f"/v1/{kind}", {
        "data": {
            "type": kind,
            "attributes": {attr: type_value},
            "relationships": {
                "appStoreVersionLocalization": {
                    "data": {"type": "appStoreVersionLocalizations", "id": loc_id}
                }
            },
        }
    })["data"]
    print(f"created {type_value} set {made['id']}")
    return made["id"]


def cmd_upload(args):
    set_id = _find_or_make_set(
        "appScreenshotSets", "screenshotDisplayType", args.localization, args.display_type
    )
    ids = [_reserve_and_send("appScreenshots", set_id, f) for f in args.files]
    # Order is load-bearing: the App Store link unfurl thumbnails screenshot #1.
    api("PATCH", f"/v1/appScreenshotSets/{set_id}/relationships/appScreenshots",
        {"data": [{"type": "appScreenshots", "id": i} for i in ids]})
    print(f"{len(ids)} screenshot(s) in {args.display_type}, in the order given")


def cmd_upload_preview(args):
    set_id = _find_or_make_set(
        "appPreviewSets", "previewType", args.localization, args.preview_type
    )
    _reserve_and_send("appPreviews", set_id, args.file,
                      {"mimeType": "video/mp4"} if args.file.endswith(".mp4") else None)
    print(f"preview in {args.preview_type}")


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("show", help="versions, localization ids, and current media").set_defaults(
        func=cmd_show)

    up = sub.add_parser("upload", help="upload a screenshot set (order = argument order)")
    up.add_argument("localization")
    up.add_argument("--display-type", default="APP_IPHONE_67")
    up.add_argument("files", nargs="+")
    up.set_defaults(func=cmd_upload)

    pv = sub.add_parser("upload-preview", help="upload one app preview video")
    pv.add_argument("localization")
    pv.add_argument("--preview-type", default="IPHONE_67")  # NB: no APP_ prefix
    pv.add_argument("file")
    pv.set_defaults(func=cmd_upload_preview)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
