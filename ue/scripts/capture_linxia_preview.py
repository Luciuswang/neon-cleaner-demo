import time

import unreal


LEVEL = "/Game/LinxiaPreview/LVL_Linxia_CharacterPreview"
CAMERA_LABEL = "Linxia_CharacterPreviewCamera"
CHARACTER_LABEL = "Linxia_Phase_Visible"
OUT_NAME = "linxia_phase_preview_2026_08_24"


def log(message):
    unreal.log("[LinxiaPreview] " + message)


def main():
    unreal.EditorLevelLibrary.load_level(LEVEL)

    actors = unreal.EditorLevelLibrary.get_all_level_actors()
    by_label = {actor.get_actor_label(): actor for actor in actors}
    character = by_label.get(CHARACTER_LABEL)
    camera = by_label.get(CAMERA_LABEL)
    if character is None:
        raise RuntimeError("Missing character actor: " + CHARACTER_LABEL)
    if camera is None:
        raise RuntimeError("Missing camera actor: " + CAMERA_LABEL)

    unreal.EditorLevelLibrary.set_level_viewport_camera_info(
        camera.get_actor_location(), camera.get_actor_rotation()
    )
    try:
        unreal.get_editor_subsystem(unreal.EditorActorSubsystem).set_selected_level_actors([character])
    except Exception:
        pass

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
    unreal.SystemLibrary.execute_console_command(None, "QUIT_EDITOR")


main()
