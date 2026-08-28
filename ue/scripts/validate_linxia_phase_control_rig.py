import unreal


RIG_PATH = "/Game/LinxiaRig/CR_Linxia_Phase.CR_Linxia_Phase"
EXPECTED_PREVIEW_MESH = "/Game/ParagonPhase/Characters/Heroes/Phase/Meshes/Phase_GDC.Phase_GDC"
REQUIRED_BONES = [
    "pelvis",
    "spine_01",
    "spine_03",
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
    "head",
]


def log(message):
    unreal.log("[LinxiaPhaseControlRigValidate] " + message)


def main():
    control_rig = unreal.EditorAssetLibrary.load_asset(RIG_PATH)
    if not control_rig:
        raise RuntimeError("Missing Control Rig asset: " + RIG_PATH)

    preview_mesh = control_rig.get_preview_mesh()
    if not preview_mesh:
        raise RuntimeError("Control Rig has no preview mesh")
    if preview_mesh.get_path_name() != EXPECTED_PREVIEW_MESH:
        raise RuntimeError("Unexpected preview mesh: " + preview_mesh.get_path_name())

    rig = control_rig.create_control_rig()
    if not rig:
        raise RuntimeError("Unable to instantiate Control Rig")

    hierarchy = control_rig.get_hierarchy()
    missing = []
    for bone_name in REQUIRED_BONES:
        key = unreal.RigElementKey(name=bone_name, type=unreal.RigElementType.BONE)
        if not hierarchy.contains(key):
            missing.append(bone_name)
    if missing:
        raise RuntimeError("Missing required bones: " + ", ".join(missing))

    log("Validation passed")
    log("preview_mesh=" + preview_mesh.get_path_name())
    log("required_bones=" + ",".join(REQUIRED_BONES))
    unreal.SystemLibrary.execute_console_command(None, "QUIT_EDITOR")


main()
