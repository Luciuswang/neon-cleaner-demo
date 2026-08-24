import unreal


LEVEL = "/Game/LinxiaRiderProxy/LVL_Linxia_RiderProxy"
CAMERA_BY_VIEW = {
    "handoff": "Linxia_Rider_HandoffCamera",
    "side": "Linxia_Rider_SideCamera",
    "rear": "Linxia_Rider_RearCamera",
}


def log(message):
    unreal.log("[LinxiaRiderProxyFocus] " + message)


def main():
    command_line = unreal.SystemLibrary.get_command_line()
    view = "handoff"
    marker = "-LinxiaRiderProxyView="
    for token in command_line.split():
        if token.startswith(marker):
            view = token[len(marker):].strip().lower()
    camera_label = CAMERA_BY_VIEW.get(view, CAMERA_BY_VIEW["handoff"])

    unreal.EditorLevelLibrary.load_level(LEVEL)
    by_label = {
        actor.get_actor_label(): actor
        for actor in unreal.EditorLevelLibrary.get_all_level_actors()
    }
    camera = by_label.get(camera_label)
    if camera is None:
        raise RuntimeError("Missing camera actor: " + camera_label)

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
    log("Focused " + view + " viewport on " + camera_label)


main()
