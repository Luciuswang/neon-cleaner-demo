import unreal


LEVEL_PATH = "/Game/LinxiaPreview/LVL_Linxia_CharacterPreview"
HEROINE_MESH = "/Game/ParagonPhase/Characters/Heroes/Phase/Meshes/Phase_GDC.Phase_GDC"
HEROINE_PAWN_CLASS = "/Script/NeonCleanerUE.PlayablePhaseCharacter"
GRID_MATERIAL = "/Engine/EngineMaterials/WorldGridMaterial.WorldGridMaterial"


def log(message):
    unreal.log("[LinxiaPreviewLevel] " + message)


def set_prop(obj, name, value):
    try:
        obj.set_editor_property(name, value)
        return True
    except Exception:
        return False


def spawn_actor(cls, location, rotation=None, label=None):
    rotation = rotation or unreal.Rotator(0.0, 0.0, 0.0)
    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(cls, location, rotation)
    actor.set_actor_location(location, False, False)
    actor.set_actor_rotation(rotation, False)
    if label:
        actor.set_actor_label(label)
    return actor


def look_at(location, target):
    return unreal.MathLibrary.find_look_at_rotation(location, target)


def setup_preview_level():
    if unreal.EditorAssetLibrary.does_asset_exist(LEVEL_PATH):
        unreal.EditorLevelLibrary.load_level(LEVEL_PATH)
        for actor in unreal.EditorLevelLibrary.get_all_level_actors():
            unreal.EditorLevelLibrary.destroy_actor(actor)
    else:
        unreal.EditorLevelLibrary.new_level(LEVEL_PATH)

    mesh = unreal.EditorAssetLibrary.load_asset(HEROINE_MESH)
    if not mesh:
        raise RuntimeError("Unable to load mesh: " + HEROINE_MESH)
    pawn_class = unreal.load_class(None, HEROINE_PAWN_CLASS)
    if not pawn_class:
        raise RuntimeError("Unable to load playable pawn class: " + HEROINE_PAWN_CLASS)

    cube = unreal.EditorAssetLibrary.load_asset("/Engine/BasicShapes/Cube.Cube")
    grid_material = unreal.EditorAssetLibrary.load_asset(GRID_MATERIAL)

    # A neutral stage: the template sky was blowing out the view, so keep this level simple.
    floor = spawn_actor(unreal.StaticMeshActor, unreal.Vector(0.0, 0.0, -5.0), label="Linxia_NeutralGreyFloor")
    floor_comp = floor.get_component_by_class(unreal.StaticMeshComponent)
    floor_comp.set_static_mesh(cube)
    set_prop(floor_comp, "mobility", unreal.ComponentMobility.MOVABLE)
    if grid_material:
        floor_comp.set_material(0, grid_material)
    floor.set_actor_scale3d(unreal.Vector(40.0, 40.0, 0.04))

    character = spawn_actor(
        pawn_class,
        unreal.Vector(0.0, 0.0, 96.0),
        unreal.Rotator(0.0, 0.0, 0.0),
        "Linxia_Phase_Visible",
    )
    set_prop(character, "auto_possess_player", unreal.AutoReceiveInput.PLAYER0)
    skel = character.get_component_by_class(unreal.SkeletalMeshComponent)
    if hasattr(skel, "set_skinned_asset_and_update"):
        skel.set_skinned_asset_and_update(mesh)
    else:
        skel.set_skeletal_mesh(mesh)

    key = spawn_actor(unreal.DirectionalLight, unreal.Vector(-260.0, -320.0, 520.0), unreal.Rotator(-38.0, -42.0, 0.0), "Linxia_KeyLight")
    key_comp = key.get_component_by_class(unreal.DirectionalLightComponent)
    set_prop(key_comp, "mobility", unreal.ComponentMobility.MOVABLE)
    set_prop(key_comp, "intensity", 8.0)
    set_prop(key_comp, "light_color", unreal.LinearColor(1.0, 0.95, 0.88, 1.0))
    set_prop(key_comp, "cast_shadows", True)
    set_prop(key_comp, "contact_shadow_length", 0.18)

    fill = spawn_actor(unreal.PointLight, unreal.Vector(180.0, -220.0, 170.0), label="Linxia_FillLight")
    fill_comp = fill.get_component_by_class(unreal.PointLightComponent)
    set_prop(fill_comp, "mobility", unreal.ComponentMobility.MOVABLE)
    set_prop(fill_comp, "intensity", 120.0)
    set_prop(fill_comp, "attenuation_radius", 700.0)
    set_prop(fill_comp, "light_color", unreal.LinearColor(0.55, 0.75, 1.0, 1.0))

    sky = spawn_actor(unreal.SkyLight, unreal.Vector(0.0, 0.0, 260.0), label="Linxia_SoftSkyLight")
    sky_comp = sky.get_component_by_class(unreal.SkyLightComponent)
    set_prop(sky_comp, "mobility", unreal.ComponentMobility.MOVABLE)
    set_prop(sky_comp, "intensity", 0.35)
    set_prop(sky_comp, "light_color", unreal.LinearColor(0.78, 0.86, 1.0, 1.0))

    camera_location = unreal.Vector(-250.0, 170.0, 125.0)
    camera_target = unreal.Vector(0.0, 0.0, 90.0)
    camera = spawn_actor(
        unreal.CameraActor,
        camera_location,
        look_at(camera_location, camera_target),
        "Linxia_CharacterPreviewCamera",
    )
    set_prop(camera.camera_component, "field_of_view", 28.0)

    # Pin the editor viewport to the camera and select the character for immediate inspection.
    try:
        unreal.get_editor_subsystem(unreal.EditorActorSubsystem).set_selected_level_actors([character])
    except Exception:
        pass
    unreal.EditorLevelLibrary.set_level_viewport_camera_info(
        camera.get_actor_location(),
        camera.get_actor_rotation(),
    )

    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    log("Saved controlled visible preview level: " + LEVEL_PATH)


setup_preview_level()
