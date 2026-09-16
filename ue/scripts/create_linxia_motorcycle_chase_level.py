"""Generate the chase map. Run only in the integrator's serialized UE session."""

import importlib
from pathlib import Path
import sys

import unreal


LEVEL_PATH = "/Game/LinxiaChase/LVL_Linxia_MotorcycleChase"
MATERIAL_DIR = "/Game/LinxiaChase/Materials"
PAWN_CLASS = "/Script/NeonCleanerUE.LinxiaMotorcyclePawn"
GAMEMODE_CLASS = "/Script/NeonCleanerUE.LinxiaMotorcycleChaseGameMode"
REQUIRED_MATERIAL_KEYS = {
    "road", "puddle", "concrete", "steel", "water", "sky", "rain",
}

# ExecutePythonScript does not consistently put the script directory on sys.path.
SCRIPT_DIR = str(Path(__file__).resolve().parent)
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)
import neon_environment_materials
import neon_environment_city
import neon_cinematic_surfaces

importlib.reload(neon_environment_materials)
importlib.reload(neon_environment_city)
importlib.reload(neon_cinematic_surfaces)


def setup_level():
    pawn_class = unreal.load_class(None, PAWN_CLASS)
    game_mode_class = unreal.load_class(None, GAMEMODE_CLASS)
    if not pawn_class or not game_mode_class:
        raise RuntimeError("Build the chase gameplay classes before generating the map")
    meshes = neon_environment_city.load_meshes()
    # Materials keep their asset identities, preserving other maps' references.
    materials = neon_environment_materials.build_materials(MATERIAL_DIR)
    neon_cinematic_surfaces.apply_surfaces(materials, MATERIAL_DIR, neon_environment_materials.Graph)
    missing_materials = REQUIRED_MATERIAL_KEYS - set(materials)
    if missing_materials:
        raise RuntimeError(
            "Environment material build is incomplete: " + ", ".join(sorted(missing_materials))
        )
    unreal.EditorAssetLibrary.make_directory("/Game/LinxiaChase")
    if unreal.EditorAssetLibrary.does_asset_exist(LEVEL_PATH):
        if not unreal.EditorLevelLibrary.load_level(LEVEL_PATH):
            raise RuntimeError("Cannot load " + LEVEL_PATH)
        for actor in unreal.EditorLevelLibrary.get_all_level_actors():
            if not unreal.EditorLevelLibrary.destroy_actor(actor):
                raise RuntimeError("Cannot clear actor " + actor.get_name())
    elif not unreal.EditorLevelLibrary.new_level(LEVEL_PATH):
        raise RuntimeError("Cannot create " + LEVEL_PATH)

    city = neon_environment_city.City(meshes, materials)
    pawn = city.spawn(pawn_class, "Linxia_MotorcyclePawn", (0, 0, 0))
    pawn.set_editor_property("auto_possess_player", unreal.AutoReceiveInput.PLAYER0)
    city.build()
    world = unreal.EditorLevelLibrary.get_editor_world()
    world.get_world_settings().set_editor_property("default_game_mode", game_mode_class)
    camera = city.camera(
        "Gate3_FirstPlayableFrameCamera",
        (-560, -95, 165),
        (1650, 0, 125),
        70,
    )
    city.camera("Gate3_TargetPreviewCamera", (3050, -450, 260), (4350, 0, 85), 58)
    unreal.EditorLevelLibrary.set_level_viewport_camera_info(
        camera.get_actor_location(), camera.get_actor_rotation()
    )
    unreal.get_editor_subsystem(unreal.EditorActorSubsystem).set_selected_level_actors([pawn])
    # Save only this generation's assets, never every dirty package in the editor.
    for material in materials.values():
        material.set_editor_property("used_with_instanced_static_meshes", True)
        unreal.MaterialEditingLibrary.recompile_material(material)
        if not unreal.EditorAssetLibrary.save_loaded_asset(material):
            raise RuntimeError("Cannot save material " + material.get_path_name())
    if not unreal.EditorLevelLibrary.save_current_level():
        raise RuntimeError("Cannot save generated chase map")
    unreal.log("[LinxiaMotorcycleChaseLevel] Saved playable motorcycle chase level: " + LEVEL_PATH)
    unreal.log("[NeonEnvironment] Generation complete; rendered visual QA is still required")


if __name__ == "__main__":
    setup_level()
