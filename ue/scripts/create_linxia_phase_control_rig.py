import unreal


RIG_DIR = "/Game/LinxiaRig"
RIG_NAME = "CR_Linxia_Phase"
RIG_PATH = RIG_DIR + "/" + RIG_NAME
PHASE_MESH = "/Game/ParagonPhase/Characters/Heroes/Phase/Meshes/Phase_GDC.Phase_GDC"


def log(message):
    unreal.log("[LinxiaPhaseControlRig] " + message)


def main():
    mesh = unreal.EditorAssetLibrary.load_asset(PHASE_MESH)
    if not mesh:
        raise RuntimeError("Missing Phase mesh: " + PHASE_MESH)

    unreal.EditorAssetLibrary.make_directory(RIG_DIR)

    control_rig = unreal.EditorAssetLibrary.load_asset(RIG_PATH)
    if not control_rig:
        control_rig = unreal.ControlRigBlueprintFactory.create_control_rig_from_skeletal_mesh_or_skeleton(
            mesh, False
        )
        if not control_rig:
            raise RuntimeError("Unable to create Control Rig from Phase mesh")

        current_path = control_rig.get_path_name().split(".")[0]
        if current_path != RIG_PATH:
            if unreal.EditorAssetLibrary.does_asset_exist(RIG_PATH):
                unreal.EditorAssetLibrary.delete_asset(RIG_PATH)
            if not unreal.EditorAssetLibrary.rename_asset(current_path, RIG_PATH):
                raise RuntimeError(f"Unable to move Control Rig from {current_path} to {RIG_PATH}")

        control_rig = unreal.EditorAssetLibrary.load_asset(RIG_PATH)

    if hasattr(control_rig, "set_preview_mesh"):
        control_rig.set_preview_mesh(mesh, True)

    rig = control_rig.create_control_rig()
    if not rig:
        raise RuntimeError("Unable to instantiate Control Rig")

    hierarchy = control_rig.get_hierarchy()
    required_bones = [
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
    missing = []
    for bone_name in required_bones:
        key = unreal.RigElementKey(name=bone_name, type=unreal.RigElementType.BONE)
        if not hierarchy.contains(key):
            missing.append(bone_name)
    if missing:
        raise RuntimeError("Control Rig missing Phase bones: " + ", ".join(missing))

    unreal.EditorAssetLibrary.save_asset(RIG_PATH, only_if_is_dirty=False)
    log("Saved " + RIG_PATH)
    log("preview_mesh=" + control_rig.get_preview_mesh().get_path_name())
    log("required_bones_present=" + ",".join(required_bones))
    unreal.SystemLibrary.execute_console_command(None, "QUIT_EDITOR")


main()
