import os
import unreal


REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SOURCE_OBJ = os.path.join(
    REPO_ROOT,
    "web",
    "models",
    "player-motorcycle-obj",
    "model_1781781224363_obj.obj",
)
DESTINATION_PATH = "/Game/LinxiaChase/Imported"
DESTINATION_NAME = "SM_PlayerMotorcycle"


def log(message):
    unreal.log("[PlayerMotorcycleImport] " + message)


def main():
    if not os.path.exists(SOURCE_OBJ):
        raise RuntimeError("Missing motorcycle OBJ: " + SOURCE_OBJ)

    unreal.EditorAssetLibrary.make_directory(DESTINATION_PATH)

    existing = f"{DESTINATION_PATH}/{DESTINATION_NAME}.{DESTINATION_NAME}"
    if unreal.EditorAssetLibrary.does_asset_exist(existing):
        unreal.EditorAssetLibrary.delete_asset(existing)

    task = unreal.AssetImportTask()
    task.set_editor_property("filename", SOURCE_OBJ)
    task.set_editor_property("destination_path", DESTINATION_PATH)
    task.set_editor_property("destination_name", DESTINATION_NAME)
    task.set_editor_property("automated", True)
    task.set_editor_property("replace_existing", True)
    task.set_editor_property("save", True)

    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])

    imported_paths = [str(path) for path in task.get_editor_property("imported_object_paths")]
    log("Imported paths: " + ", ".join(imported_paths))
    mesh = unreal.EditorAssetLibrary.load_asset(existing)
    if not mesh:
        raise RuntimeError("Import did not create expected mesh: " + existing)

    unreal.EditorAssetLibrary.save_asset(existing)
    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    log("Imported player motorcycle static mesh: " + mesh.get_path_name())
    unreal.SystemLibrary.execute_console_command(None, "QUIT_EDITOR")


main()
