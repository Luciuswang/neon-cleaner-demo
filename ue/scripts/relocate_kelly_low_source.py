import json
import os

import unreal


ASSET_NAMES = (
    "asda",
    "asda_Skeleton",
    "asda_PhysicsAsset",
    "15_-_Default",
    "Material__1205",
    "Material__1207",
    "Material__1335",
    "Material__1337",
    "Material__1362",
    "female_Newbody_d",
    "female_hair_sc_runner_d",
    "Female_Head_Sc_Kelly_Awakening_Facial_D_new",
    "female_sc_runner_bottom_001_d",
    "female_sc_runner_shoe_001_d",
    "female_sc_runner_top_001_d",
)
TARGET_ROOT = "/Game/KellyLowSource"


def object_path(root, name):
    return "{}/{}.{}".format(root, name, name)


def package_path(root, name):
    return "{}/{}".format(root, name)


def report_path():
    value = os.environ.get("KELLY_LOW_RELOCATE_REPORT", "").strip()
    if not value or not os.path.isabs(value):
        raise RuntimeError(
            "KELLY_LOW_RELOCATE_REPORT must be an explicit absolute JSON path"
        )
    value = os.path.normcase(os.path.realpath(value))
    if not value.lower().endswith(".json"):
        raise RuntimeError("KELLY_LOW_RELOCATE_REPORT must end in .json")
    source_root_value = os.environ.get("KELLY_LOW_SOURCE_ROOT", "").strip()
    if not source_root_value or not os.path.isabs(source_root_value):
        raise RuntimeError("KELLY_LOW_SOURCE_ROOT must be an explicit absolute path")
    source_root = os.path.normcase(os.path.realpath(source_root_value))
    try:
        inside_source = os.path.commonpath((value, source_root)) == source_root
    except ValueError:
        inside_source = False
    if inside_source:
        raise RuntimeError("Relocation report must not be inside the Kelly source")
    return value


def dependency_options():
    return unreal.AssetRegistryDependencyOptions(
        include_soft_package_references=True,
        include_hard_package_references=True,
        include_searchable_names=True,
        include_soft_management_references=True,
        include_hard_management_references=True,
    )


def main():
    output = report_path()
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    registry.search_all_assets(True)

    assets = []
    for name in ASSET_NAMES:
        path = object_path("/Game", name)
        asset = unreal.EditorAssetLibrary.load_asset(path)
        if not asset:
            raise RuntimeError("Missing low Kelly dependency: " + path)
        assets.append((name, asset))

    if unreal.EditorAssetLibrary.does_directory_exist(TARGET_ROOT):
        existing = unreal.EditorAssetLibrary.list_assets(
            TARGET_ROOT, recursive=True, include_folder=False
        )
        if existing:
            raise RuntimeError("Low Kelly relocation target is not empty: " + TARGET_ROOT)
    else:
        unreal.EditorAssetLibrary.make_directory(TARGET_ROOT)

    rename_data = [
        unreal.AssetRenameData(
            asset=asset,
            new_package_path=TARGET_ROOT,
            new_name=name,
        )
        for name, asset in assets
    ]
    if not unreal.AssetToolsHelpers.get_asset_tools().rename_assets(rename_data):
        raise RuntimeError("UE AssetTools failed to relocate low Kelly dependencies")

    if not unreal.EditorAssetLibrary.save_directory(
        TARGET_ROOT, only_if_is_dirty=False, recursive=True
    ):
        raise RuntimeError("Failed to save relocated low Kelly packages")

    registry.scan_paths_synchronous(["/Game"], force_rescan=True)
    for name in ASSET_NAMES:
        old_path = object_path("/Game", name)
        if unreal.EditorAssetLibrary.does_asset_exist(old_path):
            if not unreal.EditorAssetLibrary.delete_asset(old_path):
                raise RuntimeError("Failed to remove staging redirector: " + old_path)

    unreal.EditorAssetLibrary.save_directory(
        TARGET_ROOT, only_if_is_dirty=False, recursive=True
    )
    registry.scan_paths_synchronous(["/Game"], force_rescan=True)

    allowed = {package_path(TARGET_ROOT, name) for name in ASSET_NAMES}
    old_packages = {package_path("/Game", name) for name in ASSET_NAMES}
    dependencies = {}
    errors = []
    for name in ASSET_NAMES:
        target_object = object_path(TARGET_ROOT, name)
        if not unreal.EditorAssetLibrary.load_asset(target_object):
            errors.append("Relocated asset does not load: " + target_object)
            continue
        target_package = package_path(TARGET_ROOT, name)
        package_dependencies = [
            str(value)
            for value in registry.get_dependencies(target_package, dependency_options())
        ]
        dependencies[target_package] = package_dependencies
        for dependency in package_dependencies:
            if dependency in old_packages:
                errors.append(
                    "{} still references old package {}".format(
                        target_package, dependency
                    )
                )
            if dependency.startswith("/Game/") and dependency not in allowed:
                errors.append(
                    "{} references package outside low Kelly closure: {}".format(
                        target_package, dependency
                    )
                )

    for name in ASSET_NAMES:
        old_path = object_path("/Game", name)
        if unreal.EditorAssetLibrary.does_asset_exist(old_path):
            errors.append("Old root asset or redirector still exists: " + old_path)

    if errors:
        raise RuntimeError("Low Kelly relocation failed:\n- " + "\n- ".join(errors))

    result = {
        "project": unreal.Paths.get_project_file_path(),
        "target_root": TARGET_ROOT,
        "asset_count": len(ASSET_NAMES),
        "assets": [object_path(TARGET_ROOT, name) for name in ASSET_NAMES],
        "dependencies": dependencies,
    }
    os.makedirs(os.path.dirname(output), exist_ok=True)
    with open(output, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)

    unreal.log(
        "[KellyLowRelocate] Relocation passed: {} assets under {}".format(
            len(ASSET_NAMES), TARGET_ROOT
        )
    )


main()
