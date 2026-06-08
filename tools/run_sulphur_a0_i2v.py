import json
import mimetypes
import os
import random
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HOST = "http://127.0.0.1:8190"
ROOT = Path(__file__).resolve().parents[1]
BLUEPRINT = Path(r"D:\AI\SULPHUR2_ComfyUI\ComfyUI\blueprints\Image to Video (LTX-2.3).json")
SOURCE_IMAGE = ROOT / "source" / "storyboard" / "approved" / "SB-A0-01_establishing_world.png"
WEB_OUT_DIR = ROOT / "web" / "assets" / "video"
FINAL_OUT = WEB_OUT_DIR / "A0-S01-establishing-sulphur2-v2.mp4"
COMFY_INPUT_NAME = "SB-A0-01_establishing_world.png"
OUTPUT_PREFIX = "video/NeonCleaner_A0_S01_Sulphur2_v2_stable"

PROMPT = """Use the provided first frame as a strict first-frame reference. Preserve the exact composition, skyline silhouettes, Golden Gate Bridge shape, freeway geometry, building positions, horizon line, and camera angle. Generate a restrained realistic cinematic establishing shot of post-war San Francisco; prioritize stable architecture and natural atmospheric motion over dramatic effects.

Camera and motion: very slow forward push-in only, almost locked-off, no rotation, no tilt, no handheld shake, no warping zoom. Keep the bridge, roads, towers, and foreground structures rigid and coherent across all frames. Use subtle parallax only in smoke, rain haze, clouds, and distant glow.

Environmental motion: smoke columns slowly rise and curl in wind; small fires flicker gently and cast restrained orange light; rain mist and wet reflections shimmer subtly; storm clouds move slowly. Add at most one soft distant lightning glow behind clouds, not a bright branching bolt. If aircraft appear, keep them tiny distant silhouettes moving slowly, no close flybys, no dogfight, no missile chaos.

Style: photorealistic high-budget sci-fi war film opening, cold blue-gray storm light, volumetric haze, wet asphalt reflections, grounded materials, anamorphic cinematic lensing, large scale, somber mood. This should feel like a real plate with subtle atmospheric life, not a VFX demo. No text, no logo, no HUD, no cartoon, no anime, no painterly overlay, no floating dots, no melting buildings, no distorted bridge, no broken geometry."""

NEGATIVE = "warped architecture, distorted bridge, melting buildings, bending freeway, unstable skyline, morphing roads, rubber geometry, fisheye deformation, extreme zoom, camera shake, fast pan, close aircraft, dogfight, missile chaos, bright branching lightning, overexposed flashes, painted overlay, brush strokes, static particles, floating dots, fake rain lines, white rain streaks, cartoon, anime, comic, game screenshot, HUD, UI, subtitle, watermark, logo, text, toy vehicles, plastic material, frozen smoke, random glowing blobs, blurry, noisy compression, fantasy style, clean undamaged city, people in foreground"

# Top-level blueprint widget order for the subgraph component:
# prompt, width, height, duration, ckpt, seed_mode, seed, lora, text_encoder, upscaler, fps
OVERRIDES = {
    0: PROMPT,
    1: 832,
    2: 480,
    3: 4,
    4: "sulphur_dev_fp8mixed.safetensors",
    5: "fixed",
    6: random.randint(1, 2**63 - 1),
    7: "ltx-2.3-22b-distilled-lora-384.safetensors",
    8: "gemma_3_12B_it_fp4_mixed.safetensors",
    9: "ltx-2.3-spatial-upscaler-x2-1.1.safetensors",
    10: 8,
}

EXTERNAL_LINK_VALUE = {
    595: PROMPT,
    597: OVERRIDES[1],
    598: OVERRIDES[2],
    599: OVERRIDES[3],
    601: OVERRIDES[4],
    604: OVERRIDES[4],
    605: OVERRIDES[4],
    602: OVERRIDES[7],
    606: OVERRIDES[8],
    607: OVERRIDES[9],
    624: OVERRIDES[10],
}


def request_json(url, data=None, method=None, timeout=30):
    headers = {}
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def upload_image():
    boundary = "----HermesBoundary%08x" % random.getrandbits(32)
    data = []
    file_bytes = SOURCE_IMAGE.read_bytes()
    mime = mimetypes.guess_type(SOURCE_IMAGE.name)[0] or "image/png"
    def part(name, value, filename=None, content_type=None):
        data.append(f"--{boundary}\r\n".encode())
        if filename:
            data.append(f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode())
            data.append(f"Content-Type: {content_type}\r\n\r\n".encode())
            data.append(value)
            data.append(b"\r\n")
        else:
            data.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    part("image", file_bytes, COMFY_INPUT_NAME, mime)
    part("type", "input")
    part("overwrite", "true")
    data.append(f"--{boundary}--\r\n".encode())
    body = b"".join(data)
    req = urllib.request.Request(
        HOST + "/upload/image",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        print("UPLOAD", r.read().decode("utf-8"))


def ordered_input_names(class_info):
    names = []
    inp = class_info.get("input", {})
    for group in ("required", "optional"):
        for name in inp.get(group, {}).keys():
            names.append(name)
    return names


def resolve_link_origin(link, links_by_origin):
    # Follow Reroute nodes backwards by finding who feeds the reroute.
    origin_id = link["origin_id"]
    origin_slot = link["origin_slot"]
    while str(origin_id) in REROUTE_IDS:
        incoming = [l for l in ALL_LINKS if l["target_id"] == origin_id]
        if not incoming:
            break
        prev = incoming[0]
        origin_id, origin_slot = prev["origin_id"], prev["origin_slot"]
    return origin_id, origin_slot


def build_prompt():
    obj = request_json(HOST + "/object_info", timeout=60)
    wf = json.load(open(BLUEPRINT, encoding="utf-8"))
    sg = wf["definitions"]["subgraphs"][0]
    nodes = {n["id"]: n for n in sg["nodes"]}
    global ALL_LINKS, REROUTE_IDS
    ALL_LINKS = sg["links"]
    REROUTE_IDS = {str(nid) for nid, n in nodes.items() if n.get("type") == "Reroute"}

    links_by_id = {l["id"]: l for l in ALL_LINKS}
    prompt = {}

    # External image input node.
    prompt["1"] = {"class_type": "LoadImage", "inputs": {"image": COMFY_INPUT_NAME}}

    for nid, n in nodes.items():
        if n.get("type") == "Reroute":
            continue
        ctype = n["type"]
        if ctype not in obj:
            raise RuntimeError(f"Unknown node class {ctype} for node {nid}")
        class_info = obj[ctype]
        api_inputs = {}
        input_names = ordered_input_names(class_info)

        # Start with widget/default values in UI order. Important: linked widget
        # inputs still consume one widgets_values slot in the saved UI workflow;
        # otherwise later widgets shift (e.g. lora_name -> strength_model).
        widget_values = list(n.get("widgets_values") or [])
        widget_i = 0
        for inp in n.get("inputs", []):
            name = inp.get("name")
            link_id = inp.get("link")
            has_widget = inp.get("widget") is not None
            widget_val = None
            if has_widget and widget_i < len(widget_values):
                widget_val = widget_values[widget_i]
                widget_i += 1

            if link_id is not None:
                if link_id == 535:
                    api_inputs[name] = ["1", 0]
                elif link_id in EXTERNAL_LINK_VALUE:
                    api_inputs[name] = EXTERNAL_LINK_VALUE[link_id]
                else:
                    l = links_by_id[link_id]
                    oid, oslot = resolve_link_origin(l, None)
                    if oid == -10:
                        raise RuntimeError(f"Unhandled external link {link_id} to {nid}.{name}")
                    api_inputs[name] = [str(oid), oslot]
            elif has_widget:
                api_inputs[name] = widget_val

        # Keep dotted dynamic-input names such as values.a and resize_type.width;
        # ComfyUI validates those even though object_info exposes only the parent.

        # Override negative prompt: existing negative node 313.
        if nid == 277:
            api_inputs["noise_seed"] = OVERRIDES[6]
        if nid == 285:
            # Slightly reduce distilled-LoRA strength to lower aggressive motion/geometry drift.
            api_inputs["strength_model"] = 0.35
        if nid == 313:
            api_inputs["text"] = NEGATIVE
        prompt[str(nid)] = {"class_type": ctype, "inputs": api_inputs}

    prompt["999"] = {
        "class_type": "SaveVideo",
        "inputs": {
            "video": ["310", 0],
            "filename_prefix": OUTPUT_PREFIX,
            "format": "mp4",
            "codec": "h264",
        },
    }
    return prompt


def submit(prompt):
    payload = {"prompt": prompt, "client_id": "hermes-neon-cleaner"}
    try:
        res = request_json(HOST + "/prompt", payload, timeout=60)
        print("SUBMIT", json.dumps(res, ensure_ascii=False, indent=2))
        return res["prompt_id"]
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore")
        print("HTTP ERROR", e.code, body)
        (ROOT / "tools" / "comfy" / "last_failed_api_prompt.json").write_text(json.dumps(prompt, ensure_ascii=False, indent=2), encoding="utf-8")
        raise


def poll(prompt_id):
    start = time.time()
    while True:
        hist = request_json(HOST + f"/history/{prompt_id}", timeout=30)
        if prompt_id in hist:
            item = hist[prompt_id]
            status = item.get("status", {})
            print("STATUS", status)
            if status.get("completed"):
                return item
            if status.get("status_str") == "error":
                raise RuntimeError(json.dumps(status, ensure_ascii=False, indent=2))
        q = request_json(HOST + "/queue", timeout=30)
        print("QUEUE", q.get("queue_running"), q.get("queue_pending"), "elapsed", int(time.time() - start))
        if time.time() - start > 2400:
            raise TimeoutError("ComfyUI generation timed out")
        time.sleep(10)


def collect_output(history_item):
    outputs = history_item.get("outputs", {})
    print("OUTPUTS", json.dumps(outputs, ensure_ascii=False, indent=2)[:4000])
    # SaveVideo may report video files in several shapes. Also scan output folder.
    candidates = []
    for node_out in outputs.values():
        for key in ("videos", "gifs", "files"):
            for f in node_out.get(key, []) if isinstance(node_out, dict) else []:
                name = f.get("filename") if isinstance(f, dict) else None
                sub = f.get("subfolder", "") if isinstance(f, dict) else ""
                if name:
                    candidates.append(Path(r"D:\AI\SULPHUR2_ComfyUI\ComfyUI\output") / sub / name)
    out_root = Path(r"D:\AI\SULPHUR2_ComfyUI\ComfyUI\output")
    candidates += sorted(out_root.rglob("NeonCleaner_A0_S01_Sulphur2*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True)
    candidates = [p for p in candidates if p.exists()]
    if not candidates:
        raise FileNotFoundError("No generated mp4 found")
    src = candidates[0]
    WEB_OUT_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, FINAL_OUT)
    print(f"COPIED {src} -> {FINAL_OUT}")
    print(f"SIZE_MB={FINAL_OUT.stat().st_size/1024/1024:.2f}")


def main():
    print("HOST", HOST)
    print("SOURCE", SOURCE_IMAGE)
    request_json(HOST + "/system_stats", timeout=10)
    upload_image()
    prompt = build_prompt()
    (ROOT / "tools" / "comfy" / "last_sulphur_a0_api_prompt.json").write_text(json.dumps(prompt, ensure_ascii=False, indent=2), encoding="utf-8")
    print("API prompt written")
    pid = submit(prompt)
    item = poll(pid)
    collect_output(item)


if __name__ == "__main__":
    main()
