import unreal


LEVEL_PATH = "/Game/LinxiaChase/LVL_Linxia_MotorcycleChase"
EXPECTED_PAWN_CLASS = "/Script/NeonCleanerUE.LinxiaMotorcyclePawn"
EXPECTED_GAMEMODE_CLASS = "/Script/NeonCleanerUE.LinxiaMotorcycleChaseGameMode"
EXPECTED_HUD_CLASS = "/Script/NeonCleanerUE.LinxiaMotorcycleHud"
EXPECTED_IMPORTED_BIKE = "/Game/LinxiaChase/Imported/SM_PlayerMotorcycle.SM_PlayerMotorcycle"
EXPECTED_RIDE_ANIMATION = "/Game/LinxiaRig/Animations/AN_Linxia_MotorcycleRide_Idle.AN_Linxia_MotorcycleRide_Idle"
SOURCE_PHASE_MESH = "/Game/ParagonPhase/Characters/Heroes/Phase/Meshes/Phase_GDC.Phase_GDC"
SOURCE_PHASE_ANIM_BLUEPRINT = "/Game/ParagonPhase/Characters/Heroes/Phase/Phase_AnimBlueprint.Phase_AnimBlueprint"
REQUIRED_LABELS = {
    "Linxia_MotorcyclePawn",
    "Gate3_Road_Main",
    "Gate3_Road_Extension",
    "Gate3_ChaseTarget_Body",
    "Gate3_ChaseTarget_Signal",
    "Gate3_FirstPlayableFrameCamera",
    "Gate3_TargetPreviewCamera",
    "Gate3_KeyLight_Cold",
    "Gate3_SkyLight",
}


def log(message):
    unreal.log("[LinxiaMotorcycleChaseValidate] " + message)


def distance_2d(a, b):
    dx = a.x - b.x
    dy = a.y - b.y
    return (dx * dx + dy * dy) ** 0.5


def assert_between(name, value, low, high):
    if value < low or value > high:
        raise RuntimeError(f"{name}={value:.1f} outside expected range {low:.1f}-{high:.1f}")


def assert_near_angle(name, value, expected, tolerance):
    delta = abs(((value - expected + 180.0) % 360.0) - 180.0)
    if delta > tolerance:
        raise RuntimeError(
            f"{name}={value:.1f} not aligned to expected {expected:.1f} +/- {tolerance:.1f}"
        )


def main():
    unreal.EditorLevelLibrary.load_level(LEVEL_PATH)
    actors = unreal.EditorLevelLibrary.get_all_level_actors()
    by_label = {actor.get_actor_label(): actor for actor in actors}
    missing = sorted(REQUIRED_LABELS - set(by_label.keys()))
    if missing:
        raise RuntimeError("Missing Gate 3 chase actors: " + ", ".join(missing))

    pawn = by_label["Linxia_MotorcyclePawn"]
    pawn_class = unreal.load_class(None, EXPECTED_PAWN_CLASS)
    game_mode_class = unreal.load_class(None, EXPECTED_GAMEMODE_CLASS)
    hud_class = unreal.load_class(None, EXPECTED_HUD_CLASS)
    if not pawn_class or not pawn.get_class().get_path_name().startswith(pawn_class.get_path_name()):
        raise RuntimeError("Linxia_MotorcyclePawn is not the expected C++ pawn class")
    if not hud_class:
        raise RuntimeError("Linxia motorcycle HUD class is missing")
    if pawn.get_editor_property("auto_possess_player") != unreal.AutoReceiveInput.PLAYER0:
        raise RuntimeError("Motorcycle pawn is not set to auto possess Player0")

    skeletal = pawn.get_component_by_class(unreal.SkeletalMeshComponent)
    if skeletal is None:
        raise RuntimeError("Motorcycle pawn has no visible Lin Xia skeletal mesh")
    source_phase_mesh = unreal.EditorAssetLibrary.load_asset(SOURCE_PHASE_MESH)
    if source_phase_mesh is None:
        raise RuntimeError(
            "Missing required Fab asset from Paragon: Phase: "
            f"source skeletal mesh {SOURCE_PHASE_MESH}"
        )
    source_phase_anim_blueprint = unreal.EditorAssetLibrary.load_asset(SOURCE_PHASE_ANIM_BLUEPRINT)
    if source_phase_anim_blueprint is None:
        raise RuntimeError(
            "Missing required Fab asset from Paragon: Phase: "
            f"source animation blueprint {SOURCE_PHASE_ANIM_BLUEPRINT}"
        )
    mesh = skeletal.get_editor_property("skeletal_mesh")
    if mesh != source_phase_mesh:
        actual_mesh_path = mesh.get_path_name() if mesh is not None else "None"
        raise RuntimeError(
            "Motorcycle pawn is not using the exact Paragon: Phase Fab source skeletal mesh: "
            f"expected {SOURCE_PHASE_MESH}, got {actual_mesh_path}"
        )
    ride_animation = unreal.EditorAssetLibrary.load_asset(EXPECTED_RIDE_ANIMATION)
    if ride_animation is None:
        raise RuntimeError("Missing Lin Xia motorcycle ride animation")

    spring_arm = pawn.get_component_by_class(unreal.SpringArmComponent)
    camera = pawn.get_component_by_class(unreal.CameraComponent)
    if spring_arm is None or camera is None:
        raise RuntimeError("Motorcycle pawn is missing chase camera components")
    assert_between("camera arm length", spring_arm.get_editor_property("target_arm_length"), 460.0, 620.0)
    assert_between("camera fov", camera.get_editor_property("field_of_view"), 62.0, 78.0)

    imported_mesh = unreal.EditorAssetLibrary.load_asset(EXPECTED_IMPORTED_BIKE)
    if imported_mesh is None:
        raise RuntimeError("Imported high-quality motorcycle mesh is missing")
    imported_component = None
    for component in pawn.get_components_by_class(unreal.StaticMeshComponent):
        if component.get_name() == "ImportedMotorcycle":
            imported_component = component
            break
    if imported_component is None:
        raise RuntimeError("Motorcycle pawn is missing ImportedMotorcycle component")
    component_mesh = imported_component.get_editor_property("static_mesh")
    if component_mesh is None or component_mesh.get_path_name() != EXPECTED_IMPORTED_BIKE:
        raise RuntimeError("Motorcycle pawn is not using the imported player-motorcycle mesh")
    imported_rotation = imported_component.get_editor_property("relative_rotation")
    assert_near_angle("imported motorcycle relative yaw", imported_rotation.yaw, 0.0, 2.0)
    assert_near_angle("rider relative yaw", skeletal.get_editor_property("relative_rotation").yaw, 270.0, 2.0)

    target = by_label["Gate3_ChaseTarget_Body"]
    if unreal.Name("Gate3ChaseTarget") not in target.get_editor_property("tags"):
        raise RuntimeError("Chase target is missing Gate3ChaseTarget tag")
    target_distance = distance_2d(pawn.get_actor_location(), target.get_actor_location())
    assert_between("starting chase target distance", target_distance, 3600.0, 4800.0)
    assert_between("pawn start z", pawn.get_actor_location().z, -5.0, 5.0)

    obstacle_count = len(
        [
            actor
            for actor in actors
            if actor.get_actor_label().startswith("Gate3_Debris")
            or actor.get_actor_label().startswith("Gate3_FinalDebris")
            or actor.get_actor_label().startswith("Gate3_LaneShift")
        ]
    )
    if obstacle_count < 5:
        raise RuntimeError("Need at least five readable chase obstacle beats")

    try:
        world_settings = unreal.EditorLevelLibrary.get_editor_world().get_world_settings()
        current_game_mode = world_settings.get_editor_property("default_game_mode")
        if game_mode_class and current_game_mode != game_mode_class:
            raise RuntimeError("World game mode override is not LinxiaMotorcycleChaseGameMode")
        game_mode_defaults = unreal.get_default_object(game_mode_class)
        if game_mode_defaults.get_editor_property("hud_class") != hud_class:
            raise RuntimeError("LinxiaMotorcycleChaseGameMode is not using LinxiaMotorcycleHud")
    except Exception as exc:
        raise RuntimeError("Unable to validate world game mode override: " + str(exc))

    log(f"pawn={pawn.get_name()} loc={pawn.get_actor_location().to_tuple()}")
    log(f"source_phase_mesh={source_phase_mesh.get_path_name()}")
    log(f"source_phase_anim_blueprint={source_phase_anim_blueprint.get_path_name()}")
    log(f"rider_mesh={mesh.get_path_name()}")
    log(f"rider_animation={ride_animation.get_path_name()}")
    log(f"motorcycle_mesh={imported_mesh.get_path_name()}")
    log(f"motorcycle_relative_yaw={imported_rotation.yaw:.1f}")
    log(f"target_distance={target_distance:.1f}")
    log(f"obstacle_count={obstacle_count}")
    log("Validation passed")
    unreal.SystemLibrary.execute_console_command(None, "QUIT_EDITOR")


main()
