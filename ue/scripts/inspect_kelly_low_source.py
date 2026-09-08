import json
import os

import unreal


MESH_PATH = "/Game/asda.asda"
EXPECTED_SKELETON = "/Game/asda_Skeleton.asda_Skeleton"
EXPECTED_PHYSICS_ASSET = "/Game/asda_PhysicsAsset.asda_PhysicsAsset"
EXPECTED_PACKAGES = {
    "/Game/asda": "SkeletalMesh",
    "/Game/asda_Skeleton": "Skeleton",
    "/Game/asda_PhysicsAsset": "PhysicsAsset",
    "/Game/15_-_Default": "MaterialInstanceConstant",
    "/Game/Material__1205": "MaterialInstanceConstant",
    "/Game/Material__1207": "MaterialInstanceConstant",
    "/Game/Material__1335": "MaterialInstanceConstant",
    "/Game/Material__1337": "MaterialInstanceConstant",
    "/Game/Material__1362": "MaterialInstanceConstant",
    "/Game/female_Newbody_d": "Texture2D",
    "/Game/female_hair_sc_runner_d": "Texture2D",
    "/Game/Female_Head_Sc_Kelly_Awakening_Facial_D_new": "Texture2D",
    "/Game/female_sc_runner_bottom_001_d": "Texture2D",
    "/Game/female_sc_runner_shoe_001_d": "Texture2D",
    "/Game/female_sc_runner_top_001_d": "Texture2D",
}
REQUIRED_BONE_EDGES = (
    ("bone_Root", "Bip01"),
    ("Bip01", "bone_Hips"),
    ("bone_Hips", "bone_Spine"),
    ("bone_Spine", "bone_Spine1"),
    ("bone_Spine1", "bone_Neck"),
    ("bone_Neck", "bone_Head"),
    ("bone_Spine1", "bone_LeftClav"),
    ("bone_LeftClav", "bone_LeftArm"),
    ("bone_LeftArm", "bone_LeftForeArm"),
    ("bone_LeftForeArm", "bone_LeftHand"),
    ("bone_Spine1", "bone_RightClav"),
    ("bone_RightClav", "bone_RightArm"),
    ("bone_RightArm", "bone_RightForeArm"),
    ("bone_RightForeArm", "bone_RightHand"),
    ("bone_Hips", "bone_LeftLegUpper"),
    ("bone_LeftLegUpper", "bone_LeftLeg"),
    ("bone_LeftLeg", "bone_LeftAnkle"),
    ("bone_LeftAnkle", "bone_LeftToe"),
    ("bone_Hips", "bone_RightLegUpper"),
    ("bone_RightLegUpper", "bone_RightLeg"),
    ("bone_RightLeg", "bone_RightAnkle"),
    ("bone_RightAnkle", "bone_RightToe"),
)


def dependency_options():
    return unreal.AssetRegistryDependencyOptions(
        include_soft_package_references=True,
        include_hard_package_references=True,
        include_searchable_names=True,
        include_soft_management_references=True,
        include_hard_management_references=True,
    )


def output_path():
    value = os.environ.get("KELLY_LOW_INSPECT_OUTPUT", "").strip()
    if not value or not os.path.isabs(value):
        raise RuntimeError(
            "KELLY_LOW_INSPECT_OUTPUT must be an explicit absolute JSON path"
        )
    value = os.path.normcase(os.path.realpath(value))
    if not value.lower().endswith(".json"):
        raise RuntimeError("KELLY_LOW_INSPECT_OUTPUT must end in .json")
    source_root_value = os.environ.get("KELLY_LOW_SOURCE_ROOT", "").strip()
    if not source_root_value or not os.path.isabs(source_root_value):
        raise RuntimeError("KELLY_LOW_SOURCE_ROOT must be an explicit absolute path")
    source_root = os.path.normcase(os.path.realpath(source_root_value))
    try:
        inside_source = os.path.commonpath((value, source_root)) == source_root
    except ValueError:
        inside_source = False
    if inside_source:
        raise RuntimeError("Inspection output must not be inside the Kelly source")
    return value


def object_path(package_name, asset_name):
    return "{}.{}".format(package_name, asset_name)


def main():
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    registry.search_all_assets(True)

    inventory = []
    package_classes = {}
    for asset_data in registry.get_assets_by_path("/Game", recursive=True):
        package_name = str(asset_data.package_name)
        if package_name.startswith("/Game/__External"):
            continue
        class_name = str(asset_data.asset_class_path.asset_name)
        asset_name = str(asset_data.asset_name)
        package_classes[package_name] = class_name
        inventory.append(
            {
                "package_name": package_name,
                "asset_name": asset_name,
                "object_path": object_path(package_name, asset_name),
                "class": class_name,
            }
        )

    mesh = unreal.EditorAssetLibrary.load_asset(MESH_PATH)
    if not mesh or not isinstance(mesh, unreal.SkeletalMesh):
        raise RuntimeError("Expected SkeletalMesh at " + MESH_PATH)

    skeleton = mesh.get_editor_property("skeleton")
    physics_asset = mesh.get_editor_property("physics_asset")
    if not skeleton:
        raise RuntimeError("Low Kelly mesh has no skeleton")
    if not physics_asset:
        raise RuntimeError("Low Kelly mesh has no PhysicsAsset")
    if not isinstance(skeleton, unreal.Skeleton):
        raise RuntimeError("Low Kelly skeleton reference is not a Skeleton")
    if not isinstance(physics_asset, unreal.PhysicsAsset):
        raise RuntimeError("Low Kelly physics reference is not a PhysicsAsset")
    if skeleton.get_path_name() != EXPECTED_SKELETON:
        raise RuntimeError(
            "Low Kelly mesh references unexpected skeleton: "
            + skeleton.get_path_name()
        )
    if physics_asset.get_path_name() != EXPECTED_PHYSICS_ASSET:
        raise RuntimeError(
            "Low Kelly mesh references unexpected PhysicsAsset: "
            + physics_asset.get_path_name()
        )

    materials = []
    material_packages = set()
    for index, slot in enumerate(mesh.get_editor_property("materials")):
        material = slot.get_editor_property("material_interface")
        if not material:
            raise RuntimeError("Low Kelly material slot {} is empty".format(index))
        material_path = material.get_path_name()
        material_package = material_path.split(".", 1)[0]
        material_packages.add(material_package)
        texture_parameters = []
        bound_game_textures = set()
        if isinstance(material, unreal.MaterialInstance):
            for parameter in unreal.MaterialEditingLibrary.get_texture_parameter_names(
                material
            ):
                texture = unreal.MaterialEditingLibrary.get_material_instance_texture_parameter_value(
                    material,
                    parameter,
                )
                texture_parameters.append(
                    {
                        "name": str(parameter),
                        "texture": texture.get_path_name() if texture else None,
                    }
                )
                if texture and texture.get_path_name().startswith("/Game/"):
                    bound_game_textures.add(texture.get_path_name())
        if not bound_game_textures:
            raise RuntimeError(
                "Visible material slot {} has no bound /Game texture: {}".format(
                    index, material_path
                )
            )
        materials.append(
            {
                "index": index,
                "slot_name": str(slot.get_editor_property("material_slot_name")),
                "material": material_path,
                "texture_parameters": texture_parameters,
                "bound_game_textures": sorted(bound_game_textures),
            }
        )

    reference_pose = skeleton.get_reference_pose()
    bones = [str(name) for name in reference_pose.get_bone_names()]
    if len(bones) < 20:
        raise RuntimeError(
            "Low Kelly skeleton is unexpectedly small: {} bones".format(len(bones))
        )
    bone_set = set(bones)
    for parent, child in REQUIRED_BONE_EDGES:
        if parent not in bone_set or child not in bone_set:
            raise RuntimeError(
                "Low Kelly skeleton is missing required chain edge {} -> {}".format(
                    parent, child
                )
            )
        children = {str(value) for value in mesh.get_bone_children(parent)}
        if child not in children:
            raise RuntimeError(
                "Low Kelly skeleton parent mismatch; expected {} -> {}".format(
                    parent, child
                )
            )

    options = dependency_options()
    closure = set()
    pending = [MESH_PATH.split(".", 1)[0]]
    dependencies = {}
    while pending:
        package_name = pending.pop()
        if package_name in closure:
            continue
        if package_name.startswith(
            ("/Game/__External", "/Game/HLOD", "/Game/_Generated_")
        ):
            raise RuntimeError(
                "Low Kelly closure contains forbidden generated package: "
                + package_name
            )
        asset_data = registry.get_assets_by_package_name(package_name)
        if len(asset_data) != 1:
            raise RuntimeError(
                "Expected exactly one loadable asset in package {} but found {}".format(
                    package_name, len(asset_data)
                )
            )
        class_name = str(asset_data[0].asset_class_path.asset_name)
        if package_name not in EXPECTED_PACKAGES:
            raise RuntimeError(
                "Low Kelly closure contains unexpected package {} ({})".format(
                    package_name, class_name
                )
            )
        if class_name != EXPECTED_PACKAGES[package_name]:
            raise RuntimeError(
                "Low Kelly package {} expected class {}, got {}".format(
                    package_name, EXPECTED_PACKAGES[package_name], class_name
                )
            )
        if not asset_data[0].get_asset():
            raise RuntimeError("Low Kelly dependency does not load: " + package_name)
        closure.add(package_name)
        package_dependencies = [
            str(value)
            for value in registry.get_dependencies(package_name, options)
            if str(value).startswith("/Game/")
        ]
        dependencies[package_name] = package_dependencies
        for dependency in package_dependencies:
            if dependency not in closure:
                pending.append(dependency)

    texture_packages = sorted(
        package_name
        for package_name in closure
        if package_classes.get(package_name, "").startswith("Texture")
    )
    closure_materials = sorted(
        package_name
        for package_name in closure
        if package_classes.get(package_name, "") in ("Material", "MaterialInstanceConstant")
    )
    missing_materials = sorted(material_packages - closure)
    if missing_materials:
        raise RuntimeError(
            "Mesh material packages are absent from dependency closure: "
            + ", ".join(missing_materials)
        )
    if not texture_packages:
        raise RuntimeError(
            "Low Kelly dependency closure contains no referenced texture assets"
        )
    if closure != set(EXPECTED_PACKAGES):
        missing = sorted(set(EXPECTED_PACKAGES) - closure)
        extra = sorted(closure - set(EXPECTED_PACKAGES))
        raise RuntimeError(
            "Low Kelly fixed migration list mismatch; missing={} extra={}".format(
                missing, extra
            )
        )

    for material in materials:
        material_package = material["material"].split(".", 1)[0]
        dependency_textures = {
            dependency
            for dependency in dependencies.get(material_package, [])
            if package_classes.get(dependency, "").startswith("Texture")
        }
        bound_texture_packages = {
            value.split(".", 1)[0] for value in material["bound_game_textures"]
        }
        if not bound_texture_packages.issubset(dependency_textures):
            raise RuntimeError(
                "Visible material {} binds textures absent from its dependency "
                "record: {}".format(
                    material["material"],
                    sorted(bound_texture_packages - dependency_textures),
                )
            )

    bounds = mesh.get_bounds()
    result = {
        "project": unreal.Paths.get_project_file_path(),
        "mesh": MESH_PATH,
        "skeleton": skeleton.get_path_name(),
        "physics_asset": physics_asset.get_path_name(),
        "material_slot_count": len(materials),
        "materials": materials,
        "bone_count": len(bones),
        "bones": bones,
        "bounds_origin": str(bounds.origin),
        "bounds_extent": str(bounds.box_extent),
        "closure": sorted(closure),
        "closure_count": len(closure),
        "closure_materials": closure_materials,
        "texture_packages": texture_packages,
        "texture_count": len(texture_packages),
        "dependencies": dependencies,
        "inventory": sorted(inventory, key=lambda item: item["package_name"]),
    }

    path = output_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as output:
        json.dump(result, output, ensure_ascii=False, indent=2)

    unreal.log(
        "[KellyLowInspect] Inspection passed mesh={} materials={} textures={} "
        "bones={} closure={}".format(
            MESH_PATH,
            len(materials),
            len(texture_packages),
            len(bones),
            len(closure),
        )
    )


main()
