"""Export the user's saved house without editing/resaving their originals.

Run with Blender --background --factory-startup --python this-file.py.
This is a specific audited import, not an automatic arbitrary geometry approval.
"""
import bpy
import hashlib
import json
import shutil
import struct
import numpy as np
from collections import defaultdict
from pathlib import Path

GAME = Path(__file__).resolve().parent.parent
SOURCE = Path("F:/AIshootgame/timber-house/timber-house-editable.blend")
BASE = GAME / "authoring/timber-house/timber-house-editable.blend"
OUT = GAME / "authoring/user-house-2026-11-17"
EXPECTED = [
    "DoorHandlePlate", "Foundation_part_0001",
    "Foundation_part_0002", "Foundation_part_0075",
]
sha = lambda data: hashlib.sha256(data).hexdigest()


def value(v):
    if isinstance(v, (str, int, float, bool)) or v is None:
        return v
    try:
        return list(v)
    except TypeError:
        return str(v)


def snapshot():
    # A saved multi-object EDIT_MESH scene has unsynchronized mesh UV arrays.
    # Flush edit data in memory only; never save the user's .blend.
    saved_mode = bpy.context.mode
    if saved_mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    objects = {}
    for obj in bpy.data.objects:
        record = {
            "type": obj.type, "parent": obj.parent.name if obj.parent else None,
            "matrix": [float(v) for row in obj.matrix_local for v in row],
            "hideRender": obj.hide_render,
            "modifiers": [(m.name, m.type) for m in obj.modifiers],
        }
        if obj.type == "MESH":
            mesh = obj.data
            mesh.calc_loop_triangles()
            geometry = b"".join(struct.pack("<3f", *v.co) for v in mesh.vertices)
            geometry += b"".join(struct.pack("<I", i)
                                 for p in mesh.polygons for i in p.vertices)
            uv = b"".join(struct.pack("<2f", *v.vector)
                          for layer in mesh.uv_layers for v in layer.uv)
            record.update({
                "geometry": sha(geometry), "uv": sha(uv),
                "vertices": len(mesh.vertices),
                "uvCorners": sum(len(layer.uv) for layer in mesh.uv_layers),
                "corners": len(mesh.loops), "triangles": len(mesh.loop_triangles),
                "materials": [m.name if m else None for m in mesh.materials],
                "smoothFaces": sum(p.use_smooth for p in mesh.polygons),
            })
        objects[obj.name] = record
    materials = {}
    for mat in bpy.data.materials:
        nodes = []
        if mat.node_tree:
            for node in mat.node_tree.nodes:
                nodes.append({
                    "name": node.name, "type": node.type,
                    "inputs": [[i.name, value(i.default_value)]
                               for i in node.inputs if hasattr(i, "default_value")],
                    "image": node.image.name
                    if node.type == "TEX_IMAGE" and node.image else None,
                    "operation": getattr(node, "operation", None),
                    "blendType": getattr(node, "blend_type", None),
                })
        materials[mat.name] = {
            "nodes": nodes,
            "links": sorted((l.from_node.name, l.from_socket.identifier,
                             l.to_node.name, l.to_socket.identifier)
                            for l in mat.node_tree.links) if mat.node_tree else [],
        }
    images = {i.name: {"size": list(i.size), "packed": bool(i.packed_file),
                       "sha256": sha(i.packed_file.data) if i.packed_file else None}
              for i in bpy.data.images if i.type == "IMAGE"}
    return {"savedMode": saved_mode, "objects": objects,
            "materials": materials, "images": images}


def surface(name):
    obj = bpy.data.objects[name]
    mesh = obj.data
    mesh.calc_loop_triangles()
    planes = defaultdict(float)
    degenerate = 0
    for tri in mesh.loop_triangles:
        a, b, c = [mesh.vertices[i].co for i in tri.vertices]
        normal = (b-a).cross(c-a)
        if normal.length < 1e-10:
            degenerate += 1
        axis = max(range(3), key=lambda i: abs(normal[i]))
        key = f"{axis}:{(a[axis]+b[axis]+c[axis])/3:.6f}:{1 if normal[axis] > 0 else -1}"
        planes[key] += normal.length * .5
    return {"localAxisPlanesSignedAreas": dict(planes), "degenerate": degenerate}


OUT.mkdir(parents=True, exist_ok=True)
source_before = sha(SOURCE.read_bytes())
assert source_before == "bf6ac17ae69835ad8f54e20c5c90b6c0610e43924a95b2e9095a29e7c1b6a2a8", (
    "New user source: perform a fresh edit/collision review, do not silently rebaseline")
bpy.ops.wm.open_mainfile(filepath=str(BASE))
baseline = snapshot()
baseline_surface = {n: surface(n) for n in EXPECTED if n.startswith("Foundation")}
pixel_before = {n: np.array(bpy.data.images[n].pixels[:], dtype=np.float32)
                for n in ["Image_1", "Image_4"]}
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
user = snapshot()
changed = sorted(n for n in set(baseline["objects"]) | set(user["objects"])
                 if baseline["objects"].get(n) != user["objects"].get(n))
assert changed == EXPECTED, changed
changed_images = sorted(n for n in baseline["images"]
                        if baseline["images"][n] != user["images"][n])
assert changed_images == ["Image_1", "Image_4"], changed_images
assert all(baseline["images"][n]["size"] == user["images"][n]["size"]
           for n in baseline["images"])
image_diffs = []
for name in changed_images:
    pixels = np.array(bpy.data.images[name].pixels[:], dtype=np.float32)
    difference = np.abs(pixels - pixel_before[name])
    image_diffs.append({"name": name, "maxPixelDelta": float(difference.max()),
                        "meanPixelDelta": float(difference.mean()),
                        "changedChannels": int(np.count_nonzero(difference))})
    (OUT / (name + ".png")).write_bytes(bpy.data.images[name].packed_file.data)
assert len(user["objects"]) == 1398
assert all(r["uvCorners"] == r["corners"] and r["uvCorners"] > 0
           for r in user["objects"].values() if r["type"] == "MESH")
for name in changed:
    for key in ["matrix", "parent", "type", "hideRender", "modifiers"]:
        assert baseline["objects"][name][key] == user["objects"][name][key], (name, key)
user_surface = {n: surface(n) for n in baseline_surface}
assert all(r["degenerate"] == 0 for r in user_surface.values())
preserved = OUT / "timber-house-user-source.blend"
if preserved.exists():
    assert sha(preserved.read_bytes()) == source_before, "Never replace a prior source"
else:
    shutil.copyfile(SOURCE, preserved)
candidate = OUT / "timber-house-user.glb"
bpy.ops.export_scene.gltf(
    filepath=str(candidate), export_format="GLB", export_yup=True,
    export_extras=True, export_apply=False, export_materials="EXPORT",
    export_cameras=False, export_lights=False, export_animations=False,
    export_keep_originals=False,
)
assert sha(SOURCE.read_bytes()) == source_before, "User source changed during export"
changes = [{"name": n, "before": baseline["objects"].get(n),
            "after": user["objects"].get(n)} for n in changed]
material_changes = [
    {"name": n, "before": baseline["materials"].get(n),
     "after": user["materials"].get(n)}
    for n in sorted(set(baseline["materials"]) | set(user["materials"]))
    if baseline["materials"].get(n) != user["materials"].get(n)]
report = {
    "schema": "sunbreak-user-house-source-audit-v1",
    "blender": bpy.app.version_string, "pass": True,
    "method": "Read original and exact saved user Blender project; flush EDIT_MESH "
              "in memory, compare all objects/UV/materials/images, export GLB. "
              "No source resave, no geometry/material/UV redesign.",
    "sourceFile": SOURCE.name, "sourceSha256": source_before,
    "preservedSource": preserved.name, "candidate": candidate.name,
    "candidateSha256": sha(candidate.read_bytes()), "savedMode": user["savedMode"],
    "objectCount": len(user["objects"]), "meshCount": 1372,
    "unchangedMeshes": 1368, "fullUV": True, "changes": changes,
    "materialChanges": material_changes, "packedImages": user["images"],
    "imageDiffs": image_diffs,
    "surfaceBefore": baseline_surface, "surfaceAfter": user_surface,
    "notes": [
        "Supplied GLB/textures were the previous release; actual edits came from saved .blend.",
        "Plinth/cap have small coplanar side-corner cutouts below the walk floor, not a new building silhouette.",
        "Extra low bottom-step box needs an explicit reviewed walk-support footprint.",
        "This report approves export integrity only, not collision/runtime/visual acceptance.",
    ],
}
(OUT / "source-audit.json").write_text(
    json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")
print("USER_HOUSE_EXPORTED", json.dumps({
    "sourceSha256": source_before, "candidateSha256": report["candidateSha256"],
    "changed": changed, "materialChanges": [m["name"] for m in material_changes],
    "uvComplete": True,
}))
