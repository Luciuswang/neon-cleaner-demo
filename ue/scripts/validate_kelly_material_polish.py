"""Run in a fresh UE process after material authoring; checks asset and map instance."""
import unreal
prefix='/Game/KellyLowSource/Polish20261029/'
mesh=unreal.load_asset('/Game/KellyLowSource/asda')
slots=mesh.get_editor_property('materials')
assert len(slots)==6
for slot in slots:
    material=slot.get_editor_property('material_interface')
    assert material.get_path_name().startswith(prefix),material.get_path_name()
    unreal.log('[KellyMaterialReopen] slot=%s material=%s' % (slot.get_editor_property('material_slot_name'),material.get_path_name()))
assert unreal.EditorLevelLibrary.load_level('/Game/LinxiaChase/LVL_Linxia_MotorcycleChase')
riders=[]
for actor in unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors():
    for component in actor.get_components_by_class(unreal.PoseableMeshComponent):
        if component.get_name()=='LinxiaRiderMesh': riders.append(component)
assert len(riders)==1,'Expected exactly one placed rider'
for i in range(6):
    actual=riders[0].get_material(i)
    expected=slots[i].get_editor_property('material_interface')
    assert actual==expected,'Component material override at slot'+str(i)
    unreal.log('[KellyMaterialReopen] component_slot=%d material=%s' % (i,actual.get_path_name()))
unreal.log('[KellyMaterialReopen] Validation passed: six asset and six component slots use saved PBR materials')
