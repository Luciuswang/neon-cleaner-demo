import json
import os
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "web" / "worlds"
OUT.mkdir(parents=True, exist_ok=True)
API_KEY = os.environ.get("WORLDLABS_API_KEY") or os.environ.get("WLT_API_KEY")
if not API_KEY:
    raise SystemExit("Missing WORLDLABS_API_KEY or WLT_API_KEY")

PROMPT = """Create a navigable 3D Marble world for the interactive film game Neon Cleaner. The world must feel like a seamless continuation of the preceding cinematic shot: post-war future San Francisco at night after rain, cold blue-gray storm light, wet reflective asphalt, broken elevated freeway ramps, damaged towers, collapsed rail segments, distant Golden Gate Bridge silhouette through haze, smoke columns, small fire pockets, ruined drones, emergency magenta glows, and a readable chase corridor that starts from a cinematic overlook/road entrance and descends into a drivable damaged street route.

Gameplay purpose: this is the 3D takeover layer immediately after the opening Seedance/Sulphur cinematic. Keep a strong central pursuit path, with depth cues and enough clear foreground road to support a fast first-person chase. Avoid a flat postcard panorama; create spatial layers, road scale, tunnel-like city depth, and plausible vehicle navigation space. The route should feel dangerous but readable: broken barriers, wet lane markings, debris along edges, smoke and fire mostly off the main path, not blocking the road.

Style: photorealistic grounded sci-fi war drama, high-budget cinematic realism, not cartoon, not anime, not fantasy, no text, no UI, no logos, no huge character statue, no toy vehicles. Prioritize stable architecture and navigable environment over decorative chaos."""

body = {
    "display_name": "Neon Cleaner A0 Seamless Takeover World",
    "model": "marble-1.1",
    "tags": ["neon-cleaner", "a0", "seamless-takeover", "github-publish"],
    "world_prompt": {"type": "text", "text_prompt": PROMPT, "disable_recaption": False},
}
headers = {"Content-Type": "application/json", "WLT-Api-Key": API_KEY}

def request(method, url, data=None):
    payload = None if data is None else json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))

print("Starting WorldLabs Marble generation...")
op = request("POST", "https://api.worldlabs.ai/marble/v1/worlds:generate", body)
op_id = op.get("operation_id") or op.get("name")
if not op_id:
    print(json.dumps(op, indent=2, ensure_ascii=False))
    raise SystemExit("No operation_id returned")
print("operation_id", op_id)

completed = None
for i in range(120):
    time.sleep(5)
    completed = request("GET", f"https://api.worldlabs.ai/marble/v1/operations/{op_id}")
    progress = (((completed.get("metadata") or {}).get("progress")) or "")
    print(f"poll {i+1:03d} done={completed.get('done')} progress={progress}")
    if completed.get("done"):
        break
else:
    raise SystemExit("World generation timed out")

if completed.get("error"):
    raise SystemExit("World generation failed: " + json.dumps(completed["error"], ensure_ascii=False))

world = ((completed.get("response") or {}).get("world")) or completed.get("response") or completed
meta_path = OUT / "a0-seamless-takeover-world.json"
meta_path.write_text(json.dumps(world, indent=2, ensure_ascii=False), encoding="utf-8")
print("saved", meta_path)

assets = world.get("assets") or {}
spz_url = None
splats = (assets.get("splats") or {}).get("spz_urls") or {}
for key in ("500k", "100k", "full_res", "low_res"):
    if splats.get(key):
        spz_url = splats[key]
        break

def download(url, dest):
    print("downloading", dest.name)
    with urllib.request.urlopen(url, timeout=300) as r, open(dest, "wb") as f:
        while True:
            chunk = r.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)
    print("saved", dest, dest.stat().st_size)

if spz_url:
    download(spz_url, OUT / "a0-seamless-takeover-500k.spz")
else:
    print("No SPZ URL found")

collider_url = ((assets.get("mesh") or {}).get("collider_mesh_url")) or assets.get("collider_mesh_url")
if collider_url:
    download(collider_url, OUT / "a0-seamless-takeover-collider.glb")
else:
    print("No collider URL found")
