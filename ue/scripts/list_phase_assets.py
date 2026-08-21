import unreal


ROOT = "/Game/ParagonPhase/Characters/Heroes/Phase"


def log(message):
    unreal.log("[LinxiaPhaseAssets] " + message)


registry = unreal.AssetRegistryHelpers.get_asset_registry()
assets = registry.get_assets_by_path(ROOT, recursive=True)

for asset in assets:
    class_path = str(asset.asset_class_path.asset_name)
    name = str(asset.asset_name)
    package = str(asset.package_name)
    if class_path in ("SkeletalMesh", "Blueprint", "AnimBlueprint", "World") or "GDC" in name or "PlayerCharacter" in name:
        log(f"{class_path}: {package}.{name}")

log(f"Scanned {len(assets)} Phase assets under {ROOT}")
