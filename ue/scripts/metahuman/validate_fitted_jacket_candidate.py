"""Reopen the experimental jacket and check actual material/skeleton bindings."""
import unreal
path='/Game/MetaHumanWorkspace/Clothing/LeatherJacketCandidate/SK_LeatherJacket_Experimental_V2'
mesh=unreal.load_asset(path)
skeleton=unreal.load_asset('/MetaHumanCharacter/Female/Medium/NormalWeight/Body/metahuman_base_skel')
material=unreal.load_asset('/Game/MetaHumanWorkspace/Clothing/LeatherJacketSource/M_LeatherJacket_Source')
assert isinstance(mesh,unreal.SkeletalMesh),'Missing experimental skeletal jacket'
assert isinstance(skeleton,unreal.Skeleton) and mesh.get_editor_property('skeleton')==skeleton,'Wrong body skeleton'
assert isinstance(material,unreal.MaterialInterface),'Missing leather material'
slots=mesh.get_editor_property('materials')
assert slots and all(s.get_editor_property('material_interface')==material for s in slots),'Material binding failed to persist'
bones=skeleton.get_reference_pose().get_bone_names()
assert len(bones)>=300,'Unexpected reference skeleton'
assert unreal.EditorAssetLibrary.get_metadata_tag(mesh,'NeonStatus')=='EXPERIMENTAL_FIT_UNREVIEWED'
unreal.log('[FittedJacketValidate] PASS persisted skeleton and material; visual fit, clipping and riding remain UNVERIFIED')
