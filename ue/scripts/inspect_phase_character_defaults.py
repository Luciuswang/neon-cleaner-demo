import unreal


CLASSES = [
    "/Game/ParagonPhase/Characters/Heroes/Phase/PhasePlayerCharacter.PhasePlayerCharacter_C",
    "/Script/NeonCleanerUE.PlayablePhaseCharacter",
]


def log(message):
    unreal.log("[InspectPhaseDefaults] " + message)


for path in CLASSES:
    cls = unreal.load_class(None, path)
    if cls is None:
        log("missing class: " + path)
        continue

    cdo = unreal.get_default_object(cls)
    log("class=" + path)
    for component in cdo.get_components_by_class(unreal.SkeletalMeshComponent):
        mesh = component.get_editor_property("skeletal_mesh")
        rel_loc = component.get_editor_property("relative_location")
        rel_rot = component.get_editor_property("relative_rotation")
        rel_scale = component.get_editor_property("relative_scale3d")
        anim_class = component.get_editor_property("anim_class")
        log(
            "  mesh_comp={} mesh={} rel_loc={} rel_rot={} rel_scale={} anim_class={}".format(
                component.get_name(),
                mesh.get_path_name() if mesh else "<none>",
                rel_loc,
                rel_rot,
                rel_scale,
                anim_class.get_path_name() if anim_class else "<none>",
            )
        )

unreal.SystemLibrary.execute_console_command(None, "QUIT_EDITOR")
