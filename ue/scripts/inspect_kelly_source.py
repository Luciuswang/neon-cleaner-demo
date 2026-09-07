import json
import os

import unreal


KEY_ASSETS = (
    "/Game/rig.rig",
    "/Game/rig_Skeleton.rig_Skeleton",
    "/Game/rig_PhysicsAsset.rig_PhysicsAsset",
    "/Game/rig_Anim.rig_Anim",
)

EXPECTED_CLASSES = {
    "/Game/rig.rig": "SkeletalMesh",
    "/Game/rig_Skeleton.rig_Skeleton": "Skeleton",
    "/Game/rig_PhysicsAsset.rig_PhysicsAsset": "PhysicsAsset",
    "/Game/rig_Anim.rig_Anim": "AnimSequence",
}

REQUIRED_MATERIALS = (
    "/Game/hhh_xin_body_sss1.hhh_xin_body_sss1",
    "/Game/hhh_xin_Surface14.hhh_xin_Surface14",
    "/Game/lambert1.lambert1",
    "/Game/lambert29.lambert29",
    "/Game/xin_eye4.xin_eye4",
    "/Game/xin_eye5.xin_eye5",
    "/Game/xin_meimao2.xin_meimao2",
    "/Game/xin_Surface12.xin_Surface12",
    "/Game/xin_Surface13.xin_Surface13",
    "/Game/xin_Surface14.xin_Surface14",
    "/Game/xin_Surface15.xin_Surface15",
    "/Game/xin_Surface16.xin_Surface16",
    "/Game/xin__EYE2.xin__EYE2",
)

EXPECTED_SKELETON = "/Game/rig_Skeleton.rig_Skeleton"
EXPECTED_PHYSICS_ASSET = "/Game/rig_PhysicsAsset.rig_PhysicsAsset"
EXPECTED_BONE_ROOT = "Root_M"
ORIGINAL_SOURCE_ROOT = os.path.normcase(os.path.realpath(r"D:\kelly-UE"))
REQUIRED_BONES = (
    "Root_M",
    "Spine1_M",
    "Shoulder_L",
    "Shoulder_R",
    "Elbow_L",
    "Elbow_R",
    "Wrist_L",
    "Wrist_R",
    "Hip_L",
    "Hip_R",
    "Knee_L",
    "Knee_R",
    "Ankle_L",
    "Ankle_R",
)


def object_path(value):
    return value.get_path_name() if value else None


def safe_call(label, callback, default=None):
    try:
        return callback()
    except Exception as exc:
        unreal.log_warning("[KellySourceInspect] {}: {}".format(label, exc))
        return default


def inspect_mesh(mesh):
    bounds = safe_call("mesh bounds", mesh.get_bounds)
    materials = []
    for index, slot in enumerate(mesh.get_editor_property("materials")):
        material = safe_call(
            "material slot {}".format(index),
            lambda slot=slot: slot.get_editor_property("material_interface"),
        )
        slot_name = safe_call(
            "material slot name {}".format(index),
            lambda slot=slot: str(slot.get_editor_property("material_slot_name")),
        )
        materials.append(
            {
                "index": index,
                "slot_name": slot_name,
                "material": object_path(material),
            }
        )

    import_data = safe_call(
        "mesh import data",
        lambda: mesh.get_editor_property("asset_import_data"),
    )
    source_files = safe_call(
        "mesh source files",
        lambda: list(import_data.extract_filenames()) if import_data else [],
        [],
    )

    return {
        "skeleton": object_path(mesh.get_editor_property("skeleton")),
        "physics_asset": object_path(mesh.get_editor_property("physics_asset")),
        "materials": materials,
        "material_slot_count": len(materials),
        "bounds_origin": str(bounds.origin) if bounds else None,
        "bounds_box_extent": str(bounds.box_extent) if bounds else None,
        "bounds_sphere_radius": bounds.sphere_radius if bounds else None,
        "source_files": source_files,
    }


def inspect_bones(mesh):
    bones = []
    visited = set()

    def visit(name, depth):
        name = str(name)
        if not name or name == "None" or name in visited:
            return
        visited.add(name)
        parent = str(mesh.get_bone_parent(name))
        bones.append(
            {
                "index": len(bones),
                "name": name,
                "parent": parent,
                "depth": depth,
            }
        )
        children = list(mesh.get_bone_children(name))
        for child in children:
            visit(child, depth + 1)

    visit(EXPECTED_BONE_ROOT, 0)
    return {
        "root": EXPECTED_BONE_ROOT,
        "bone_count": len(bones),
        "bones": bones,
    }


def inspect_animation(animation):
    import_data = safe_call(
        "animation import data",
        lambda: animation.get_editor_property("asset_import_data"),
    )
    track_names = safe_call(
        "animation track names",
        lambda: [
            str(name)
            for name in unreal.AnimationLibrary.get_animation_track_names(animation)
        ],
        [],
    )
    return {
        "skeleton": object_path(animation.get_editor_property("skeleton")),
        "play_length": safe_call(
            "animation length",
            lambda: unreal.AnimationLibrary.get_sequence_length(animation),
        ),
        "sampled_keys": safe_call(
            "animation sampled keys",
            lambda: animation.get_editor_property("number_of_sampled_keys"),
        ),
        "track_names": track_names,
        "track_count": len(track_names),
        "source_files": safe_call(
            "animation source files",
            lambda: list(import_data.extract_filenames()) if import_data else [],
            [],
        ),
    }


def require(condition, message, errors):
    if not condition:
        errors.append(message)


def validate(key_assets):
    errors = []

    for path, expected_class in EXPECTED_CLASSES.items():
        record = key_assets.get(path, {})
        require(record.get("loaded"), "Missing required asset: " + path, errors)
        require(
            record.get("class") == expected_class,
            "{} must be {}, got {}".format(
                path,
                expected_class,
                record.get("class"),
            ),
            errors,
        )

    mesh = key_assets.get("/Game/rig.rig", {})
    animation = key_assets.get("/Game/rig_Anim.rig_Anim", {})
    require(
        mesh.get("skeleton") == EXPECTED_SKELETON,
        "Kelly mesh does not reference the required skeleton",
        errors,
    )
    require(
        animation.get("skeleton") == EXPECTED_SKELETON,
        "Kelly animation does not reference the same Kelly skeleton",
        errors,
    )
    require(
        mesh.get("physics_asset") == EXPECTED_PHYSICS_ASSET,
        "Kelly mesh does not reference the required physics asset",
        errors,
    )

    materials = mesh.get("materials", [])
    material_paths = [slot.get("material") for slot in materials]
    require(
        mesh.get("material_slot_count") == len(REQUIRED_MATERIALS),
        "Kelly mesh must have {} material slots, got {}".format(
            len(REQUIRED_MATERIALS),
            mesh.get("material_slot_count"),
        ),
        errors,
    )
    require(
        all(material_paths),
        "Kelly mesh contains one or more empty material references",
        errors,
    )
    require(
        set(material_paths) == set(REQUIRED_MATERIALS),
        "Kelly mesh material references do not match the required closure",
        errors,
    )

    bone_names = [bone.get("name") for bone in mesh.get("bones", [])]
    require(
        mesh.get("bone_count", 0) >= len(REQUIRED_BONES),
        "Kelly mesh bone hierarchy is empty or truncated",
        errors,
    )
    missing_bones = sorted(set(REQUIRED_BONES) - set(bone_names))
    require(not missing_bones, "Kelly mesh is missing required bones: " + ", ".join(missing_bones), errors)

    for path in REQUIRED_MATERIALS:
        material = unreal.EditorAssetLibrary.load_asset(path)
        require(
            material is not None,
            "Required Kelly material is missing: " + path,
            errors,
        )
        require(
            isinstance(material, unreal.MaterialInterface),
            "Required Kelly material has wrong type: " + path,
            errors,
        )

    allowed_packages = {
        path.split(".", 1)[0]
        for path in KEY_ASSETS + REQUIRED_MATERIALS
    }
    dependency_options = unreal.AssetRegistryDependencyOptions(
        include_soft_package_references=True,
        include_hard_package_references=True,
        include_searchable_names=True,
        include_soft_management_references=True,
        include_hard_management_references=True,
    )
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    pending = list(allowed_packages)
    visited = set()
    while pending:
        package_name = pending.pop()
        if package_name in visited:
            continue
        visited.add(package_name)
        for dependency in registry.get_dependencies(package_name, dependency_options):
            dependency = str(dependency)
            if not dependency.startswith("/Game/"):
                continue
            require(
                dependency in allowed_packages,
                "Unexpected /Game dependency outside Kelly closure: {} -> {}".format(
                    package_name,
                    dependency,
                ),
                errors,
            )
            if dependency in allowed_packages and dependency not in visited:
                pending.append(dependency)

    forbidden_tokens = ("/__ExternalActors__/", "/__ExternalObjects__/", "HLOD")
    for package_name in visited:
        require(
            not any(token.lower() in package_name.lower() for token in forbidden_tokens),
            "Forbidden map/HLOD/external package in Kelly closure: " + package_name,
            errors,
        )

    if errors:
        raise RuntimeError(
            "Kelly source inspection failed:\n- " + "\n- ".join(errors)
        )


def get_output_path():
    output_path = os.environ.get("KELLY_INSPECT_OUTPUT", "").strip()
    if not output_path:
        raise RuntimeError(
            "KELLY_INSPECT_OUTPUT must be set to an explicit absolute JSON path"
        )
    if not os.path.isabs(output_path):
        raise RuntimeError("KELLY_INSPECT_OUTPUT must be absolute")
    output_path = os.path.normcase(os.path.realpath(output_path))
    if not output_path.lower().endswith(".json"):
        raise RuntimeError("KELLY_INSPECT_OUTPUT must end in .json")
    try:
        inside_original_source = (
            os.path.commonpath((output_path, ORIGINAL_SOURCE_ROOT))
            == ORIGINAL_SOURCE_ROOT
        )
    except ValueError:
        inside_original_source = False
    if inside_original_source:
        raise RuntimeError(
            "KELLY_INSPECT_OUTPUT must not be inside the original D:\\kelly-UE source"
        )
    return output_path


def main():
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    registry.search_all_assets(True)

    assets = registry.get_assets_by_path("/Game", recursive=True)
    inventory = []
    for asset_data in assets:
        package_name = str(asset_data.package_name)
        if package_name.startswith("/Game/__External"):
            continue
        inventory.append(
            {
                "asset_name": str(asset_data.asset_name),
                "package_name": package_name,
                "object_path": "{}.{}".format(
                    package_name,
                    str(asset_data.asset_name),
                ),
                "class": str(asset_data.asset_class_path.asset_name),
            }
        )

    dependency_options = unreal.AssetRegistryDependencyOptions(
        include_soft_package_references=True,
        include_hard_package_references=True,
        include_searchable_names=True,
        include_soft_management_references=True,
        include_hard_management_references=True,
    )

    key_assets = {}
    for path in KEY_ASSETS:
        asset = unreal.load_asset(path)
        if not asset:
            key_assets[path] = {"loaded": False}
            continue

        package_name = path.split(".", 1)[0]
        record = {
            "loaded": True,
            "class": asset.get_class().get_name(),
            "dependencies": [
                str(name)
                for name in registry.get_dependencies(
                    package_name,
                    dependency_options,
                )
            ],
            "referencers": [
                str(name)
                for name in unreal.EditorAssetLibrary.find_package_referencers_for_asset(
                    path,
                    False,
                )
            ],
        }
        if isinstance(asset, unreal.SkeletalMesh):
            record.update(inspect_mesh(asset))
            record.update(inspect_bones(asset))
        elif isinstance(asset, unreal.AnimSequence):
            record.update(inspect_animation(asset))
        key_assets[path] = record

    validate(key_assets)

    result = {
        "project_name": unreal.Paths.get_project_file_path(),
        "asset_count_without_external_actors": len(inventory),
        "inventory": sorted(inventory, key=lambda item: item["package_name"]),
        "key_assets": key_assets,
    }

    output_path = get_output_path()
    output_dir = os.path.dirname(output_path)
    os.makedirs(output_dir, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as output:
        json.dump(result, output, ensure_ascii=False, indent=2)

    unreal.log(
        "[KellySourceInspect] Saved {} assets to {}".format(
            len(inventory),
            output_path,
        )
    )
    unreal.log("[KellySourceInspect] Inspection passed")


main()
