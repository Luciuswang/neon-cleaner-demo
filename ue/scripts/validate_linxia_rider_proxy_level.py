import unreal


LEVEL_PATH = "/Game/LinxiaRiderProxy/LVL_Linxia_RiderProxy"
EXPECTED_MESH = "/Game/ParagonPhase/Characters/Heroes/Phase/Meshes/Phase_GDC.Phase_GDC"
REQUIRED_LABELS = {
    "Linxia_RiderProxy_Phase",
    "Linxia_RiderRuntimePawn_Phase",
    "NC_Motorcycle_FrontWheel",
    "NC_Motorcycle_RearWheel",
    "NC_Motorcycle_BatterySpine",
    "NC_Motorcycle_Seat",
    "NC_Motorcycle_Handlebar",
    "NC_Motorcycle_NoseLight_Cyan",
    "NC_Motorcycle_TailSignal_Magenta",
    "Linxia_Rider_HandoffCamera",
    "Linxia_Rider_SideCamera",
    "Linxia_Rider_RearCamera",
    "Gate2_WetRoad_Base",
    "Gate2_KeyLight_Cold",
    "Gate2_MagentaRimLight",
    "Gate2_CyanFillLight",
}


def log(message):
    unreal.log("[LinxiaRiderProxyValidate] " + message)


def distance_2d(a, b):
    dx = a.x - b.x
    dy = a.y - b.y
    return (dx * dx + dy * dy) ** 0.5


def assert_between(name, value, low, high):
    if value < low or value > high:
        raise RuntimeError(f"{name}={value:.1f} outside expected range {low:.1f}-{high:.1f}")


def main():
    unreal.EditorLevelLibrary.load_level(LEVEL_PATH)
    actors = unreal.EditorLevelLibrary.get_all_level_actors()
    by_label = {actor.get_actor_label(): actor for actor in actors}
    missing = sorted(REQUIRED_LABELS - set(by_label.keys()))
    if missing:
        raise RuntimeError("Missing Gate 2 proxy actors: " + ", ".join(missing))

    pose_rider = by_label["Linxia_RiderProxy_Phase"]
    runtime_rider = by_label["Linxia_RiderRuntimePawn_Phase"]
    if not isinstance(runtime_rider, unreal.Pawn):
        raise RuntimeError("Rider proxy is not a Pawn")
    auto_possess = runtime_rider.get_editor_property("auto_possess_player")
    if auto_possess != unreal.AutoReceiveInput.PLAYER0:
        raise RuntimeError("Runtime rider pawn is not set to auto possess Player0")
    runtime_skel = runtime_rider.get_component_by_class(unreal.SkeletalMeshComponent)
    skel = pose_rider.get_component_by_class(unreal.PoseableMeshComponent)
    if skel is None:
        skel = pose_rider.get_component_by_class(unreal.SkeletalMeshComponent)
    if runtime_skel is None:
        raise RuntimeError("Runtime rider pawn has no skeletal mesh")
    runtime_mesh = runtime_skel.get_editor_property("skeletal_mesh")
    if runtime_mesh is None or runtime_mesh.get_path_name() != EXPECTED_MESH:
        raise RuntimeError("Unexpected runtime rider mesh")
    mesh = skel.get_editor_property("skeletal_mesh") if skel else None
    if mesh is None:
        raise RuntimeError("Visible rider proxy has no skeletal mesh")
    if mesh.get_path_name() != EXPECTED_MESH:
        raise RuntimeError("Unexpected visible rider mesh: " + mesh.get_path_name())

    front = by_label["NC_Motorcycle_FrontWheel"]
    rear = by_label["NC_Motorcycle_RearWheel"]
    front_loc = front.get_actor_location()
    rear_loc = rear.get_actor_location()
    wheelbase = distance_2d(front_loc, rear_loc)
    assert_between("motorcycle wheelbase", wheelbase, 250.0, 310.0)
    assert_between("front wheel ground-contact z", front_loc.z, 38.0, 52.0)
    assert_between("rear wheel ground-contact z", rear_loc.z, 38.0, 52.0)
    assert_between("front wheel lateral offset", abs(front_loc.y), 0.0, 8.0)
    assert_between("rear wheel lateral offset", abs(rear_loc.y), 0.0, 8.0)

    seat_loc = by_label["NC_Motorcycle_Seat"].get_actor_location()
    rider_loc = pose_rider.get_actor_location()
    assert_between("rider seat horizontal offset", distance_2d(seat_loc, rider_loc), 0.0, 65.0)
    assert_between("pose rider root below seat", rider_loc.z - seat_loc.z, -115.0, -75.0)

    handoff_camera = by_label["Linxia_Rider_HandoffCamera"]
    camera_loc = handoff_camera.get_actor_location()
    assert_between("handoff camera height", camera_loc.z, 110.0, 170.0)
    assert_between("handoff camera distance", distance_2d(camera_loc, rider_loc), 360.0, 560.0)
    fov = handoff_camera.camera_component.get_editor_property("field_of_view")
    assert_between("handoff camera fov", fov, 30.0, 42.0)

    labels_to_log = [
        "Linxia_RiderProxy_Phase",
        "Linxia_RiderRuntimePawn_Phase",
        "NC_Motorcycle_FrontWheel",
        "NC_Motorcycle_RearWheel",
        "NC_Motorcycle_Seat",
        "Linxia_Rider_HandoffCamera",
        "Linxia_Rider_SideCamera",
        "Linxia_Rider_RearCamera",
    ]
    for label in labels_to_log:
        actor = by_label[label]
        loc = actor.get_actor_location()
        rot = actor.get_actor_rotation()
        log(f"{label}: loc=({loc.x:.1f},{loc.y:.1f},{loc.z:.1f}) rot=({rot.pitch:.1f},{rot.yaw:.1f},{rot.roll:.1f})")

    log("Rider mesh: " + mesh.get_path_name())
    log(f"Motorcycle wheelbase: {wheelbase:.1f}")
    log("Validation passed")
    unreal.SystemLibrary.execute_console_command(None, "QUIT_EDITOR")


main()
