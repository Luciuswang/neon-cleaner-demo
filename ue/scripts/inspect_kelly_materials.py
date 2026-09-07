import unreal


MATERIAL_NAMES = (
    "hhh_xin_body_sss1",
    "hhh_xin_Surface14",
    "lambert1",
    "lambert29",
    "xin_eye4",
    "xin_eye5",
    "xin_meimao2",
    "xin_Surface12",
    "xin_Surface13",
    "xin_Surface14",
    "xin_Surface15",
    "xin_Surface16",
    "xin__EYE2",
)


def log(message):
    unreal.log("[KellyMaterialInspect] " + message)


def safe_get(obj, name):
    try:
        return obj.get_editor_property(name)
    except Exception as exc:
        return "<unavailable: {}>".format(exc)


def main():
    for name in MATERIAL_NAMES:
        path = "/Game/KellySource/{0}.{0}".format(name)
        material = unreal.EditorAssetLibrary.load_asset(path)
        if material is None:
            raise RuntimeError("Missing Kelly material: " + path)

        log("{} class={}".format(path, material.get_class().get_name()))
        parent = safe_get(material, "parent")
        if parent and not isinstance(parent, str):
            log("  parent={}".format(parent.get_path_name()))

        for parameter in unreal.MaterialEditingLibrary.get_vector_parameter_names(material):
            value = unreal.MaterialEditingLibrary.get_material_instance_vector_parameter_value(
                material,
                parameter,
            )
            log("  vector {}={}".format(parameter, value))
        for parameter in unreal.MaterialEditingLibrary.get_scalar_parameter_names(material):
            value = unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(
                material,
                parameter,
            )
            log("  scalar {}={}".format(parameter, value))
        for parameter in unreal.MaterialEditingLibrary.get_texture_parameter_names(material):
            value = unreal.MaterialEditingLibrary.get_material_instance_texture_parameter_value(
                material,
                parameter,
            )
            log(
                "  texture {}={}".format(
                    parameter,
                    value.get_path_name() if value else "None",
                )
            )

    log("Inspection passed")


main()
