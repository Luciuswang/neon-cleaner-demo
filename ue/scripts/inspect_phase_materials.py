import unreal


MESH = "/Game/ParagonPhase/Characters/Heroes/Phase/Meshes/Phase_GDC.Phase_GDC"
MATERIALS = [
    "/Game/ParagonPhase/Characters/Heroes/Phase/Materials/M_Phase_hair.M_Phase_hair",
    "/Game/ParagonPhase/Characters/Heroes/Phase/Materials/M_Phase_hair_short.M_Phase_hair_short",
]


def log(message):
    unreal.log("[InspectPhaseMaterials] " + message)


def safe_get(obj, name):
    try:
        return obj.get_editor_property(name)
    except Exception as exc:
        return "<unavailable: {}>".format(exc)


def describe_material_interface(material, indent=""):
    log(indent + "material=" + material.get_path_name() + " class=" + material.get_class().get_name())
    parent = safe_get(material, "parent")
    if parent and not isinstance(parent, str):
        log(indent + "  parent=" + parent.get_path_name() + " class=" + parent.get_class().get_name())
    for prop in [
        "blend_mode",
        "shading_model",
        "shading_models",
        "two_sided",
        "dithered_lod_transition",
        "use_material_attributes",
        "used_with_skeletal_mesh",
        "tangent_space_normal",
        "fully_rough",
    ]:
        log(indent + "  {}={}".format(prop, safe_get(material, prop)))

    try:
        scalar_params = unreal.MaterialEditingLibrary.get_scalar_parameter_names(material)
        for param in scalar_params:
            value = unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(material, param)
            log(indent + "  scalar {}={}".format(param, value))
    except Exception as exc:
        log(indent + "  scalar_params=<unavailable: {}>".format(exc))

    try:
        vector_params = unreal.MaterialEditingLibrary.get_vector_parameter_names(material)
        for param in vector_params:
            value = unreal.MaterialEditingLibrary.get_material_instance_vector_parameter_value(material, param)
            log(indent + "  vector {}={}".format(param, value))
    except Exception as exc:
        log(indent + "  vector_params=<unavailable: {}>".format(exc))

    if parent and not isinstance(parent, str):
        describe_material_interface(parent, indent + "    ")


mesh = unreal.EditorAssetLibrary.load_asset(MESH)
if mesh is None:
    raise RuntimeError("Mesh not found: " + MESH)

materials = mesh.get_editor_property("materials")
log("Mesh material slot count: {}".format(len(materials)))
for index, slot in enumerate(materials):
    material = slot.get_editor_property("material_interface")
    slot_name = slot.get_editor_property("material_slot_name")
    material_path = material.get_path_name() if material else "<none>"
    log("slot[{}] {} -> {}".format(index, slot_name, material_path))

for path in MATERIALS:
    material = unreal.EditorAssetLibrary.load_asset(path)
    if material is None:
        log("missing material: " + path)
        continue

    describe_material_interface(material)

unreal.SystemLibrary.execute_console_command(None, "QUIT_EDITOR")
