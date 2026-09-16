"""Import the private high-detail bike as an isolated, inactive candidate.

main() imports only. create_preview() is an optional separate preview-map pass.
Never updates the chase map, active pawn, rider contacts, or active motorcycle.
"""
import json
from pathlib import Path
import unreal

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/".local/assets/CinematicBike"
DEST="/Game/CinematicBike"


def main():
    manifest=json.loads((SOURCE/"manifest.json").read_text(encoding="utf8"))
    unreal.EditorAssetLibrary.make_directory(DEST)
    tools=unreal.AssetToolsHelpers.get_asset_tools()
    textures={}
    for label,desc in manifest["maps"].items():
        name=Path(desc["file"]).stem
        task=unreal.AssetImportTask()
        task.filename=str(SOURCE/desc["file"])
        task.destination_path=DEST
        task.destination_name=name
        task.automated=True
        task.replace_existing=True
        task.save=True
        tools.import_asset_tasks([task])
        texture=unreal.load_asset(DEST+"/"+name)
        if not texture:raise RuntimeError("Bike texture import failed: "+name)
        texture.set_editor_property("srgb",label=="Color")
        if label=="NormalDX":
            texture.set_editor_property("compression_settings",unreal.TextureCompressionSettings.TC_NORMALMAP)
            texture.set_editor_property("flip_green_channel",False)
        elif label=="MetalRough":
            texture.set_editor_property("compression_settings",unreal.TextureCompressionSettings.TC_MASKS)
        unreal.EditorAssetLibrary.save_loaded_asset(texture)
        textures[label]=texture
    material=unreal.load_asset(DEST+"/M_CinematicBike")
    if not material:
        material=tools.create_asset("M_CinematicBike",DEST,unreal.Material,unreal.MaterialFactoryNew())
    lib=unreal.MaterialEditingLibrary
    lib.delete_all_material_expressions(material)
    material.set_editor_property("two_sided",True)
    material.set_editor_property("use_material_attributes",False)
    samples={}
    for label,texture in textures.items():
        expr=lib.create_material_expression(material,unreal.MaterialExpressionTextureSample)
        expr.set_editor_property("texture",texture)
        if label=="NormalDX":expr.set_editor_property("sampler_type",unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL)
        if label=="MetalRough":expr.set_editor_property("sampler_type",unreal.MaterialSamplerType.SAMPLERTYPE_MASKS)
        samples[label]=expr
    for label,pin,prop in [("Color","RGB","MP_BASE_COLOR"),("NormalDX","RGB","MP_NORMAL"),
                           ("MetalRough","G","MP_ROUGHNESS"),("MetalRough","B","MP_METALLIC")]:
        if not lib.connect_material_property(samples[label],pin,getattr(unreal.MaterialProperty,prop)):
            raise RuntimeError("Bike material channel failed: "+prop)
    lib.recompile_material(material)
    unreal.EditorAssetLibrary.save_loaded_asset(material)
    task=unreal.AssetImportTask()
    task.filename=str(SOURCE/"SM_CinematicBike.obj")
    task.destination_path=DEST
    task.destination_name="SM_CinematicBike"
    task.automated=True
    task.replace_existing=True
    task.save=True
    options=unreal.FbxImportUI()
    for key,value in {"import_materials":False,"import_textures":False,"import_mesh":True,
                      "import_as_skeletal":False,"automated_import_should_detect_type":False,
                      "mesh_type_to_import":unreal.FBXImportType.FBXIT_STATIC_MESH}.items():
        options.set_editor_property(key,value)
    data=options.get_editor_property("static_mesh_import_data")
    for key,value in {"combine_meshes":True,"convert_scene":False,"convert_scene_unit":False,
                      "import_uniform_scale":1.0,"generate_lightmap_u_vs":False,
                      "normal_import_method":unreal.FBXNormalImportMethod.FBXNIM_IMPORT_NORMALS}.items():
        data.set_editor_property(key,value)
    task.options=options
    tools.import_asset_tasks([task])
    mesh=unreal.load_asset(DEST+"/SM_CinematicBike")
    if not mesh:raise RuntimeError("Cinematic bike import failed")
    for index in range(len(mesh.get_editor_property("static_materials"))):mesh.set_material(index,material)
    editor=unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem)
    if editor:
        reduction=unreal.StaticMeshReductionOptions()
        reduction.auto_compute_lod_screen_size=False
        settings=[]
        for percent,screen in [(1.0,1.0),(0.35,0.4),(0.12,0.15),(0.04,0.06)]:
            item=unreal.StaticMeshReductionSettings()
            item.percent_triangles=percent
            item.screen_size=screen
            settings.append(item)
        reduction.reduction_settings=settings
        if editor.set_lods(mesh,reduction)!=4:raise RuntimeError("Bike LOD creation failed")
    else:
        unreal.log_warning("[CinematicBike] Full 799914-triangle LOD0 candidate only; LOD generation requires full editor subsystem")
    bounds=mesh.get_bounds()
    measured=[bounds.box_extent.x*2,bounds.box_extent.y*2,bounds.box_extent.z*2]
    if any(abs(a-b)>1 for a,b in zip(measured,manifest["dimensions_cm"])):
        raise RuntimeError("Bike axes/scale invalid: "+str(measured))
    if abs(bounds.origin.z-bounds.box_extent.z)>1:raise RuntimeError("Bike groundZ is invalid")
    unreal.EditorAssetLibrary.save_loaded_asset(mesh)
    unreal.log("[CinematicBike] CANDIDATE imported bounds_cm="+str(measured)+"; not active; rider contacts and mechanical rig require production work")


def create_preview():
    """Optional new map only, called explicitly by the integrator after import."""
    path=DEST+"/LVL_CinematicBike_AssetReview"
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        raise RuntimeError("Preview exists; preserve it for review rather than overwrite")
    if not unreal.EditorLevelLibrary.new_level(path):raise RuntimeError("Cannot create candidate review map")
    bike=unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.StaticMeshActor,unreal.Vector(0,0,0))
    bike.set_actor_label("CANDIDATE_HighBike_NotGameplayApproved")
    bike.static_mesh_component.set_static_mesh(unreal.load_asset(DEST+"/SM_CinematicBike"))
    ground=unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.StaticMeshActor,unreal.Vector(0,0,-6))
    ground.static_mesh_component.set_static_mesh(unreal.load_asset("/Engine/BasicShapes/Cube.Cube"))
    ground.set_actor_scale3d(unreal.Vector(8,8,0.1))
    light=unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.DirectionalLight,unreal.Vector(0,0,400),unreal.Rotator(-40,-35,0))
    light.get_component_by_class(unreal.DirectionalLightComponent).set_editor_property("intensity",6.0)
    sky=unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.SkyLight,unreal.Vector(0,0,400))
    sky.get_component_by_class(unreal.SkyLightComponent).set_editor_property("intensity",1.0)
    camera=unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.CameraActor,unreal.Vector(300,-380,175))
    camera.set_actor_rotation(unreal.MathLibrary.find_look_at_rotation(camera.get_actor_location(),unreal.Vector(0,0,65)),False)
    camera.set_actor_label("CinematicBike_AssetReviewCamera")
    unreal.EditorLevelLibrary.save_current_level()


if __name__=="__main__":main()
