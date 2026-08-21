import unreal


LEVEL_PATH = "/Game/LinxiaPreview/LVL_Linxia_CharacterPreview"
REQUIRED = {
    "Linxia_Phase_Visible",
    "Linxia_CharacterPreviewCamera",
    "Linxia_KeyLight",
    "Linxia_FillLight",
    "Linxia_SoftSkyLight",
    "Linxia_NeutralGreyFloor",
}
EXPECTED_MESH = "/Game/ParagonPhase/Characters/Heroes/Phase/Meshes/Phase_GDC.Phase_GDC"


def log(message):
    unreal.log("[LinxiaPreviewValidate] " + message)


def main():
    unreal.EditorLevelLibrary.load_level(LEVEL_PATH)
    actors = unreal.EditorLevelLibrary.get_all_level_actors()
    by_label = {actor.get_actor_label(): actor for actor in actors}
    missing = sorted(REQUIRED - set(by_label.keys()))
    if missing:
        raise RuntimeError("Missing preview actors: " + ", ".join(missing))

    character = by_label["Linxia_Phase_Visible"]
    if not isinstance(character, unreal.Pawn):
        raise RuntimeError("Preview character is not a playable Pawn")
    auto_possess = character.get_editor_property("auto_possess_player")
    if auto_possess != unreal.AutoReceiveInput.PLAYER0:
        raise RuntimeError("Preview Pawn is not set to auto possess Player0")
    skel = character.get_component_by_class(unreal.SkeletalMeshComponent)
    mesh = skel.get_editor_property("skeletal_mesh") if skel else None
    if mesh is None:
        raise RuntimeError("Character has no skeletal mesh")
    if mesh.get_path_name() != EXPECTED_MESH:
        raise RuntimeError("Unexpected character mesh: " + mesh.get_path_name())

    for label in sorted(REQUIRED):
        actor = by_label[label]
        loc = actor.get_actor_location()
        rot = actor.get_actor_rotation()
        log(f"{label}: loc=({loc.x:.1f},{loc.y:.1f},{loc.z:.1f}) rot=({rot.pitch:.1f},{rot.yaw:.1f},{rot.roll:.1f})")

    log("Character mesh: " + mesh.get_path_name())
    log("Validation passed")
    unreal.SystemLibrary.execute_console_command(None, "QUIT_EDITOR")


main()
