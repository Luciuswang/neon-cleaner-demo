"""Export a private MetaHuman body fitting reference without editing the source.

Run inside the full UE Editor, serialized with other MetaHuman work. Uses the
geometry export API, not DCC export: facial rigging/high-resolution textures are
not prerequisites for this body-only route. This is NOT a runtime assembly.

Optional NEON_METAHUMAN_SOURCE overrides the default source asset. Every run
creates a unique folder in the LOADED project's Content/MetaHumanWorkspace/
FittingScratch (including isolated work projects), and writes FBX/manifest under
the repository's ignored .local/metahuman-fitting. No overwrite,
delete, source save, save-all, rig request, texture request, or editor shutdown.
"""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import uuid

import unreal


ROOT = Path(__file__).resolve().parents[3]
PROJECT = Path(unreal.Paths.project_dir()).resolve()
SOURCE = os.environ.get(
    "NEON_METAHUMAN_SOURCE",
    "/Game/MetaHumanWorkspace/Characters/Heroine_MetaHuman",
).strip().split(".", 1)[0]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def package_file(package_path):
    if not package_path.startswith("/Game/") or ".." in package_path:
        raise RuntimeError("Only project /Game assets are supported")
    content = (PROJECT / "Content").resolve()
    result = (content / (package_path[len("/Game/"):] + ".uasset")).resolve()
    result.relative_to(content)
    return result


def main():
    source_file = package_file(SOURCE)
    if not source_file.is_file():
        raise RuntimeError("Source must already exist on disk: " + str(source_file))
    source_hash = digest(source_file)
    source = unreal.load_asset(SOURCE)
    if not isinstance(source, unreal.MetaHumanCharacter):
        raise RuntimeError("Source is not a MetaHumanCharacter: " + SOURCE)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "_" + uuid.uuid4().hex[:8]
    scratch = "/Game/MetaHumanWorkspace/FittingScratch/" + stamp
    output = ROOT / ".local/metahuman-fitting" / stamp
    output.mkdir(parents=True, exist_ok=False)
    if unreal.EditorAssetLibrary.does_directory_exist(scratch):
        raise RuntimeError("Unexpected scratch collision: " + scratch)
    unreal.EditorAssetLibrary.make_directory(scratch)

    subsystem = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
    if subsystem is None:
        raise RuntimeError("MetaHuman editor subsystem unavailable; use the full Editor")
    original_was_open = subsystem.is_object_added_for_editing(source)
    clone_path = scratch + "/" + source.get_name() + "_FittingCopy"
    clone = None
    opened_clone = False
    manifest = {
        "schema": 1,
        "purpose": "private garment fitting reference; not runtime/rig/appearance acceptance",
        "source_asset": SOURCE,
        "loaded_project_directory": str(PROJECT),
        "source_uasset": str(source_file),
        "source_sha256_before": source_hash,
        "source_was_open_for_editing": original_was_open,
        "scratch_package_root": scratch,
        "status": "INCOMPLETE",
        "caveats": [
            "Body geometry uses duplicated character asset state; live uncommitted editor adjustments require a separate comparison.",
            "Topology diagnostic materials replace appearance; no production textures, garments, groom, or facial rig are exported.",
            "Pre-rig fitting geometry and weights require validation against the final assembled body before garment binding.",
            "Skeletal mesh references can include engine/plugin assets; FBX is the standalone fitting interchange artifact.",
        ],
    }
    try:
        # TryAddObjectToEdit can synthesize textures/migrate state. Never call it
        # on the original, even if the intended operation only exports geometry.
        clone = unreal.EditorAssetLibrary.duplicate_loaded_asset(source, clone_path)
        if not isinstance(clone, unreal.MetaHumanCharacter):
            raise RuntimeError("Failed to duplicate the source into private scratch")
        opened_clone = subsystem.try_add_object_to_edit(clone)
        if not opened_clone:
            raise RuntimeError("Could not create editing data for the scratch character")

        params = unreal.MetaHumanGeometryExportParams()
        params.project_path = scratch
        params.head_skeletal_mesh = False
        params.body_skeletal_mesh = True
        params.full_body_skeletal_mesh = False
        params.overwrite_existing_assets = False
        # This native function returns void even on failure. Validate actual
        # outputs instead of treating lack of a Python exception as success.
        unreal.MetaHumanCharacterExportBlueprintLibrary.export_geometry(clone, params)
        body_path = scratch + "/" + clone.get_name() + "_Body"
        body = unreal.load_asset(body_path)
        if not isinstance(body, unreal.SkeletalMesh):
            raise RuntimeError("Geometry export did not create the expected body: " + body_path)
        skeleton = body.get_editor_property("skeleton")
        if skeleton is None:
            raise RuntimeError("Exported fitting body has no skeleton")
        bones = [str(name) for name in skeleton.get_reference_pose().get_bone_names()]
        if not bones:
            raise RuntimeError("Exported skeleton contains no reference bones")

        # Force save only these newly created scratch packages. Never save-all.
        for asset in (clone, body):
            if not unreal.EditorAssetLibrary.save_loaded_asset(asset, only_if_is_dirty=False):
                raise RuntimeError("Failed to persist scratch asset: " + asset.get_path_name())

        fbx_path = output / "body-fitting.fbx"
        options = unreal.FbxExportOption()
        options.set_editor_property("ascii", False)
        options.set_editor_property("level_of_detail", False)
        options.set_editor_property("collision", False)
        options.set_editor_property("export_morph_targets", False)
        task = unreal.AssetExportTask()
        task.object = body
        task.exporter = unreal.SkeletalMeshExporterFBX()
        task.filename = str(fbx_path)
        task.automated = True
        task.prompt = False
        task.selected = False
        task.replace_identical = False
        task.options = options
        if not unreal.Exporter.run_asset_export_task(task):
            raise RuntimeError("Skeletal FBX export failed: " + str(task.errors))
        if not fbx_path.is_file() or fbx_path.stat().st_size < 1024:
            raise RuntimeError("FBX exporter did not produce a nonempty file")
        with fbx_path.open("rb") as stream:
            if not stream.read(32).startswith(b"Kaydara FBX Binary"):
                raise RuntimeError("Output is not the requested binary FBX")
        body_file = package_file(body_path)
        if not body_file.is_file():
            raise RuntimeError("Body package did not persist to disk")
        manifest.update({
            "status": "EXPORTED_NOT_DCC_VALIDATED",
            "body_asset": body.get_path_name(),
            "body_uasset": str(body_file),
            "body_uasset_sha256": digest(body_file),
            "skeleton": skeleton.get_path_name(),
            "reference_bone_count": len(bones),
            "reference_bones": bones,
            "fbx": str(fbx_path),
            "fbx_bytes": fbx_path.stat().st_size,
            "fbx_sha256": digest(fbx_path),
            "lods_exported": "LOD0 only",
        })
    except Exception as exc:
        manifest["error"] = str(exc)
        raise
    finally:
        # Remove only editing state owned by this run, not the user's open editor.
        try:
            if opened_clone and subsystem.is_object_added_for_editing(clone):
                subsystem.remove_object_to_edit(clone)
        finally:
            after = digest(source_file)
            manifest["source_sha256_after"] = after
            manifest["source_disk_unchanged"] = after == source_hash
            (output / "manifest.json").write_text(
                json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
            )
            if after != source_hash:
                raise RuntimeError("Source package changed during export; inspect manifest, do not promote this result")

    unreal.log("[MetaHumanBodyFitting] EXPORTED sourceUnchanged=True manifest=" + str(output / "manifest.json"))


main()
