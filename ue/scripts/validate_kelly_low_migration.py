import unreal


ROOT = "/Game/KellyLowSource"
MESH_NAME = "asda"
SKELETON_NAME = "asda_Skeleton"
PHYSICS_NAME = "asda_PhysicsAsset"
MATERIAL_TEXTURES = {
    "15_-_Default": "female_Newbody_d",
    "Material__1205": "female_sc_runner_top_001_d",
    "Material__1207": "female_sc_runner_shoe_001_d",
    "Material__1335": "female_sc_runner_bottom_001_d",
    "Material__1337": "female_hair_sc_runner_d",
    "Material__1362": "Female_Head_Sc_Kelly_Awakening_Facial_D_new",
}
REQUIRED_BONES = {
    "bone_Root",
    "bone_Hips",
    "bone_Spine",
    "bone_Spine1",
    "bone_Head",
    "bone_LeftArm",
    "bone_LeftForeArm",
    "bone_LeftHand",
    "bone_RightArm",
    "bone_RightForeArm",
    "bone_RightHand",
    "bone_LeftLegUpper",
    "bone_LeftLeg",
    "bone_LeftAnkle",
    "bone_RightLegUpper",
    "bone_RightLeg",
    "bone_RightAnkle",
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
ASSET_NAMES = (
    MESH_NAME,
    SKELETON_NAME,
    PHYSICS_NAME,
    *MATERIAL_TEXTURES.keys(),
    *MATERIAL_TEXTURES.values(),
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


def main():
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    registry.search_all_assets(True)
    assets = {}
    errors = []

    for name in ASSET_NAMES:
        asset = unreal.EditorAssetLibrary.load_asset(object_path(name))
        assets[name] = asset
        if not asset:
            errors.append("Missing migrated low Kelly asset: " + object_path(name))

    mesh = assets.get(MESH_NAME)
    skeleton = assets.get(SKELETON_NAME)
    physics = assets.get(PHYSICS_NAME)
    if mesh and not isinstance(mesh, unreal.SkeletalMesh):
        errors.append("asda is not a SkeletalMesh")
    if skeleton and not isinstance(skeleton, unreal.Skeleton):
        errors.append("asda_Skeleton is not a Skeleton")
    if physics and not isinstance(physics, unreal.PhysicsAsset):
        errors.append("asda_PhysicsAsset is not a PhysicsAsset")

    if mesh:
        if mesh.get_editor_property("skeleton") != skeleton:
            errors.append("Low Kelly mesh does not reference the migrated skeleton")
        if mesh.get_editor_property("physics_asset") != physics:
            errors.append("Low Kelly mesh does not reference the migrated PhysicsAsset")

        slots = mesh.get_editor_property("materials")
        if len(slots) != len(MATERIAL_TEXTURES):
            errors.append(
                "Low Kelly has {} material slots, expected {}".format(
                    len(slots), len(MATERIAL_TEXTURES)
                )
            )
        slot_paths = set()
        for index, slot in enumerate(slots):
            material = slot.get_editor_property("material_interface")
            if not material:
                errors.append("Low Kelly material slot {} is empty".format(index))
            else:
                slot_paths.add(material.get_path_name())
        expected_paths = {object_path(name) for name in MATERIAL_TEXTURES}
        if slot_paths != expected_paths:
            errors.append("Low Kelly mesh material set is incomplete")

        reference_pose = skeleton.get_reference_pose() if skeleton else None
        bones = (
            {str(name) for name in reference_pose.get_bone_names()}
            if reference_pose
            else set()
        )
        missing_bones = sorted(REQUIRED_BONES - bones)
        if missing_bones:
            errors.append("Low Kelly is missing bones: " + ", ".join(missing_bones))
        for parent, child in REQUIRED_BONE_EDGES:
            children = {str(value) for value in mesh.get_bone_children(parent)}
            if child not in children:
                errors.append(
                    "Low Kelly bone hierarchy expected {} -> {}".format(parent, child)
                )
    else:
        bones = set()

    for material_name, texture_name in MATERIAL_TEXTURES.items():
        material = assets.get(material_name)
        texture = assets.get(texture_name)
        if material and not isinstance(material, unreal.MaterialInstance):
            errors.append(material_name + " is not a MaterialInstance")
            continue
        if texture and not isinstance(texture, unreal.Texture2D):
            errors.append(texture_name + " is not a Texture2D")
        if material:
            diffuse = (
                unreal.MaterialEditingLibrary.get_material_instance_texture_parameter_value(
                    material, "DiffuseColorMap"
                )
            )
            if diffuse != texture:
                actual = diffuse.get_path_name() if diffuse else "None"
                errors.append(
                    "{} DiffuseColorMap expected {}, got {}".format(
                        material_name, object_path(texture_name), actual
                    )
                )
            material_dependencies = {
                str(value)
                for value in registry.get_dependencies(
                    package_path(material_name), dependency_options()
                )
            }
            if package_path(texture_name) not in material_dependencies:
                errors.append(
                    "{} does not record {} as a package dependency".format(
                        material_name, texture_name
                    )
                )

    allowed = {package_path(name) for name in ASSET_NAMES}
    for package in allowed:
        for dependency in registry.get_dependencies(package, dependency_options()):
            dependency = str(dependency)
            if dependency.startswith("/Game/") and dependency not in allowed:
                errors.append(
                    "{} references outside KellyLowSource: {}".format(
                        package, dependency
                    )
                )

    if errors:
        raise RuntimeError(
            "Low Kelly migration validation failed:\n- " + "\n- ".join(errors)
        )

    unreal.log(
        "[KellyLowMigrationValidate] Validation passed mesh={} materials={} "
        "textures={} bones={}".format(
            mesh.get_path_name(), len(MATERIAL_TEXTURES), len(MATERIAL_TEXTURES), len(bones)
        )
    )


main()
