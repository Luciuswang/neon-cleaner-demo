"""Import prepared, attributed pursuit car. Integrator owns serialized UE invocation."""
import json
import math
from pathlib import Path
import unreal

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / ".local/assets/CarConcept/prepared"
DEST = "/Game/LinxiaChase/CinematicCar"


def main():
    manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    unreal.EditorAssetLibrary.make_directory(DEST)
    unreal.EditorAssetLibrary.make_directory(DEST + "/Textures")
    unreal.EditorAssetLibrary.make_directory(DEST + "/Materials")
    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
    textures = {}
    needed = set()
    for mat in manifest["materials"]:
        for key in ("color_texture", "orm_texture", "normal_texture", "emissive_texture"):
            if mat.get(key) and mat["index"] != 9:
                needed.add(mat[key])
    for name in sorted(needed):
        task = unreal.AssetImportTask()
        task.filename = str(SOURCE / "textures" / (name + ".png"))
        task.destination_path = DEST + "/Textures"
        task.destination_name = name
        task.automated = True
        task.replace_existing = True
        task.save = True
        asset_tools.import_asset_tasks([task])
        texture = unreal.load_asset(DEST + "/Textures/" + name)
        if not texture:
            raise RuntimeError("Missing imported texture " + name)
        is_normal = name.endswith("_DX")
        is_data = is_normal or any(m.get("orm_texture") == name for m in manifest["materials"])
        texture.set_editor_property("srgb", not is_data)
        if is_normal:
            texture.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP)
            texture.set_editor_property("flip_green_channel", False)
        elif is_data:
            texture.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_MASKS)
        unreal.EditorAssetLibrary.save_loaded_asset(texture)
        textures[name] = texture

    lib = unreal.MaterialEditingLibrary
    materials = {}
    def const(mat, value):
        if isinstance(value, (tuple, list)):
            expr = lib.create_material_expression(mat, unreal.MaterialExpressionConstant3Vector)
            expr.set_editor_property("constant", unreal.LinearColor(*value[:3], 1))
        else:
            expr = lib.create_material_expression(mat, unreal.MaterialExpressionConstant)
            expr.set_editor_property("r", float(value))
        return expr

    def vector2(mat, values):
        expr = lib.create_material_expression(mat, unreal.MaterialExpressionConstant2Vector)
        expr.set_editor_property("r", float(values[0]))
        expr.set_editor_property("g", float(values[1]))
        return expr

    def binary(mat, kind, a, a_pin, b, b_pin=""):
        expr = lib.create_material_expression(mat, kind)
        if not lib.connect_material_expressions(a, a_pin, expr, "A"):
            raise RuntimeError("Cannot connect A for " + str(kind))
        if not lib.connect_material_expressions(b, b_pin, expr, "B"):
            raise RuntimeError("Cannot connect B for " + str(kind))
        return expr

    def sample(mat, name, normal=False, info=None):
        expr = lib.create_material_expression(mat, unreal.MaterialExpressionTextureSample)
        expr.set_editor_property("texture", textures[name])
        if normal:
            expr.set_editor_property("sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL)
        elif not textures[name].get_editor_property("srgb"):
            expr.set_editor_property("sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_MASKS)
        info = info or {}
        channel = int(info.get("tex_coord", 0))
        if channel not in manifest.get("exported_uv_channels", [0]):
            raise RuntimeError("Texture " + name + " needs absent UV" + str(channel) + "; refusing UV0 substitution")
        coordinates = lib.create_material_expression(mat, unreal.MaterialExpressionTextureCoordinate)
        coordinates.set_editor_property("coordinate_index", channel)
        scale = info.get("scale", [1.0, 1.0])
        offset = info.get("offset", [0.0, 0.0])
        angle = float(info.get("rotation_radians", 0.0))
        coordinates = binary(mat, unreal.MaterialExpressionMultiply, coordinates, "", vector2(mat, scale))
        if abs(angle) > 1e-9:
            cosine, sine = math.cos(angle), math.sin(angle)
            u = binary(mat, unreal.MaterialExpressionDotProduct, coordinates, "", vector2(mat, [cosine, -sine]))
            v = binary(mat, unreal.MaterialExpressionDotProduct, coordinates, "", vector2(mat, [sine, cosine]))
            coordinates = binary(mat, unreal.MaterialExpressionAppendVector, u, "", v)
        coordinates = binary(mat, unreal.MaterialExpressionAdd, coordinates, "", vector2(mat, offset))
        if not lib.connect_material_expressions(coordinates, "", expr, "UVs"):
            raise RuntimeError("Cannot connect transformed UV for " + name)
        return expr

    def multiply(mat, a, a_pin, b):
        expr = lib.create_material_expression(mat, unreal.MaterialExpressionMultiply)
        lib.connect_material_expressions(a, a_pin, expr, "A")
        lib.connect_material_expressions(b, "", expr, "B")
        return expr

    def connect(expr, pin, prop):
        # CustomData0/1 are hidden from the Python enum. MakeMaterialAttributes
        # exposes ClearCoat inputs by their reflected FExpressionInput names.
        input_names = {
            "MP_BASE_COLOR": "BaseColor", "MP_METALLIC": "Metallic",
            "MP_ROUGHNESS": "Roughness", "MP_NORMAL": "Normal",
            "MP_OPACITY": "Opacity", "MP_EMISSIVE_COLOR": "EmissiveColor",
            "CLEAR_COAT": "ClearCoat", "CLEAR_COAT_ROUGHNESS": "ClearCoatRoughness",
        }
        if not lib.connect_material_expressions(expr, pin, attributes, input_names[prop]):
            raise RuntimeError("Cannot connect material attribute " + input_names[prop])

    for desc in manifest["materials"]:
        if desc["index"] == 9:
            continue
        name = desc["name"]
        infos = desc.get("texture_infos", {})
        ao = infos.get("occlusion_texture")
        if ao and ao.get("tex_coord", 0) not in manifest.get("exported_uv_channels", [0]):
            unreal.log_warning("[CinematicCar] " + name + " source AO uses UV" + str(ao["tex_coord"]) + "; OBJ has UV0 only, AO explicitly omitted")
        # Native enemy CDOs can root previously imported graphs. Keep graph
        # revisions immutable instead of deleting rooted expressions on reruns.
        graph_name = name + "_v2"
        material = unreal.load_asset(DEST + "/Materials/" + graph_name)
        if material:
            materials[name] = material
            continue
        material = asset_tools.create_asset(graph_name, DEST + "/Materials", unreal.Material, unreal.MaterialFactoryNew())
        material.set_editor_property("use_material_attributes", True)
        attributes = lib.create_material_expression(material, unreal.MaterialExpressionMakeMaterialAttributes)
        if not lib.connect_material_property(attributes, "", unreal.MaterialProperty.MP_MATERIAL_ATTRIBUTES):
            raise RuntimeError("Cannot connect MakeMaterialAttributes to " + name)
        material.set_editor_property("two_sided", desc["double_sided"])
        if desc["glass"]:
            material.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
            material.set_editor_property("translucency_lighting_mode", unreal.TranslucencyLightingMode.TLM_SURFACE_PER_PIXEL_LIGHTING)
            connect(const(material, 0.22), "", "MP_OPACITY")
        else:
            material.set_editor_property("blend_mode", unreal.BlendMode.BLEND_OPAQUE)
        color = desc["base_color"][:3]
        # Adapt the car's existing glossy red finish to graphite pursuit livery.
        if desc["index"] in (10, 11):
            color = [0.055, 0.07, 0.085] if desc["index"] == 11 else [0.012, 0.015, 0.018]
        base = const(material, color)
        if desc.get("color_texture"):
            base = multiply(material, sample(material, desc["color_texture"], info=infos.get("color_texture")), "RGB", base)
        connect(base, "", "MP_BASE_COLOR")
        if desc.get("normal_texture"):
            normal_info = infos.get("normal_texture") or {}
            normal = sample(material, desc["normal_texture"], True, normal_info)
            strength = float(normal_info.get("normal_strength", 1.0))
            scaled = multiply(material, normal, "RGB", const(material, [strength, strength, 1.0]))
            normalized = lib.create_material_expression(material, unreal.MaterialExpressionNormalize)
            if not lib.connect_material_expressions(scaled, "", normalized, ""):
                raise RuntimeError("Cannot normalize scaled normal for " + name)
            connect(normalized, "", "MP_NORMAL")
        if desc.get("orm_texture"):
            packed = sample(material, desc["orm_texture"], info=infos.get("orm_texture"))
            connect(multiply(material, packed, "G", const(material, desc["roughness"])), "", "MP_ROUGHNESS")
            connect(multiply(material, packed, "B", const(material, desc["metallic"])), "", "MP_METALLIC")
        else:
            connect(const(material, max(0.04, desc["roughness"])), "", "MP_ROUGHNESS")
            connect(const(material, desc["metallic"]), "", "MP_METALLIC")
        if desc["clearcoat"] or desc["index"] in (10, 11):
            material.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_CLEAR_COAT)
            connect(const(material, 1.0), "", "CLEAR_COAT")
            connect(const(material, 0.12), "", "CLEAR_COAT_ROUGHNESS")
        emission = [v * desc["emissive_strength"] for v in desc["emissive"]]
        if any(emission):
            expr = const(material, emission)
            if desc.get("emissive_texture"):
                expr = multiply(material, sample(material, desc["emissive_texture"], info=infos.get("emissive_texture")), "RGB", expr)
            connect(expr, "", "MP_EMISSIVE_COLOR")
        lib.recompile_material(material)
        unreal.EditorAssetLibrary.save_loaded_asset(material)
        materials[name] = material

    measured_bounds = []
    mesh_editor = unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem)
    for desc in manifest["parts"]:
        task = unreal.AssetImportTask()
        task.filename = str(SOURCE / desc["file"])
        task.destination_path = DEST
        task.destination_name = desc["name"]
        task.automated = True
        task.replace_existing = True
        task.save = True
        options = unreal.FbxImportUI()
        options.set_editor_property("import_materials", False)
        options.set_editor_property("import_textures", False)
        options.set_editor_property("import_mesh", True)
        options.set_editor_property("import_as_skeletal", False)
        options.set_editor_property("automated_import_should_detect_type", False)
        options.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_STATIC_MESH)
        data = options.get_editor_property("static_mesh_import_data")
        data.set_editor_property("combine_meshes", True)
        data.set_editor_property("convert_scene", False)
        data.set_editor_property("convert_scene_unit", False)
        data.set_editor_property("import_uniform_scale", 1.0)
        data.set_editor_property("generate_lightmap_u_vs", False)
        data.set_editor_property("normal_import_method", unreal.FBXNormalImportMethod.FBXNIM_IMPORT_NORMALS)
        task.options = options
        asset_tools.import_asset_tasks([task])
        mesh = unreal.load_asset(DEST + "/" + desc["name"])
        if not mesh:
            raise RuntimeError("Mesh import failed " + desc["name"])
        slots = mesh.get_editor_property("static_materials")
        for i, slot in enumerate(slots):
            candidates = [str(slot.get_editor_property("imported_material_slot_name")), str(slot.get_editor_property("material_slot_name"))]
            key = next((name for name in materials if any(name == c or c.startswith(name + "_") for c in candidates)), None)
            if not key:
                raise RuntimeError("Cannot map material slot " + str(candidates) + " on " + desc["name"])
            mesh.set_material(i, materials[key])
        lod_options = unreal.StaticMeshReductionOptions()
        lod_options.set_editor_property("auto_compute_lod_screen_size", False)
        lod_settings = []
        for triangle_fraction, screen_size in ((1.0, 1.0), (0.5, 0.28), (0.2, 0.10)):
            settings = unreal.StaticMeshReductionSettings()
            settings.set_editor_property("percent_triangles", triangle_fraction)
            settings.set_editor_property("screen_size", screen_size)
            lod_settings.append(settings)
        lod_options.set_editor_property("reduction_settings", lod_settings)
        if mesh_editor:
            if mesh_editor.set_lods(mesh, lod_options) != 3:
                raise RuntimeError("Could not generate three LODs for " + desc["name"])
        else:
            # Commandlets do not initialize the editor subsystem collection.
            # Constructing a detached subsystem is unsafe: SetLods internally
            # dereferences GEditor's AssetEditorSubsystem without a null check.
            # Preserve imported LOD0; a full editor invocation generates LODs.
            unreal.log_warning("[CinematicCar] LOD GENERATION DEFERRED: editor subsystem unavailable; retaining full-detail LOD0 for " + desc["name"])
        unreal.EditorAssetLibrary.save_loaded_asset(mesh)
        bounds = mesh.get_bounds()
        origin = bounds.origin
        extent = bounds.box_extent
        pivot = desc["pivot_cm"]
        measured_bounds.append((
            [origin.x - extent.x + pivot[0], origin.y - extent.y + pivot[1], origin.z - extent.z + pivot[2]],
            [origin.x + extent.x + pivot[0], origin.y + extent.y + pivot[1], origin.z + extent.z + pivot[2]],
        ))
        unreal.log("[CinematicCar] Imported " + mesh.get_path_name() + " pivot_cm=" + str(desc["pivot_cm"]))
    measured_min = [min(item[0][axis] for item in measured_bounds) for axis in range(3)]
    measured_max = [max(item[1][axis] for item in measured_bounds) for axis in range(3)]
    measured_size = [measured_max[axis] - measured_min[axis] for axis in range(3)]
    expected = manifest["dimensions_cm"]
    if any(abs(measured_size[axis] - expected[axis]) > 1.0 for axis in range(3)):
        raise RuntimeError("Car import axis/scale mismatch: expected cm " + str(expected) + " measured " + str(measured_size))
    if abs(measured_min[2]) > 1.0:
        raise RuntimeError("Car import is not grounded at Z0: " + str(measured_min))
    unreal.log("[CinematicCar] Bounds PASS dimensions_cm=" + str(measured_size) + " minimum_cm=" + str(measured_min))
    unreal.log("[CinematicCar] Import complete; 480cm vehicle, centered wheel pivots, visual QA pending")


if __name__ == "__main__":
    main()
