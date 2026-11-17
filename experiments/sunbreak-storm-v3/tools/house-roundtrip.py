"""Actual Blender glTF edit/re-export trial. Run with Blender --background."""
import bpy
import bmesh
import json
from pathlib import Path

game = Path(__file__).resolve().parent.parent
folder = game / "authoring" / "timber-house"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.import_scene.gltf(filepath=str(folder / "timber-house-source.glb"))

# Small real artist-style mesh/material edit, not a changed building layout:
# soften the blocky handle edges and give hardware a restrained aged-brass finish.
edited = []
for name in ["DoorHandleGrip", "DoorHandlePlate"]:
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise RuntimeError("Missing named editable part: " + name)
    before = len(obj.data.vertices)
    # glTF hard-normal/UV seams split each box into 24 face vertices. Weld the
    # coincident topology first; otherwise a bevel on disconnected faces is a
    # no-op. UV coordinates remain per face corner.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
    bm.to_mesh(obj.data)
    bm.free()
    material = bpy.data.materials.new(name="AgedBrass_" + name)
    material.diffuse_color = (0.19, 0.115, 0.042, 1)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.19, 0.115, 0.042, 1)
    bsdf.inputs["Metallic"].default_value = 0.78
    bsdf.inputs["Roughness"].default_value = 0.38
    obj.data.materials.clear()
    obj.data.materials.append(material)
    bpy.context.view_layer.objects.active = obj
    bevel = obj.modifiers.new("Artist_edge_bevel_4mm", "BEVEL")
    bevel.width = 0.004
    bevel.segments = 3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    if len(obj.data.vertices) <= before:
        raise RuntimeError("Handle bevel did not change the mesh: " + name)
    edited.append({"name": name, "verticesBefore": before,
                   "verticesAfter": len(obj.data.vertices),
                   "edit": "4mm three-segment bevel and aged brass PBR"})

# .blend retains semantic editable objects/material nodes, not a flattened bake.
bpy.ops.wm.save_as_mainfile(filepath=str(folder / "timber-house-editable.blend"))
bpy.ops.export_scene.gltf(
    filepath=str(folder / "timber-house-edited.glb"), export_format="GLB",
    export_yup=True, export_extras=True, export_apply=False,
    export_materials="EXPORT", export_cameras=False, export_lights=False,
    export_animations=False, export_keep_originals=False,
)
report = {
    "schema": "sunbreak-blender-house-roundtrip-v1",
    "blender": bpy.app.version_string,
    "input": "timber-house-source.glb",
    "output": "timber-house-edited.glb",
    "editableProject": "timber-house-editable.blend",
    "edits": edited,
    "method": "Actual background Blender import, mesh modifier, material edit, save and GLB export. No human manual art edit is claimed.",
}
(folder / "blender-roundtrip.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print("HOUSE_ROUNDTRIP_SAVED " + json.dumps(report))
