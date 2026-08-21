import unreal


HAIR_MATERIALS = [
    "/Game/ParagonPhase/Characters/Heroes/Phase/Materials/M_Phase_hair.M_Phase_hair",
    "/Game/ParagonPhase/Characters/Heroes/Phase/Materials/M_Phase_hair_short.M_Phase_hair_short",
]

SCALARS = {
    "Scatter": 0.35,
    "LowQualityScatter": 0.05,
    "Specular": 0.55,
    "Roughness": 0.42,
    "DyeScatter": 0.08,
    "BrightnessAdjust": 0.95,
    "Brightness": 0.10,
    "IriMask": 0.0,
    "DyeMaskHairGlow_Intensity": 0.0,
    "HairEmissiveBrightness": 0.0,
}


def log(message):
    unreal.log("[TunePhaseHair] " + message)


for path in HAIR_MATERIALS:
    material = unreal.EditorAssetLibrary.load_asset(path)
    if material is None:
        raise RuntimeError("Hair material not found: " + path)

    for name, value in SCALARS.items():
        unreal.MaterialEditingLibrary.set_material_instance_scalar_parameter_value(material, name, value)
        log("{} {}={}".format(material.get_name(), name, value))

    unreal.EditorAssetLibrary.save_loaded_asset(material)
    log("Saved " + material.get_path_name())

unreal.SystemLibrary.execute_console_command(None, "QUIT_EDITOR")
