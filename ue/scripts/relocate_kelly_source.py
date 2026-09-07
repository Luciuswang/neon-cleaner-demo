import json
import os

import unreal


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

TARGET_ROOT = "/Game/KellySource"
ORIGINAL_SOURCE_ROOT = os.path.normcase(os.path.realpath(r"D:\kelly-UE"))


def object_path(root, name):
    return "{}/{}.{}".format(root, name, name)


def package_path(root, name):
    return "{}/{}".format(root, name)


def require_report_path():
    report_path = os.environ.get("KELLY_RELOCATE_REPORT", "").strip()
    if not report_path:
        raise RuntimeError(
            "KELLY_RELOCATE_REPORT must be set to an explicit absolute JSON path"
        )
    if not os.path.isabs(report_path):
        raise RuntimeError("KELLY_RELOCATE_REPORT must be absolute")
    report_path = os.path.normcase(os.path.realpath(report_path))
    if not report_path.lower().endswith(".json"):
        raise RuntimeError("KELLY_RELOCATE_REPORT must end in .json")
    try:
        inside_original_source = (
            os.path.commonpath((report_path, ORIGINAL_SOURCE_ROOT))
            == ORIGINAL_SOURCE_ROOT
        )
    except ValueError:
        inside_original_source = False
    if inside_original_source:
        raise RuntimeError(
            "KELLY_RELOCATE_REPORT must not be inside the original D:\\kelly-UE source"
        )
    return report_path


def dependency_options():
    return unreal.AssetRegistryDependencyOptions(
        include_soft_package_references=True,
        include_hard_package_references=True,
        include_searchable_names=True,
        include_soft_management_references=True,
        include_hard_management_references=True,
    )


def main():
    report_path = require_report_path()
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    registry.search_all_assets(True)

    assets = []
    for name in ASSET_NAMES:
        source_path = object_path("/Game", name)
        asset = unreal.EditorAssetLibrary.load_asset(source_path)
        if asset is None:
            raise RuntimeError("Missing Kelly source asset: " + source_path)
        assets.append((name, asset))

    if unreal.EditorAssetLibrary.does_directory_exist(TARGET_ROOT):
        existing = unreal.EditorAssetLibrary.list_assets(
            TARGET_ROOT,
            recursive=True,
            include_folder=False,
        )
        if existing:
            raise RuntimeError(
                "Kelly relocation target must be empty: " + TARGET_ROOT
            )
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
    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
    if not asset_tools.rename_assets(rename_data):
        raise RuntimeError("UE AssetTools failed to relocate Kelly assets")

    if not unreal.EditorAssetLibrary.save_directory(
        TARGET_ROOT,
        only_if_is_dirty=False,
        recursive=True,
    ):
        raise RuntimeError("Failed to save relocated Kelly packages")

    registry.scan_paths_synchronous(["/Game"], force_rescan=True)
    redirectors = []
    for asset_data in registry.get_assets_by_path("/Game", recursive=False):
        if str(asset_data.asset_class_path.asset_name) == "ObjectRedirector":
            redirector = asset_data.get_asset()
            if redirector is not None:
                redirectors.append(redirector)
    if redirectors:
        for name in ASSET_NAMES:
            old_path = object_path("/Game", name)
            if unreal.EditorAssetLibrary.does_asset_exist(old_path):
                if not unreal.EditorAssetLibrary.delete_asset(old_path):
                    raise RuntimeError(
                        "Failed to remove staging redirector: " + old_path
                    )

    unreal.EditorAssetLibrary.save_directory(
        TARGET_ROOT,
        only_if_is_dirty=False,
        recursive=True,
    )
    registry.scan_paths_synchronous(["/Game"], force_rescan=True)

    allowed_packages = {
        package_path(TARGET_ROOT, name)
        for name in ASSET_NAMES
    }
    old_packages = {
        package_path("/Game", name)
        for name in ASSET_NAMES
    }
    dependency_records = {}
    errors = []

    for name in ASSET_NAMES:
        target_path = object_path(TARGET_ROOT, name)
        target_asset = unreal.EditorAssetLibrary.load_asset(target_path)
        if target_asset is None:
            errors.append("Relocated asset does not load: " + target_path)
            continue

        target_package = package_path(TARGET_ROOT, name)
        dependencies = [
            str(value)
            for value in registry.get_dependencies(
                target_package,
                dependency_options(),
            )
        ]
        dependency_records[target_package] = dependencies
        for dependency in dependencies:
            if dependency in old_packages:
                errors.append(
                    "{} still references old root package {}".format(
                        target_package,
                        dependency,
                    )
                )
            if dependency.startswith("/Game/") and dependency not in allowed_packages:
                errors.append(
                    "{} references package outside KellySource closure: {}".format(
                        target_package,
                        dependency,
                    )
                )

    for name in ASSET_NAMES:
        old_path = object_path("/Game", name)
        if unreal.EditorAssetLibrary.does_asset_exist(old_path):
            errors.append("Old root asset or redirector still exists: " + old_path)

    if errors:
        raise RuntimeError(
            "Kelly relocation validation failed:\n- " + "\n- ".join(errors)
        )

    result = {
        "project": unreal.Paths.get_project_file_path(),
        "target_root": TARGET_ROOT,
        "asset_count": len(ASSET_NAMES),
        "assets": [
            object_path(TARGET_ROOT, name)
            for name in ASSET_NAMES
        ],
        "dependencies": dependency_records,
        "redirector_count_before_fixup": len(redirectors),
    }
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as output:
        json.dump(result, output, ensure_ascii=False, indent=2)

    unreal.log(
        "[KellyRelocate] Relocation passed: {} assets under {}".format(
            len(ASSET_NAMES),
            TARGET_ROOT,
        )
    )


main()
