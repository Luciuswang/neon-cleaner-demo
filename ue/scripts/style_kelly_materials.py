import os

import unreal


DEBUG_COLORS = {
    "hhh_xin_body_sss1": (1.0, 0.15, 0.55),
    "hhh_xin_Surface14": (0.1, 1.0, 0.15),
    "lambert1": (0.12, 0.12, 0.12),
    "lambert29": (1.0, 0.25, 0.02),
    "xin_eye4": (0.0, 0.8, 0.8),
    "xin_eye5": (0.55, 0.05, 1.0),
    "xin_meimao2": (0.01, 0.01, 0.01),
    "xin_Surface12": (0.0, 0.8, 1.0),
    "xin_Surface13": (1.0, 0.02, 0.02),
    "xin_Surface14": (1.0, 0.0, 0.8),
    "xin_Surface15": (0.02, 0.1, 1.0),
    "xin_Surface16": (1.0, 0.9, 0.0),
    "xin__EYE2": (0.9, 0.9, 0.9),
}

FINAL_COLORS = {
    "hhh_xin_body_sss1": (0.56, 0.24, 0.15),
    "hhh_xin_Surface14": (0.92, 0.56, 0.01),
    "lambert1": (0.045, 0.05, 0.055),
    "lambert29": (0.008, 0.004, 0.003),
    "xin_eye4": (0.035, 0.018, 0.008),
    "xin_eye5": (0.035, 0.018, 0.008),
    "xin_meimao2": (0.012, 0.006, 0.004),
    "xin_Surface12": (0.92, 0.56, 0.01),
    "xin_Surface13": (0.92, 0.68, 0.015),
    "xin_Surface14": (0.012, 0.012, 0.014),
    "xin_Surface15": (0.92, 0.68, 0.015),
    "xin_Surface16": (0.48, 0.5, 0.52),
    "xin__EYE2": (0.82, 0.82, 0.78),
}


def log(message):
    unreal.log("[KellyMaterialStyle] " + message)


def main():
    palette_name = os.environ.get("KELLY_MATERIAL_PALETTE", "final").strip().lower()
    if palette_name == "debug":
        palette = DEBUG_COLORS
    elif palette_name == "final":
        palette = FINAL_COLORS
    else:
        raise RuntimeError("Unknown KELLY_MATERIAL_PALETTE: " + palette_name)

    for name, rgb in palette.items():
        path = "/Game/KellySource/{0}.{0}".format(name)
        material = unreal.EditorAssetLibrary.load_asset(path)
        if material is None or not isinstance(material, unreal.MaterialInstanceConstant):
            raise RuntimeError("Missing Kelly material instance: " + path)

        color = unreal.LinearColor(rgb[0], rgb[1], rgb[2], 1.0)
        unreal.MaterialEditingLibrary.set_material_instance_vector_parameter_value(
            material,
            "DiffuseColor",
            color,
        )
        unreal.MaterialEditingLibrary.set_material_instance_vector_parameter_value(
            material,
            "AmbientColor",
            unreal.LinearColor(rgb[0] * 0.12, rgb[1] * 0.12, rgb[2] * 0.12, 1.0),
        )
        unreal.MaterialEditingLibrary.set_material_instance_scalar_parameter_value(
            material,
            "Opacity",
            1.0,
        )
        unreal.MaterialEditingLibrary.set_material_instance_scalar_parameter_value(
            material,
            "Shininess",
            10.0 if "eye" not in name.lower() else 45.0,
        )
        unreal.EditorAssetLibrary.save_loaded_asset(material, only_if_is_dirty=False)
        log("{}={}".format(name, rgb))

    log("Applied {} palette".format(palette_name))


main()
