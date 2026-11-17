"""Decode actual game-canvas recording; no desktop imagery or synthetic frames."""
import cv2
import hashlib
import json
from pathlib import Path
import sys

video = Path(sys.argv[1]).resolve()
assert video.name == "reload-live.webm" and video.is_file()
out = video.parent / "decoded"
out.mkdir(exist_ok=True)
capture = cv2.VideoCapture(str(video))
assert capture.isOpened(), "Recorded video does not decode"
fps = capture.get(cv2.CAP_PROP_FPS)
frames = 0
samples = []
width = height = 0
while True:
    ok, frame = capture.read()
    if not ok:
        break
    height, width = frame.shape[:2]
    if frames % 6 == 0:
        target = out / f"frame-{frames:03d}.png"
        assert cv2.imwrite(str(target), frame)
        samples.append({
            "frame": frames,
            "timestamp_ms": capture.get(cv2.CAP_PROP_POS_MSEC),
            "path": target.name,
            "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        })
    frames += 1
capture.release()
report = {
    "schema": "sunbreak-auto-canvas-decode-v1",
    "method": "Decode every frame of actual WebGL canvas captureStream recording; save every sixth decoded frame as sparse evidence, not continuous independent review",
    "pass": frames >= 60 and width == 1920 and height == 1080,
    "source": video.name,
    "source_sha256": hashlib.sha256(video.read_bytes()).hexdigest(),
    "frames": frames,
    "container_fps": fps,
    "size": [width, height],
    "samples": samples,
}
(out / "decode.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key: value for key, value in report.items() if key != "samples"}))
if not report["pass"]:
    raise SystemExit(1)
