"""Create an isolated fitting-reference body uasset without modifying the source.

Run in a full editor on a disposable .local project only. This requires no face
rig or texture download and deliberately does not produce a runtime character.
"""
from datetime import datetime,timezone
import hashlib,json
from pathlib import Path
import uuid
import unreal

repo=Path(__file__).resolve().parents[3]
project=Path(unreal.Paths.project_dir()).resolve()
if not project.is_relative_to((repo/'.local').resolve()):
    raise RuntimeError('Refusing to run outside an isolated .local project')
source_file=project/'Content/MetaHumanWorkspace/Characters/Heroine_MetaHuman.uasset'
before=hashlib.sha256(source_file.read_bytes()).hexdigest()
source=unreal.load_asset('/Game/MetaHumanWorkspace/Characters/Heroine_MetaHuman')
assert isinstance(source,unreal.MetaHumanCharacter)
stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'_'+uuid.uuid4().hex[:8]
folder='/Game/MetaHumanWorkspace/FittingScratch/'+stamp
clone_path=folder+'/Heroine_BoundBodyReference'
clone=unreal.EditorAssetLibrary.duplicate_loaded_asset(source,clone_path)
if not isinstance(clone,unreal.MetaHumanCharacter): raise RuntimeError('Duplicate failed')
sub=unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
assert sub.try_add_object_to_edit(clone),'Could not edit duplicate'
try:
    params=unreal.MetaHumanGeometryExportParams()
    params.project_path=folder
    params.head_skeletal_mesh=False
    params.body_skeletal_mesh=True
    params.full_body_skeletal_mesh=False
    params.overwrite_existing_assets=False
    unreal.MetaHumanCharacterExportBlueprintLibrary.export_geometry(clone,params)
    body_path=clone_path+'_Body'
    body=unreal.load_asset(body_path)
    assert isinstance(body,unreal.SkeletalMesh),'Body export failed'
    for asset in (clone,body):
        assert unreal.EditorAssetLibrary.save_loaded_asset(asset,only_if_is_dirty=False),'Scratch save failed'
    assert hashlib.sha256(source_file.read_bytes()).hexdigest()==before,'Source changed'
    info={'source_sha256':before,'body_asset':body.get_path_name(),'project':str(project),
          'purpose':'isolated fitting comparison only; not runtime or visual approval'}
    (project/'body-reference-result.json').write_text(json.dumps(info,indent=2)+'\n',encoding='utf8')
    unreal.log('[BoundBodyReference] SUCCESS body='+body.get_path_name())
finally:
    sub.remove_object_to_edit(clone)
