import unreal


ROOT = "/Game/KellySource"
ASSET_NAMES = (
    "rig",
    "rig_Skeleton",
    "rig_PhysicsAsset",
    "rig_Anim",
    "hhh_xin_body_sss1",
    "hhh_xin_Surface14",
    "lambert1",
    "lambert29",
    "xin_eye4",
    "xin_eye5",
    "xin_meimao2",
    "xin_Surface12",
    "xin_Surface13",
    "xin_Surface14",
    "xin_Surface15",
    "xin_Surface16",
    "xin__EYE2",
)
MATERIAL_NAMES = ASSET_NAMES[4:]
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


def object_path(name):
    return "{}/{}.{}".format(ROOT, name, name)


def package_path(name):
    return "{}/{}".format(ROOT, name)


def dependency_options():
    return unreal.AssetRegistryDependencyOptions(
        include_soft_package_references=True,
        include_hard_package_references=True,
        include_searchable_names=True,
        include_soft_management_references=True,
        include_hard_management_references=True,
    )


def collect_bones(mesh):
    bones = []
    visited = set()

    def visit(name):
        name = str(name)
        if not name or name == "None" or name in visited:
            return
        visited.add(name)
        bones.append(name)
        for child in mesh.get_bone_children(name):
            visit(child)

    visit("Root_M")
    return bones


def main():
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    registry.search_all_assets(True)
    assets = {}
    errors = []

    for name in ASSET_NAMES:
        asset = unreal.EditorAssetLibrary.load_asset(object_path(name))
        assets[name] = asset
        if asset is None:
            errors.append("Missing migrated Kelly asset: " + object_path(name))

    mesh = assets.get("rig")
    skeleton = assets.get("rig_Skeleton")
    physics_asset = assets.get("rig_PhysicsAsset")
    animation = assets.get("rig_Anim")
    if mesh is not None and not isinstance(mesh, unreal.SkeletalMesh):
        errors.append("rig is not a SkeletalMesh")
    if skeleton is not None and not isinstance(skeleton, unreal.Skeleton):
        errors.append("rig_Skeleton is not a Skeleton")
    if physics_asset is not None and not isinstance(physics_asset, unreal.PhysicsAsset):
        errors.append("rig_PhysicsAsset is not a PhysicsAsset")
    if animation is not None and not isinstance(animation, unreal.AnimSequence):
        errors.append("rig_Anim is not an AnimSequence")

    if mesh is not None:
        mesh_skeleton = mesh.get_editor_property("skeleton")
        mesh_physics = mesh.get_editor_property("physics_asset")
        if mesh_skeleton != skeleton:
            errors.append("Kelly mesh does not reference migrated Kelly skeleton")
        if mesh_physics != physics_asset:
            errors.append("Kelly mesh does not reference migrated Kelly physics asset")

        material_slots = mesh.get_editor_property("materials")
        material_paths = []
        for index, slot in enumerate(material_slots):
            material = slot.get_editor_property("material_interface")
            if material is None:
                errors.append("Kelly material slot {} is empty".format(index))
            else:
                material_paths.append(material.get_path_name())
        expected_material_paths = {object_path(name) for name in MATERIAL_NAMES}
        if len(material_slots) != len(MATERIAL_NAMES):
            errors.append(
                "Kelly mesh has {} material slots, expected {}".format(
                    len(material_slots),
                    len(MATERIAL_NAMES),
                )
            )
        if set(material_paths) != expected_material_paths:
            errors.append("Kelly mesh material closure is incomplete")

        bones = collect_bones(mesh)
        missing_bones = sorted(set(REQUIRED_BONES) - set(bones))
        if missing_bones:
            errors.append(
                "Kelly mesh is missing required bones: " + ", ".join(missing_bones)
            )
    else:
        bones = []

    if animation is not None and animation.get_editor_property("skeleton") != skeleton:
        errors.append("Kelly animation does not reference migrated Kelly skeleton")

    for name in MATERIAL_NAMES:
        material = assets.get(name)
        if material is not None and not isinstance(material, unreal.MaterialInterface):
            errors.append(name + " is not a MaterialInterface")

    allowed_packages = {package_path(name) for name in ASSET_NAMES}
    for package in allowed_packages:
        dependencies = registry.get_dependencies(package, dependency_options())
        for dependency in dependencies:
            dependency = str(dependency)
            if dependency.startswith("/Game/") and dependency not in allowed_packages:
                errors.append(
                    "{} references outside KellySource: {}".format(
                        package,
                        dependency,
                    )
                )

    if errors:
        raise RuntimeError(
            "Kelly migration validation failed:\n- " + "\n- ".join(errors)
        )

    unreal.log(
        "[KellyMigrationValidate] Validation passed mesh={} skeleton={} "
        "physics={} materials={} bones={}".format(
            mesh.get_path_name(),
            skeleton.get_path_name(),
            physics_asset.get_path_name(),
            len(MATERIAL_NAMES),
            len(bones),
        )
    )


main()
