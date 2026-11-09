"""Import experimental skinned jacket into a scratch UE project only.

The mesh is an unreviewed transfer experiment, not a wardrobe or game rider.
Call only in an isolated project with the existing raw candidate material.
"""
import hashlib
from pathlib import Path
import unreal

repo=Path(__file__).resolve().parents[3]
project=Path(unreal.Paths.project_dir()).resolve()
if not project.is_relative_to((repo/'.local').resolve()):
    raise RuntimeError('Only an isolated .local UE project may import this experimental mesh')
fbx=repo/'.local/private-sources/metahuman-rider-2026-11-09/fit-portable-rootonly-fixture/jacket-fitted-experimental.fbx'
if not fbx.is_file() or fbx.stat().st_size<1024:
    raise RuntimeError('Experimental skinned FBX is missing')
dest='/Game/MetaHumanWorkspace/Clothing/LeatherJacketCandidate'
name='SK_LeatherJacket_Experimental_V2'
path=dest+'/'+name
if unreal.EditorAssetLibrary.does_asset_exist(path):
    raise RuntimeError('Candidate already exists; refusing replacement')
skeleton=unreal.load_asset('/MetaHumanCharacter/Female/Medium/NormalWeight/Body/metahuman_base_skel')
material=unreal.load_asset('/Game/MetaHumanWorkspace/Clothing/LeatherJacketSource/M_LeatherJacket_Source')
if not isinstance(skeleton,unreal.Skeleton) or not isinstance(material,unreal.MaterialInterface):
    raise RuntimeError('Missing body reference skeleton or raw jacket material')
ui=unreal.FbxImportUI()
for key,value in {'import_mesh':True,'import_as_skeletal':True,'import_materials':False,
                  'import_textures':False,'import_animations':False,
                  'automated_import_should_detect_type':False,
                  'mesh_type_to_import':unreal.FBXImportType.FBXIT_SKELETAL_MESH,
                  'skeleton':skeleton}.items():
    ui.set_editor_property(key,value)
task=unreal.AssetImportTask()
task.filename=str(fbx)
task.destination_path=dest
task.destination_name=name
task.automated=True
task.replace_existing=False
task.save=False
task.options=ui
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
mesh=unreal.load_asset(path)
if not isinstance(mesh,unreal.SkeletalMesh):
    raise RuntimeError('FBX did not import as a skeletal mesh')
if mesh.get_editor_property('skeleton')!=skeleton:
    raise RuntimeError('Imported jacket skeleton does not match inspected body reference')
slots=mesh.get_editor_property('materials')
if not slots: raise RuntimeError('Jacket contains no material slots')
new_slots=[]
for slot in slots:
    slot.set_editor_property('material_interface',material)
    new_slots.append(slot)
mesh.modify()
mesh.set_editor_property('materials',new_slots)
unreal.EditorAssetLibrary.set_metadata_tag(mesh,'NeonStatus','EXPERIMENTAL_FIT_UNREVIEWED')
unreal.EditorAssetLibrary.set_metadata_tag(mesh,'NeonSourceFBXSHA256',hashlib.sha256(fbx.read_bytes()).hexdigest())
if not unreal.EditorAssetLibrary.save_loaded_asset(mesh,only_if_is_dirty=False):
    raise RuntimeError('Could not persist experimental jacket')
unreal.log('[FittedJacket] imported skeletal candidate; actual fit and animated deformation NOT VERIFIED')
