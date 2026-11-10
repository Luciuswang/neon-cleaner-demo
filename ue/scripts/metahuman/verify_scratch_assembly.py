"""Reload the assembled character in an isolated project; no asset writes."""
import json
from pathlib import Path
import unreal

repo = Path(__file__).resolve().parents[3]
project = Path(unreal.Paths.project_dir()).resolve()
if not project.is_relative_to((repo / '.local').resolve()):
    raise RuntimeError('Scratch project required')
root = '/Game/MetaHumans'
paths = unreal.EditorAssetLibrary.list_assets(root, recursive=True, include_folder=False)
failed, classes = [], {}
for path in paths:
    asset = unreal.load_asset(path)
    if not asset:
        failed.append(path)
    else:
        name = asset.get_class().get_name()
        classes[name] = classes.get(name, 0) + 1
blueprint = unreal.load_asset('/Game/MetaHumans/Heroine_MetaHuman/BP_Heroine_MetaHuman')
result = {'asset_count': len(paths), 'classes': classes, 'failed': failed,
          'blueprint_loaded': bool(blueprint),
          'status': 'RELOADED_NOT_RUNTIME_OR_VISUALLY_VERIFIED'}
(project / 'assembly-reload-report.json').write_text(json.dumps(result, indent=2), encoding='utf8')
unreal.log('[MetaHumanReload] ' + json.dumps(result))
if failed or not blueprint:
    raise RuntimeError('Missing assembly assets')
