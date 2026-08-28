import unreal


ANIM_PATH = "/Game/LinxiaRig/Animations/AN_Linxia_MotorcycleRide_Idle.AN_Linxia_MotorcycleRide_Idle"
EXPECTED_SKELETON = "/Game/ParagonPhase/Characters/Heroes/Phase/Meshes/phase_Skeleton.phase_Skeleton"
REQUIRED_TRACKS = {
    "pelvis",
    "spine_01",
    "spine_02",
    "spine_03",
    "neck_01",
    "head",
    "clavicle_l",
    "upperarm_l",
    "lowerarm_l",
    "hand_l",
    "clavicle_r",
    "upperarm_r",
    "lowerarm_r",
    "hand_r",
    "thigh_l",
    "calf_l",
    "foot_l",
    "thigh_r",
    "calf_r",
    "foot_r",
}


def log(message):
    unreal.log("[LinxiaRideAnimValidate] " + message)


def main():
    anim = unreal.EditorAssetLibrary.load_asset(ANIM_PATH)
    if not anim:
        raise RuntimeError("Missing ride animation asset: " + ANIM_PATH)

    skeleton = anim.get_skeleton()
    if not skeleton or skeleton.get_path_name() != EXPECTED_SKELETON:
        raise RuntimeError("Unexpected animation skeleton: " + (skeleton.get_path_name() if skeleton else "None"))

    length = unreal.AnimationLibrary.get_sequence_length(anim)
    if abs(length - 1.0) > 0.01:
        raise RuntimeError(f"Unexpected animation length: {length}")

    tracks = {str(name) for name in unreal.AnimationLibrary.get_animation_track_names(anim)}
    missing = sorted(REQUIRED_TRACKS - tracks)
    if missing:
        raise RuntimeError("Missing rider animation tracks: " + ", ".join(missing))

    for track_name in ["pelvis", "spine_03", "hand_l", "hand_r", "foot_l", "foot_r"]:
        try:
            unreal.AnimationLibrary.get_bone_pose_for_time(anim, track_name, 0.5, False)
        except Exception as exc:
            raise RuntimeError("Unable to evaluate rider animation bone " + track_name + ": " + str(exc))

    log("Validation passed")
    log("length=" + str(length))
    log("tracks=" + ",".join(sorted(tracks)))
    unreal.SystemLibrary.execute_console_command(None, "QUIT_EDITOR")


main()
