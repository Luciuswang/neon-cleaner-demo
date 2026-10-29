"""Replace legacy FBX Phong response; keep original Kelly textures and slot identities.

Run once after restoring the private source. New assets remain in KellyLowSource
and are backed up privately. This does not invent missing normals/groom detail.
"""
from pathlib import Path
import sys
import unreal
sys.path.insert(0,str(Path(__file__).resolve().parent))
from neon_environment_materials import Graph

DEST='/Game/KellyLowSource/Polish20261029'
SLOTS={
    '15_-_Default': ('female_Newbody_d', .52, .35),
    'Material__1205': ('female_sc_runner_top_001_d', .78, .30),
    'Material__1335': ('female_sc_runner_bottom_001_d', .72, .30),
    'Material__1207': ('female_sc_runner_shoe_001_d', .68, .30),
    'Material__1362': ('Female_Head_Sc_Kelly_Awakening_Facial_D_new', .48, .35),
    'Material__1337': ('female_hair_sc_runner_d', .55, .35),
}
mesh=unreal.load_asset('/Game/KellyLowSource/asda')
assert mesh is not None
mesh.modify()
slots=mesh.get_editor_property('materials')
assert {str(s.get_editor_property('material_slot_name')) for s in slots}==set(SLOTS)
unreal.EditorAssetLibrary.make_directory(DEST)
new_slots=[]
for slot in slots:
    name=str(slot.get_editor_property('material_slot_name'))
    source,roughness,specular=SLOTS[name]
    texture=unreal.load_asset('/Game/KellyLowSource/'+source)
    assert isinstance(texture,unreal.Texture2D),source
    material_name='M_Kelly_'+name.replace('-','_')+'_PBR_v1'
    material=unreal.load_asset(DEST+'/'+material_name)
    if material is None:
        g=Graph(DEST,material_name)
        color=g.node('TextureSample',texture=texture)
        color.set_editor_property('sampler_type',unreal.MaterialSamplerType.SAMPLERTYPE_COLOR)
        g.output(color,'BASE_COLOR')
        g.output(g.scalar(roughness),'ROUGHNESS')
        g.output(g.scalar(specular),'SPECULAR')
        g.output(g.scalar(0),'METALLIC')
        g.material.set_editor_property('used_with_skeletal_mesh',True)
        material=g.finish()
        assert unreal.EditorAssetLibrary.save_loaded_asset(material)
    slot.set_editor_property('material_interface',material)
    new_slots.append(slot)
    unreal.log('[KellyMaterialPolish] slot=%s originalTexture=%s roughness=%.2f specular=%.2f metallic=0 missingNormals=UNRESOLVED' % (name,source,roughness,specular))
mesh.set_editor_property('materials',new_slots)
assert all(s.get_editor_property('material_interface').get_path_name().startswith(DEST+'/') for s in mesh.get_editor_property('materials'))
assert unreal.EditorAssetLibrary.save_loaded_asset(mesh, only_if_is_dirty=False)
unreal.log('[KellyMaterialPolish] Saved six dielectric materials; original Phong instances retained for rollback')
