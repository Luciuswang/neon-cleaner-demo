"""Fresh Blender process: verify the delivered .blend without saving changes."""
import bpy
import json
from pathlib import Path

game = Path(__file__).resolve().parent.parent
path = game / "authoring" / "timber-house" / "timber-house-editable.blend"
bpy.ops.wm.open_mainfile(filepath=str(path))
images = []
for image in bpy.data.images:
    if image.type != "IMAGE":
        continue
    # Blender lazily decodes packed images after opening a project. Accessing
    # real pixels (not has_data before decoding) proves the packed bytes work.
    first = float(image.pixels[0])
    images.append({"name": image.name, "size": list(image.size),
                   "packed": bool(image.packed_file), "decoded": image.has_data,
                   "firstPixel": first})
assert len(images) == 11 and all(i["packed"] and i["decoded"] and min(i["size"]) > 0 for i in images), images
assert bpy.data.objects.get("DoorPivot") is not None
report = {"schema": "sunbreak-house-blend-fresh-open-v1",
          "pass": True, "blender": bpy.app.version_string,
          "method": "Separate fresh background Blender process reopens delivered .blend and decodes every embedded texture. No desktop screenshots or resave.",
          "images": images,
          "objects": len(bpy.data.objects),
          "handleVertices": len(bpy.data.objects["DoorHandleGrip"].data.vertices)}
(game / "qa" / "roundtrip-blend.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print("FRESH_BLEND_VERIFIED", json.dumps(report))
