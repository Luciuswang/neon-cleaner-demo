import unreal


LEVEL = "/Game/ThirdPerson/Lvl_ThirdPerson"
QUINN_MESH = "/Game/Characters/Mannequins/Meshes/SKM_Quinn_Simple.SKM_Quinn_Simple"
PREVIEW_LABEL = "Linxia_Quinn_Visible"
CAMERA_LABEL = "Linxia_EditorPreviewCamera"


def log(message):
    unreal.log("[LinxiaPreviewSetup] " + message)


def find_actor_by_label(label):
    for actor in unreal.EditorLevelLibrary.get_all_level_actors():
        if actor.get_actor_label() == label:
            return actor
    return None


def remove_existing(label):
    actor = find_actor_by_label(label)
    if actor:
        unreal.EditorLevelLibrary.destroy_actor(actor)


def main():
    unreal.EditorLevelLibrary.load_level(LEVEL)

    mesh = unreal.EditorAssetLibrary.load_asset(QUINN_MESH)
    if not mesh:
        raise RuntimeError("Unable to load Quinn mesh: " + QUINN_MESH)

    remove_existing(PREVIEW_LABEL)
    remove_existing(CAMERA_LABEL)

    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.SkeletalMeshActor,
        unreal.Vector(120.0, -40.0, 92.0),
        unreal.Rotator(0.0, 180.0, 0.0),
    )
    actor.set_actor_label(PREVIEW_LABEL)
    skel = actor.get_component_by_class(unreal.SkeletalMeshComponent)
    if hasattr(skel, "set_skinned_asset_and_update"):
        skel.set_skinned_asset_and_update(mesh)
    else:
        skel.set_skeletal_mesh(mesh)
    skel.set_editor_property("animation_mode", unreal.AnimationMode.ANIMATION_SINGLE_NODE)

    camera = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.CameraActor,
        unreal.Vector(-280.0, -520.0, 185.0),
        unreal.Rotator(-9.0, 32.0, 0.0),
    )
    camera.set_actor_label(CAMERA_LABEL)
    camera.camera_component.set_editor_property("field_of_view", 42.0)

    unreal.EditorLevelLibrary.set_level_viewport_camera_info(
        camera.get_actor_location(),
        camera.get_actor_rotation(),
    )

    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    log("Saved visible Quinn preview actor in " + LEVEL)


main()
