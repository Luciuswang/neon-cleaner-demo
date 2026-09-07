import unreal


ANIM_DIR = "/Game/KellySource/Animations"
KELLY_MESH = "/Game/KellySource/rig.rig"
FRAME_RATE = 30
FRAME_COUNT = 30

# Kelly's deformation chains point along local X. These four profiles are
# deliberately small, reproducible pose candidates for multi-view review.
PROFILES = {
    "Default": {
        "Spine1_M": (0.0, 0.0, -12.0),
        "Spine2_M": (0.0, 0.0, -8.0),
        "Shoulder_L": (25.0, 0.0, 12.0),
        "Elbow_L": (0.0, 0.0, -42.0),
        "Shoulder_R": (25.0, 0.0, 12.0),
        "Elbow_R": (0.0, 0.0, -42.0),
        "Hip_L": (0.0, 0.0, 58.0),
        "Knee_L": (0.0, 0.0, -92.0),
        "Hip_R": (0.0, 0.0, 58.0),
        "Knee_R": (0.0, 0.0, -92.0),
    },
    "Compact": {
        "Spine1_M": (0.0, 0.0, 12.0),
        "Spine2_M": (0.0, 0.0, 8.0),
        "Shoulder_L": (-38.0, 0.0, -18.0),
        "Elbow_L": (0.0, 0.0, 62.0),
        "Shoulder_R": (-38.0, 0.0, -18.0),
        "Elbow_R": (0.0, 0.0, 62.0),
        "Hip_L": (0.0, 0.0, -58.0),
        "Knee_L": (0.0, 0.0, 92.0),
        "Hip_R": (0.0, 0.0, -58.0),
        "Knee_R": (0.0, 0.0, 92.0),
    },
    "Bars": {
        "Spine1_M": (0.0, 0.0, -12.0),
        "Spine2_M": (0.0, 0.0, -8.0),
        "Shoulder_L": (38.0, 0.0, 18.0),
        "Elbow_L": (0.0, 0.0, -62.0),
        "Shoulder_R": (38.0, 0.0, 18.0),
        "Elbow_R": (0.0, 0.0, -62.0),
        "Hip_L": (0.0, 0.0, 58.0),
        "Knee_L": (0.0, 0.0, -92.0),
        "Hip_R": (0.0, 0.0, 58.0),
        "Knee_R": (0.0, 0.0, -92.0),
    },
    "AsymBars": {
        "Spine1_M": (0.0, 0.0, 12.0),
        "Spine2_M": (0.0, 0.0, 8.0),
        "Shoulder_L": (38.0, 0.0, 18.0),
        "Elbow_L": (0.0, 0.0, 62.0),
        "Shoulder_R": (38.0, 0.0, 18.0),
        "Elbow_R": (0.0, 0.0, 62.0),
        "Hip_L": (0.0, 0.0, -58.0),
        "Knee_L": (0.0, 0.0, 92.0),
        "Hip_R": (0.0, 0.0, -58.0),
        "Knee_R": (0.0, 0.0, 92.0),
    },
}


def quat(pitch, yaw, roll):
    return unreal.Rotator(pitch, yaw, roll).quaternion()


def main():
    mesh = unreal.EditorAssetLibrary.load_asset(KELLY_MESH)
    if not mesh:
        raise RuntimeError("Missing Kelly mesh: " + KELLY_MESH)
    skeleton = mesh.get_editor_property("skeleton")
    if not skeleton:
        raise RuntimeError("Kelly mesh has no skeleton")

    unreal.EditorAssetLibrary.make_directory(ANIM_DIR)
    reference_pose = skeleton.get_reference_pose()
    reference_bones = {str(name) for name in reference_pose.get_bone_names()}

    for profile_name, rotations in PROFILES.items():
        asset_name = "AN_Kelly_MotorcycleRide_" + profile_name
        asset_path = ANIM_DIR + "/" + asset_name
        animation = (
            unreal.EditorAssetLibrary.load_asset(asset_path)
            if unreal.EditorAssetLibrary.does_asset_exist(asset_path)
            else None
        )
        if not animation:
            factory = unreal.AnimSequenceFactory()
            factory.set_editor_property("target_skeleton", skeleton)
            factory.set_editor_property("preview_skeletal_mesh", mesh)
            animation = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
                asset_name,
                ANIM_DIR,
                unreal.AnimSequence,
                factory,
            )
        if not animation:
            raise RuntimeError("Unable to create " + asset_path)

        controller = animation.get_editor_property("controller")
        controller.open_bracket("Create Kelly motorcycle ride " + profile_name, False)
        try:
            controller.remove_all_bone_tracks(False)
            controller.set_frame_rate(
                unreal.FrameRate(numerator=FRAME_RATE, denominator=1),
                False,
            )
            controller.set_play_length(1.0, False)
            controller.set_number_of_frames(unreal.FrameNumber(FRAME_COUNT), False)
            for bone_name, rotation_delta in rotations.items():
                if bone_name not in reference_bones:
                    raise RuntimeError("Missing Kelly bone: " + bone_name)
                reference = reference_pose.get_bone_pose(
                    bone_name,
                    unreal.AnimPoseSpaces.LOCAL,
                )
                delta = quat(*rotation_delta)
                positions = [reference.translation for _ in range(FRAME_COUNT + 1)]
                rotations_out = [
                    (delta * reference.rotation).normalized()
                    for _ in range(FRAME_COUNT + 1)
                ]
                scales = [reference.scale3d for _ in range(FRAME_COUNT + 1)]
                controller.add_bone_track(bone_name, False)
                if not controller.set_bone_track_keys(
                    bone_name,
                    positions,
                    rotations_out,
                    scales,
                    False,
                ):
                    raise RuntimeError("Unable to write bone track: " + bone_name)
        finally:
            controller.close_bracket(False)

        unreal.EditorAssetLibrary.save_asset(asset_path, only_if_is_dirty=False)
        unreal.log("[KellyRideAnim] Saved " + asset_path)

    unreal.log("[KellyRideAnim] Creation passed")
    unreal.SystemLibrary.execute_console_command(None, "QUIT_EDITOR")


main()
