import unreal


IK_RIG_DIR = "/Game/LinxiaRig"
IK_RIG_NAME = "IKR_Linxia_Phase"
IK_RIG_PATH = IK_RIG_DIR + "/" + IK_RIG_NAME
PHASE_MESH = "/Game/ParagonPhase/Characters/Heroes/Phase/Meshes/Phase_GDC.Phase_GDC"

CHAINS = [
    ("Spine", "pelvis", "neck_01"),
    ("Head", "neck_01", "head"),
    ("LeftArm", "clavicle_l", "hand_l"),
    ("RightArm", "clavicle_r", "hand_r"),
    ("LeftLeg", "thigh_l", "foot_l"),
    ("RightLeg", "thigh_r", "foot_r"),
]


def log(message):
    unreal.log("[LinxiaPhaseIKRig] " + message)


def main():
    mesh = unreal.EditorAssetLibrary.load_asset(PHASE_MESH)
    if not mesh:
        raise RuntimeError("Missing Phase mesh: " + PHASE_MESH)

    unreal.EditorAssetLibrary.make_directory(IK_RIG_DIR)

    ik_rig = unreal.EditorAssetLibrary.load_asset(IK_RIG_PATH)
    if not ik_rig:
        factory = unreal.IKRigDefinitionFactory()
        if hasattr(factory, "create_new_ik_rig_asset"):
            ik_rig = factory.create_new_ik_rig_asset(IK_RIG_DIR, IK_RIG_NAME)
        else:
            ik_rig = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
                IK_RIG_NAME, IK_RIG_DIR, unreal.IKRigDefinition, factory
            )
    if not ik_rig:
        raise RuntimeError("Unable to create IK Rig asset: " + IK_RIG_PATH)

    controller = unreal.IKRigController.get_controller(ik_rig)
    if not controller:
        raise RuntimeError("Unable to get IK Rig controller")

    if hasattr(controller, "set_skeletal_mesh"):
        controller.set_skeletal_mesh(mesh)
    elif hasattr(ik_rig, "set_editor_property"):
        # UE exposes the preview mesh differently across minor versions.
        for prop in ["preview_skeletal_mesh", "skeletal_mesh", "preview_mesh"]:
            try:
                ik_rig.set_editor_property(prop, mesh)
                break
            except Exception:
                pass

    controller.set_retarget_root("pelvis")
    if hasattr(controller, "set_root_motion_bone"):
        controller.set_root_motion_bone("root")

    existing = {str(chain.chain_name) for chain in controller.get_retarget_chains()}
    for chain_name, start, end in CHAINS:
        if chain_name in existing:
            controller.set_retarget_chain_start_bone(chain_name, start)
            controller.set_retarget_chain_end_bone(chain_name, end)
        else:
            controller.add_retarget_chain(chain_name, start, end, "")

    if hasattr(controller, "apply_auto_generated_retarget_definition"):
        try:
            controller.apply_auto_generated_retarget_definition()
        except Exception as exc:
            log("Auto retarget definition skipped: " + str(exc))

    unreal.EditorAssetLibrary.save_asset(IK_RIG_PATH, only_if_is_dirty=False)
    log("Saved " + IK_RIG_PATH)
    log("retarget_root=" + str(controller.get_retarget_root()))
    for chain in controller.get_retarget_chains():
        log(
            "chain={0} start={1} end={2}".format(
                chain.chain_name,
                controller.get_retarget_chain_start_bone(chain.chain_name),
                controller.get_retarget_chain_end_bone(chain.chain_name),
            )
        )

    unreal.SystemLibrary.execute_console_command(None, "QUIT_EDITOR")


main()
