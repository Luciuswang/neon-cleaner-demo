import unreal


LEVEL = "/Game/LinxiaRiderProxy/LVL_Linxia_RiderProxy"
CAMERA_LABEL = "Linxia_Rider_HandoffCamera"


def log(message):
    unreal.log("[LinxiaRiderProxyFocus] " + message)


def main():
    unreal.EditorLevelLibrary.load_level(LEVEL)
    by_label = {
        actor.get_actor_label(): actor
        for actor in unreal.EditorLevelLibrary.get_all_level_actors()
    }
    camera = by_label.get(CAMERA_LABEL)
    if camera is None:
        raise RuntimeError("Missing camera actor: " + CAMERA_LABEL)

    try:
        actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
        actor_subsystem.set_selected_level_actors([])
    except Exception:
        pass

    unreal.EditorLevelLibrary.set_level_viewport_camera_info(
        camera.get_actor_location(),
        camera.get_actor_rotation(),
    )
    unreal.SystemLibrary.execute_console_command(None, "viewmode lit")
    unreal.SystemLibrary.execute_console_command(None, "showflag.BillboardSprites 0")
    log("Focused handoff viewport on " + CAMERA_LABEL)


main()
