"""Run in Unreal Editor commandlet; never replace a user's existing character."""
import unreal

folder = '/Game/MetaHumanWorkspace/Characters'
name = 'Heroine_MetaHuman'
path = folder + '/' + name
asset = (unreal.EditorAssetLibrary.load_asset(path)
         if unreal.EditorAssetLibrary.does_asset_exist(path) else None)
if asset is None:
    asset = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        asset_name=name, package_path=folder,
        asset_class=unreal.MetaHumanCharacter,
        factory=unreal.MetaHumanCharacterFactoryNew())
    if asset is None:
        raise RuntimeError('MetaHuman Character creation failed')
    if not unreal.EditorAssetLibrary.save_loaded_asset(asset, only_if_is_dirty=False):
        raise RuntimeError('Could not save starter MetaHuman Character')
    unreal.log('[MetaHumanStarter] Created ' + path)
elif isinstance(asset, unreal.MetaHumanCharacter):
    unreal.log('[MetaHumanStarter] Existing character preserved ' + path)
else:
    raise RuntimeError('Existing asset has a different type; refusing to replace ' + path)
unreal.log('[MetaHumanStarter] SUCCESS: ' + path)
