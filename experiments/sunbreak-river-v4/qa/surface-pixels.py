"""Decode real frozen WebGL PNG pairs offline. No browser/desktop image copying."""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

folder = Path(sys.argv[1]).resolve()
result = {"method": "Pillow offline PNG decode; numeric difference is not art acceptance", "pairs": []}
for first, second in [("rubble-contact", "rubble-no-ao"), ("fog-low", "fog-low-off"), ("fog-high", "fog-high-off")]:
    a, b = [Image.open(folder / (name + ".png")).convert("RGB") for name in [first, second]]
    assert a.size == b.size == (1920, 1080)
    states = [json.loads((folder / (name + ".json")).read_text()) for name in [first, second]]
    assert states[0]["camera"] == states[1]["camera"]
    assert states[0]["buildHashes"] == states[1]["buildHashes"]
    assert states[0]["weather"] == states[1]["weather"]
    assert states[0]["water"]["time"] == states[1]["water"]["time"]
    diff = ImageChops.difference(a, b)
    mean = ImageStat.Stat(diff).mean
    bbox = diff.getbbox()
    assert bbox is not None, "Identical decoded image: " + first
    # Verified on both original full-resolution images: this small receiver
    # region is opaque weapon. The former larger ROI also crossed the open
    # trigger/hand gap, where world fog must legitimately change background.
    gun = ImageStat.Stat(diff.crop((1400, 960, 1500, 1050))).extrema
    if first.startswith("fog"):
        assert max(v[1] for v in gun) == 0, "Opaque first-person gun changed with world fog"
    result["pairs"].append({"first": first, "second": second, "meanAbsoluteRGB": mean, "changedBounds": bbox,
                            "opaqueGunMaxDelta": max(v[1] for v in gun), "sha256": {
                                name: hashlib.sha256((folder / (name + ".png")).read_bytes()).hexdigest()
                                for name in [first, second]}})
result["pass"] = True
print(json.dumps(result))
