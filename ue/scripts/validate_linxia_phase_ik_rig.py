import unreal


IK_RIG_PATH = "/Game/LinxiaRig/IKR_Linxia_Phase.IKR_Linxia_Phase"
EXPECTED_ROOT = "pelvis"
EXPECTED_CHAINS = {
    "LeftArm": ("upperarm_l", "hand_l"),
    "RightArm": ("upperarm_r", "hand_r"),
    "LeftLeg": ("thigh_l", "foot_l"),
    "RightLeg": ("thigh_r", "foot_r"),
}


def log(message):
    unreal.log("[LinxiaPhaseIKRigValidate] " + message)


def main():
    ik_rig = unreal.EditorAssetLibrary.load_asset(IK_RIG_PATH)
    if not ik_rig:
        raise RuntimeError("Missing IK Rig asset: " + IK_RIG_PATH)

    controller = unreal.IKRigController.get_controller(ik_rig)
    if not controller:
        raise RuntimeError("Missing IK Rig controller")

    root = str(controller.get_retarget_root())
    if root != EXPECTED_ROOT:
        raise RuntimeError(f"Unexpected retarget root: {root}")

    available = {str(chain.chain_name) for chain in controller.get_retarget_chains()}
    for name, (start, end) in EXPECTED_CHAINS.items():
        if name not in available:
            raise RuntimeError("Missing retarget chain: " + name)
        actual_start = str(controller.get_retarget_chain_start_bone(name))
        actual_end = str(controller.get_retarget_chain_end_bone(name))
        if actual_start != start or actual_end != end:
            raise RuntimeError(
                f"Unexpected chain {name}: start={actual_start} end={actual_end}"
            )

    log("Validation passed")
    log("retarget_root=" + root)
    log("chains=" + ",".join(sorted(available)))
    unreal.SystemLibrary.execute_console_command(None, "QUIT_EDITOR")


main()
