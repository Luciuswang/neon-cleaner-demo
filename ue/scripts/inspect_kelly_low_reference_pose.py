import json
import os

import unreal


KELLY_MESH = "/Game/KellyLowSource/asda.asda"
KEY_BONES = (
    "bone_Root",
    "Bip01",
    "bone_Hips",
    "bone_Spine",
    "bone_Spine1",
    "bone_Neck",
    "bone_Head",
    "bone_LeftClav",
    "bone_LeftArm",
    "bone_LeftForeArm",
    "bone_LeftHand",
    "bone_RightClav",
    "bone_RightArm",
    "bone_RightForeArm",
    "bone_RightHand",
    "bone_LeftLegUpper",
    "bone_LeftLeg",
    "bone_LeftAnkle",
    "bone_LeftToe",
    "bone_RightLegUpper",
    "bone_RightLeg",
    "bone_RightAnkle",
    "bone_RightToe",
)


def vector_dict(value):
    return {"x": value.x, "y": value.y, "z": value.z}


def quat_dict(value):
    return {"x": value.x, "y": value.y, "z": value.z, "w": value.w}


def transform_dict(value):
    return {
        "translation": vector_dict(value.translation),
        "rotation": quat_dict(value.rotation),
        "rotation_euler": vector_dict(value.rotation.euler()),
        "scale": vector_dict(value.scale3d),
    }


def main():
    output_path = os.environ.get("KELLY_LOW_REFERENCE_POSE_OUTPUT", "").strip()
    if not output_path or not os.path.isabs(output_path):
        raise RuntimeError(
            "KELLY_LOW_REFERENCE_POSE_OUTPUT must be an explicit absolute JSON path"
        )

    mesh = unreal.EditorAssetLibrary.load_asset(KELLY_MESH)
    if not mesh or not isinstance(mesh, unreal.SkeletalMesh):
        raise RuntimeError("Missing low Kelly skeletal mesh: " + KELLY_MESH)
    skeleton = mesh.get_editor_property("skeleton")
    reference_pose = skeleton.get_reference_pose()
    available = {str(name) for name in reference_pose.get_bone_names()}
    records = {}
    for bone_name in KEY_BONES:
        if bone_name not in available:
            raise RuntimeError("Low Kelly reference pose missing bone: " + bone_name)
        records[bone_name] = {
            "parent": str(mesh.get_bone_parent(bone_name)),
            "local": transform_dict(
                reference_pose.get_bone_pose(bone_name, unreal.AnimPoseSpaces.LOCAL)
            ),
            "world": transform_dict(
                reference_pose.get_bone_pose(bone_name, unreal.AnimPoseSpaces.WORLD)
            ),
        }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as output:
        json.dump(records, output, ensure_ascii=False, indent=2)

    unreal.log("[KellyLowReferencePoseInspect] Saved " + output_path)


main()
