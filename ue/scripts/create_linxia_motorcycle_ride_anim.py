import math
import unreal


ANIM_DIR = "/Game/LinxiaRig/Animations"
ANIM_NAME = "AN_Linxia_MotorcycleRide_Idle"
ANIM_PATH = ANIM_DIR + "/" + ANIM_NAME
PHASE_MESH = "/Game/ParagonPhase/Characters/Heroes/Phase/Meshes/Phase_GDC.Phase_GDC"


def log(message):
    unreal.log("[LinxiaRideAnim] " + message)


def quat(pitch, yaw=0.0, roll=0.0):
    return unreal.Rotator(pitch, yaw, roll).quaternion()


FRAME_RATE = 30
FRAME_COUNT = 30


def eased_breath(base, amplitude):
    values = []
    for frame in range(FRAME_COUNT + 1):
        cycle = frame / float(FRAME_COUNT)
        values.append(base + amplitude * math.sin(cycle * math.tau))
    return values


POSE_ROTATIONS = {
    "pelvis": eased_breath(-10.0, 0.7),
    "spine_01": eased_breath(-12.0, 1.0),
    "spine_02": eased_breath(-12.0, 0.8),
    "spine_03": eased_breath(-10.0, 0.5),
    "neck_01": eased_breath(9.0, 0.4),
    "head": eased_breath(5.0, 0.3),
}


def eased_rotator(pitch, yaw=0.0, roll=0.0, amp_pitch=0.0, amp_yaw=0.0, amp_roll=0.0):
    values = []
    for frame in range(FRAME_COUNT + 1):
        cycle = frame / float(FRAME_COUNT)
        wave = math.sin(cycle * math.tau)
        values.append((pitch + amp_pitch * wave, yaw + amp_yaw * wave, roll + amp_roll * wave))
    return values


POSE_ROTATIONS.update(
    {
        "clavicle_l": eased_rotator(-12.0, -8.0, 0.0, 0.3, 0.0, 0.3),
        "upperarm_l": eased_rotator(-34.0, -14.0, 0.0, 0.6, 0.2, 0.5),
        "lowerarm_l": eased_rotator(-40.0, -6.0, 0.0, 0.4, 0.0, 0.4),
        "hand_l": eased_rotator(-6.0, -3.0, -4.0, 0.2, 0.0, 0.3),
        "clavicle_r": eased_rotator(-12.0, 8.0, 0.0, 0.3, 0.0, -0.3),
        "upperarm_r": eased_rotator(-34.0, 14.0, 0.0, 0.6, -0.2, -0.5),
        "lowerarm_r": eased_rotator(-40.0, 6.0, 0.0, 0.4, 0.0, -0.4),
        "hand_r": eased_rotator(-6.0, 3.0, 4.0, 0.2, 0.0, -0.3),
        "thigh_l": eased_rotator(-34.0, -4.0, 0.0, 0.5, 0.0, 0.4),
        "calf_l": eased_rotator(42.0, -2.0, 0.0, 0.4, 0.0, 0.0),
        "foot_l": eased_rotator(-12.0, 0.0, 0.0, 0.2, 0.0, 0.0),
        "thigh_r": eased_rotator(-34.0, 4.0, 0.0, 0.5, 0.0, -0.4),
        "calf_r": eased_rotator(42.0, 2.0, 0.0, 0.4, 0.0, 0.0),
        "foot_r": eased_rotator(-12.0, 0.0, 0.0, 0.2, 0.0, 0.0),
    }
)


def transform_property(transform, name):
    return transform.get_editor_property(name)


def rotation_keys(values):
    keys = []
    for value in values:
        if isinstance(value, tuple):
            keys.append(quat(value[0], value[1], value[2]))
        else:
            keys.append(quat(value))
    return keys


def main():
    mesh = unreal.EditorAssetLibrary.load_asset(PHASE_MESH)
    if not mesh:
        raise RuntimeError("Missing Phase mesh: " + PHASE_MESH)
    skeleton = mesh.get_editor_property("skeleton")
    if not skeleton:
        raise RuntimeError("Phase mesh has no skeleton")

    unreal.EditorAssetLibrary.make_directory(ANIM_DIR)
    anim = unreal.EditorAssetLibrary.load_asset(ANIM_PATH)
    if not anim:
        factory = unreal.AnimSequenceFactory()
        factory.set_editor_property("target_skeleton", skeleton)
        factory.set_editor_property("preview_skeletal_mesh", mesh)

        anim = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
            ANIM_NAME, ANIM_DIR, unreal.AnimSequence, factory
        )
        if not anim:
            raise RuntimeError("Unable to create animation: " + ANIM_PATH)

    try:
        anim.set_editor_property("preview_pose_asset", None)
    except Exception:
        pass
    controller = anim.get_editor_property("controller")
    if not controller:
        raise RuntimeError("AnimSequence has no data controller")

    controller.open_bracket("Create Linxia motorcycle ride idle", False)
    try:
        controller.remove_all_bone_tracks(False)
        controller.set_frame_rate(unreal.FrameRate(numerator=FRAME_RATE, denominator=1), False)
        controller.set_play_length(1.0, False)
        controller.set_number_of_frames(unreal.FrameNumber(FRAME_COUNT), False)
        ref_pose = skeleton.get_reference_pose()
        ref_bones = {str(name) for name in ref_pose.get_bone_names()}

        for bone_name, values in POSE_ROTATIONS.items():
            if bone_name not in ref_bones:
                raise RuntimeError("Phase reference pose missing bone: " + bone_name)
            ref_transform = ref_pose.get_bone_pose(bone_name, unreal.AnimPoseSpaces.LOCAL)
            ref_translation = transform_property(ref_transform, "translation")
            ref_rotation = transform_property(ref_transform, "rotation")
            ref_scale = transform_property(ref_transform, "scale3d")
            positions = [ref_translation for _ in range(FRAME_COUNT + 1)]
            rotations = [(delta * ref_rotation).normalized() for delta in rotation_keys(values)]
            scales = [ref_scale for _ in range(FRAME_COUNT + 1)]
            controller.add_bone_track(bone_name, False)
            ok = controller.set_bone_track_keys(
                bone_name,
                positions,
                rotations,
                scales,
                False,
            )
            if not ok:
                raise RuntimeError("Unable to write bone track: " + bone_name)
    finally:
        controller.close_bracket(False)

    unreal.EditorAssetLibrary.save_asset(ANIM_PATH, only_if_is_dirty=False)
    log("Saved " + ANIM_PATH)
    log("length=" + str(unreal.AnimationLibrary.get_sequence_length(anim)))
    log("tracks=" + ",".join([str(x) for x in unreal.AnimationLibrary.get_animation_track_names(anim)]))
    unreal.SystemLibrary.execute_console_command(None, "QUIT_EDITOR")


main()
