import json
import os

import unreal


KELLY_MESH = "/Game/KellySource/rig.rig"
KEY_BONES = (
    "Root_M",
    "Spine1_M",
    "Spine2_M",
    "Spine3_M",
    "Spine4_M",
    "Chest_M",
    "Neck_M",
    "Head_M",
    "Scapula_L",
    "Shoulder_L",
    "ShoulderPart1_L",
    "ShoulderPart2_L",
    "Elbow_L",
    "ElbowPart1_L",
    "ElbowPart2_L",
    "Wrist_L",
    "Scapula_R",
    "Shoulder_R",
    "ShoulderPart1_R",
    "ShoulderPart2_R",
    "Elbow_R",
    "ElbowPart1_R",
    "ElbowPart2_R",
    "Wrist_R",
    "Hip_L",
    "HipPart1_L",
    "HipPart2_L",
    "Knee_L",
    "KneePart1_L",
    "KneePart2_L",
    "Ankle_L",
    "Hip_R",
    "HipPart1_R",
    "HipPart2_R",
    "Knee_R",
    "KneePart1_R",
    "KneePart2_R",
    "Ankle_R",
)


def vector_dict(value):
    return {"x": value.x, "y": value.y, "z": value.z}


def quat_dict(value):
    return {"x": value.x, "y": value.y, "z": value.z, "w": value.w}


def main():
    output_path = os.environ.get("KELLY_REFERENCE_POSE_OUTPUT", "").strip()
    if not output_path or not os.path.isabs(output_path):
        raise RuntimeError(
            "KELLY_REFERENCE_POSE_OUTPUT must be an explicit absolute JSON path"
        )

    mesh = unreal.EditorAssetLibrary.load_asset(KELLY_MESH)
    if not mesh or not isinstance(mesh, unreal.SkeletalMesh):
        raise RuntimeError("Missing Kelly skeletal mesh: " + KELLY_MESH)
    skeleton = mesh.get_editor_property("skeleton")
    if not skeleton:
        raise RuntimeError("Kelly mesh has no skeleton")

    reference_pose = skeleton.get_reference_pose()
    available = {str(name) for name in reference_pose.get_bone_names()}
    records = {}
    for bone_name in KEY_BONES:
        if bone_name not in available:
            raise RuntimeError("Kelly reference pose missing bone: " + bone_name)
        transform = reference_pose.get_bone_pose(
            bone_name,
            unreal.AnimPoseSpaces.LOCAL,
        )
        records[bone_name] = {
            "parent": str(mesh.get_bone_parent(bone_name)),
            "translation": vector_dict(transform.translation),
            "rotation": quat_dict(transform.rotation),
            "rotation_euler": vector_dict(transform.rotation.euler()),
            "scale": vector_dict(transform.scale3d),
        }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as output:
        json.dump(records, output, ensure_ascii=False, indent=2)

    unreal.log("[KellyReferencePoseInspect] Saved " + output_path)
    unreal.SystemLibrary.execute_console_command(None, "QUIT_EDITOR")


main()
