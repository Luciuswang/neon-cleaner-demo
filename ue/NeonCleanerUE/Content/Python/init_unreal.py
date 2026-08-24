import unreal


LEVEL = "/Game/LinxiaPreview/LVL_Linxia_CharacterPreview"
TARGET_LABEL = "Linxia_Phase_Visible"


def log(message):
    unreal.log("[LinxiaStartupView] " + message)


def is_game_runtime():
    command_line = unreal.SystemLibrary.get_command_line().lower()
    return "-game" in command_line


def is_linxia_rider_proxy_workflow():
    command_line = unreal.SystemLibrary.get_command_line().lower()
    return "linxiariderproxy" in command_line or "linxia_rider_proxy" in command_line


def find_actor(label):
    for actor in unreal.EditorLevelLibrary.get_all_level_actors():
        if actor.get_actor_label() == label:
            return actor
    return None


def focus_linxia():
    actor = find_actor(TARGET_LABEL)
    if actor is None:
        unreal.EditorLevelLibrary.load_level(LEVEL)
        actor = find_actor(TARGET_LABEL)

    if actor is None:
        log("Preview actor not found: " + TARGET_LABEL)
        return

    try:
        actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
        actor_subsystem.set_selected_level_actors([actor])
    except Exception:
        pass

    location = actor.get_actor_location()
    camera_location = unreal.Vector(location.x - 250.0, location.y + 170.0, location.z + 29.0)
    camera_target = unreal.Vector(location.x, location.y, location.z - 6.0)
    camera_rotation = unreal.MathLibrary.find_look_at_rotation(camera_location, camera_target)
    unreal.EditorLevelLibrary.set_level_viewport_camera_info(camera_location, camera_rotation)
    log("Focused editor viewport on " + TARGET_LABEL)


if is_game_runtime():
    log("Skipped editor viewport focus during game runtime")
elif is_linxia_rider_proxy_workflow():
    log("Skipped editor viewport focus during Linxia rider proxy workflow")
else:
    focus_linxia()
