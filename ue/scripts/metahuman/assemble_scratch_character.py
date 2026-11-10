"""Assemble a legitimately rigged/textured character in an isolated project."""
import json
from pathlib import Path
import unreal

repo=Path(__file__).resolve().parents[3]
project=Path(unreal.Paths.project_dir()).resolve()
if not project.is_relative_to((repo/'.local').resolve()):
    raise RuntimeError('Scratch project required; refusing main project')
asset=unreal.load_asset('/Game/MetaHumanWorkspace/Characters/Heroine_MetaHuman')
assert isinstance(asset,unreal.MetaHumanCharacter)
assert asset.has_high_resolution_textures,'Official texture source download is missing'
if unreal.EditorAssetLibrary.does_directory_exist('/Game/MetaHumans'):
    raise RuntimeError('Existing scratch assembly detected; preserve and inspect it')
sub=unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
assert sub.try_add_object_to_edit(asset)
try:
    assert sub.can_build_meta_human(character=asset),'Character is not ready for official assembly'
    params=unreal.MetaHumanCharacterEditorBuildParameters()
    params.pipeline_type=unreal.MetaHumanDefaultPipelineType.OPTIMIZED
    params.pipeline_quality=unreal.MetaHumanQualityLevel.MEDIUM
    params.absolute_build_path='/Game/MetaHumans'
    params.common_folder_path='/Game/MetaHumans/Common'
    params.enable_wardrobe_item_validation=True
    unreal.log('[MetaHumanAssembly] START optimized medium; 2K source; not visual acceptance')
    sub.build_meta_human(character=asset,params=params)
    registry=unreal.AssetRegistryHelpers.get_asset_registry()
    registry.search_all_assets(True)
    paths=unreal.EditorAssetLibrary.list_assets('/Game/MetaHumans',recursive=True,include_folder=False)
    blueprints=[p for p in paths if '/BP_' in p]
    if not blueprints: raise RuntimeError('Assembly did not produce a character blueprint')
    if not unreal.EditorAssetLibrary.save_directory('/Game/MetaHumans',only_if_is_dirty=False,recursive=True):
        raise RuntimeError('Could not persist generated assembly')
    report={'quality':'OPTIMIZED_MEDIUM_2K','blueprints':blueprints,'asset_count':len(paths),
            'status':'ASSEMBLED_NOT_RUNTIME_OR_VISUALLY_VERIFIED'}
    (project/'assembly-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    unreal.log('[MetaHumanAssembly] SUCCESS count=%d blueprints=%s' % (len(paths),blueprints))
finally:
    sub.remove_object_to_edit(asset)
