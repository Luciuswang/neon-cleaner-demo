import base64
import json
import mimetypes
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
IMAGE = ROOT / "source" / "storyboard" / "approved" / "SB-A0-01_establishing_world.png"
OUT_DIR = ROOT / "web" / "assets" / "video"
OUT_DIR.mkdir(parents=True, exist_ok=True)
RAW_OUT = OUT_DIR / "A0-S01-seedance.mp4"
WEB_OUT = OUT_DIR / "A0-S01-seedance-web.mp4"
POSTER_OUT = OUT_DIR / "A0-S01-seedance-poster.jpg"
MODEL = os.environ.get("SEEDANCE_MODEL", "doubao-seedance-2-0-260128")
API_KEY = os.environ.get("ARK_API_KEY")

PROMPT = """Use the provided image as the first frame and preserve the exact composition: post-war future San Francisco, Golden Gate Bridge in storm haze, damaged skyline, broken elevated freeways, smoke columns, fires, wet streets, and cold blue-gray cinematic lighting.

Generate a photorealistic cinematic opening shot that can hand off directly into a 3D driving takeover world. Motion should be realistic and stable: very slow expensive push-in toward the broken freeway chase corridor, smoke rising and rolling with wind, small fires flickering and casting restrained orange light, rain haze moving with foreground/midground/background depth, subtle storm-cloud movement, and wet reflections shimmering. Keep architecture rigid and coherent; do not warp the bridge, roads, or skyline. End with a readable forward route into the damaged city.

Style: high-budget sci-fi war drama, grounded, photorealistic, somber, no text, no logo, no HUD, no cartoon, no anime, no painterly overlay, no floating dots, no melting buildings, no distorted bridge, no broken geometry."""

NEGATIVE_PROMPT = "warped architecture, distorted bridge, melting buildings, bending freeway, unstable skyline, morphing roads, rubber geometry, fisheye deformation, extreme zoom, camera shake, fast pan, close aircraft, dogfight, missile chaos, bright branching lightning, overexposed flashes, painted overlay, brush strokes, static particles, floating dots, fake rain lines, white rain streaks, cartoon, anime, comic, game screenshot, HUD, UI, subtitle, watermark, logo, text, toy vehicles, plastic material, frozen smoke, random glowing blobs, blurry, noisy compression, fantasy style, clean undamaged city"


def request_json(method, url, payload=None):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def image_data_url(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def main():
    if not API_KEY:
        raise SystemExit("Missing ARK_API_KEY. Create one in Volcengine Ark and export ARK_API_KEY before running.")
    payload = {
        "model": MODEL,
        "content": [
            {"type": "text", "text": PROMPT},
            {"type": "image_url", "image_url": {"url": image_data_url(IMAGE)}},
        ],
        "metadata": {
            "negative_prompt": NEGATIVE_PROMPT,
            "duration": "6",
            "resolution": "720p",
            "ratio": "16:9",
        },
    }
    print("Submitting Seedance task", MODEL)
    task = request_json("POST", "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks", payload)
    task_id = task.get("id") or task.get("task_id") or task.get("data", {}).get("id")
    if not task_id:
        print(json.dumps(task, ensure_ascii=False, indent=2))
        raise SystemExit("No task id returned")
    print("task_id", task_id)

    result = None
    for i in range(120):
        time.sleep(5)
        result = request_json("GET", f"https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/{task_id}")
        status = (result.get("status") or result.get("data", {}).get("status") or "").lower()
        print(f"poll {i+1:03d} status={status}")
        if status in {"succeeded", "success", "completed", "failed", "cancelled"}:
            break
    else:
        raise SystemExit("Seedance task timed out")

    status = (result.get("status") or result.get("data", {}).get("status") or "").lower()
    if status not in {"succeeded", "success", "completed"}:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        raise SystemExit(f"Seedance task did not succeed: {status}")

    text = json.dumps(result, ensure_ascii=False)
    import re
    urls = re.findall(r'https?://[^"\\\s]+?\.mp4(?:\?[^"\\\s]+)?', text)
    if not urls:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        raise SystemExit("No mp4 URL found in response")
    video_url = urls[0]
    print("downloading", video_url[:80] + ("..." if len(video_url) > 80 else ""))
    with urllib.request.urlopen(video_url, timeout=300) as r, open(RAW_OUT, "wb") as f:
        while True:
            chunk = r.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)
    print("saved", RAW_OUT)
    print("Next: ffmpeg -y -i", RAW_OUT, "-map 0:v:0 -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an", WEB_OUT)


if __name__ == "__main__":
    main()
