"""Validate the raw, still-unfitted jacket after reopening a project."""
import unreal

root='/Game/MetaHumanWorkspace/Clothing/LeatherJacketSource/'
mesh=unreal.load_asset(root+'SM_LeatherJacket_Unfitted')
material=unreal.load_asset(root+'M_LeatherJacket_Source')
assert isinstance(mesh,unreal.StaticMesh),'Expected static jacket mesh'
assert isinstance(material,unreal.Material),'Expected jacket material'
slots=mesh.get_editor_property('static_materials')
assert slots,'No jacket material slots'
assert all(slot.get_editor_property('material_interface')==material for slot in slots),'Wrong jacket material'
expected=('BaseColor','Normal','Metallic','Roughness','AO')
for name in expected:
    texture=unreal.load_asset(root+'T_LeatherJacket_'+name)
    assert isinstance(texture,unreal.Texture2D),'Missing texture '+name
    assert texture.get_editor_property('srgb') == (name=='BaseColor'),'Unexpected color space '+name
bounds=mesh.get_bounds().box_extent
assert 1 < bounds.x < 300 and 1 < bounds.y < 300 and 1 < bounds.z < 300,'Invalid jacket bounds'
unreal.log('[LeatherJacketValidate] PASS static candidate with five textures; UNFITTED and UNRIGGED')
