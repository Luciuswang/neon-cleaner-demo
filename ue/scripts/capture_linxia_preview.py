import math
import time

import unreal


LEVEL = "/Game/ThirdPerson/Lvl_ThirdPerson"
QUINN_MESH = "/Game/Characters/Mannequins/Meshes/SKM_Quinn_Simple.SKM_Quinn_Simple"
OUT_NAME = "linxia_quinn_preview"


def log(message):
    unreal.log("[LinxiaPreview] " + message)


def main():
    unreal.EditorLevelLibrary.load_level(LEVEL)

    mesh = unreal.EditorAssetLibrary.load_asset(QUINN_MESH)
    if not mesh:
        raise RuntimeError("Unable to load Quinn mesh: " + QUINN_MESH)

    # Put the character on the template floor, facing the preview camera.
    location = unreal.Vector(0.0, 0.0, 92.0)
    rotation = unreal.Rotator(0.0, 180.0, 0.0)
    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.SkeletalMeshActor, location, rotation
    )
    actor.set_actor_label("Linxia_Quinn_RuntimePreview")
    skel = actor.get_component_by_class(unreal.SkeletalMeshComponent)
    skel.set_skeletal_mesh(mesh)
    skel.set_editor_property("animation_mode", unreal.AnimationMode.ANIMATION_SINGLE_NODE)

    camera = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.CameraActor,
        unreal.Vector(-320.0, -520.0, 190.0),
        unreal.Rotator(-10.0, 32.0, 0.0),
    )
    camera.set_actor_label("Linxia_PreviewCamera")
    camera.camera_component.set_editor_property("field_of_view", 42.0)

    unreal.EditorLevelLibrary.set_level_viewport_camera_info(
        camera.get_actor_location(), camera.get_actor_rotation()
    )

    unreal.AutomationLibrary.take_high_res_screenshot(
        1280,
        720,
        OUT_NAME,
        camera=camera,
        mask_enabled=False,
        capture_hdr=False,
        comparison_tolerance=unreal.ComparisonTolerance.LOW,
        delay=1.0,
    )
    log("Requested screenshot: " + OUT_NAME)
    time.sleep(3)


main()
