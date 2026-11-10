"""Read-only UE skeletal reference snapshot; optionally compare a prior snapshot.

Run only when the orchestrator owns the isolated UE session. This script never
opens Creator editing state, imports, assembles, changes assets, saves, or quits.
GeometryScripting and SkeletalMeshModifiers must already be loaded; no plugins
are enabled automatically.

Required env: NEON_BODY_REFERENCE_ASSET (/Game/... SkeletalMesh),
NEON_BODY_REFERENCE_OUTPUT (new absolute JSON path, existing parent directory).
Optional: NEON_BODY_REFERENCE_BASELINE (previous JSON snapshot),
NEON_BODY_REFERENCE_FBX (original FBX provenance, hashed but NOT parsed),
NEON_BODY_REFERENCE_CHARACTER_FILE (saved character .uasset provenance).

Capture the old fitting mesh in its project first, then the assembled/new body
with BASELINE pointing to that JSON. An FBX-only baseline needs a separately
authorized scratch import; this script deliberately cannot perform that import.
Use the unoccluded full body for shape comparison: assembled clothing may strip
hidden body geometry. Changed topology makes indexed position comparison
INCOMPARABLE rather than a guessed nearest-vertex match.

UE 5.8 source: SkeletonModifier::SetSkeletalMesh clones MeshDescription and copies
the mesh's GetRefSkeleton() into the transient reader. Only getters are used;
CommitSkeletonToSkeletalMesh and all bone mutations are forbidden. GeometryScript
RenderData conversion does not expose bone attributes under null RHI because its
skin-weight-buffer IsInitialized check gates the entire bone-attribute copy.
Prepared from source; Python bindings still require actual isolated UE execution.
"""
import hashlib
import json
import math
import os
from pathlib import Path


SCHEMA = 1
POSITION_TOLERANCE_CM = 0.001
ANGLE_TOLERANCE_DEG = 0.001
SCALE_TOLERANCE = 0.000001


def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def absolute_file(value, must_exist=True):
    path = Path(value)
    if not path.is_absolute():
        raise ValueError("Absolute path required: " + value)
    path = path.resolve()
    if must_exist and not path.is_file():
        raise FileNotFoundError(path)
    return path


def vector(value):
    return [float(value.x), float(value.y), float(value.z)]


def transform(value):
    q = value.rotation
    result = {"translation": vector(value.translation),
              "rotation_xyzw": [float(q.x), float(q.y), float(q.z), float(q.w)],
              "scale": vector(value.scale3d)}
    if not all(math.isfinite(x) for values in result.values() for x in values):
        raise ValueError("Nonfinite per-mesh reference transform")
    return result


def distance(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def angle(a, b):
    norm = math.sqrt(sum(x*x for x in a) * sum(x*x for x in b))
    if norm < 1e-15:
        raise ValueError("Invalid reference quaternion")
    cosine = min(1.0, abs(sum(x*y for x, y in zip(a, b))) / norm)
    return math.degrees(2 * math.acos(cosine))


def compare(previous, current):
    if previous.get("schema") != SCHEMA or previous.get("status") != "CAPTURED":
        raise ValueError("Baseline must be a completed schema-1 capture")
    a, b = previous["bones"], current["bones"]
    removed, added = sorted(set(a)-set(b)), sorted(set(b)-set(a))
    parent_changes, deltas = [], []
    for name in sorted(set(a) & set(b)):
        if a[name]["parent"] != b[name]["parent"]:
            parent_changes.append(name)
        row = {"bone": name}
        for space in ("local", "component"):
            left, right = a[name][space], b[name][space]
            row[space + "_position_cm"] = distance(left["translation"], right["translation"])
            row[space + "_angle_deg"] = angle(left["rotation_xyzw"], right["rotation_xyzw"])
            row[space + "_scale_delta"] = max(abs(x-y) for x, y in zip(left["scale"], right["scale"]))
        deltas.append(row)
    changed = [row for row in deltas if any(
        row[space + "_position_cm"] > POSITION_TOLERANCE_CM or
        row[space + "_angle_deg"] > ANGLE_TOLERANCE_DEG or
        row[space + "_scale_delta"] > SCALE_TOLERANCE
        for space in ("local", "component"))]
    p, q = previous["geometry"], current["geometry"]
    topology_equal = (p["vertex_count"] == q["vertex_count"] and
                      p["topology_sha256"] == q["topology_sha256"] and
                      previous["sampling"] == current["sampling"])
    geometry = {"status": "INCOMPARABLE_TOPOLOGY_OR_SAMPLING", "topology_equal": topology_equal}
    if topology_equal:
        errors = [distance(x, y) for x, y in zip(p["positions_cm"], q["positions_cm"])]
        geometry.update(status="COMPARED_BY_VERTEX_INDEX", max_delta_cm=max(errors),
                        rms_delta_cm=math.sqrt(sum(x*x for x in errors)/len(errors)),
                        vertices_over_tolerance=sum(x > POSITION_TOLERANCE_CM for x in errors))
    equivalent = (not removed and not added and not parent_changes and not changed and
                  topology_equal and geometry["vertices_over_tolerance"] == 0)
    return {"status": "NUMERIC_EQUIVALENT_ONLY" if equivalent else "REVIEW_REQUIRED",
            "removed_bones": removed, "added_bones": added,
            "parent_changes": parent_changes, "changed_reference_bones": changed,
            "all_bone_deltas": deltas, "geometry": geometry,
            "tolerances": {"position_cm": POSITION_TOLERANCE_CM,
                           "angle_deg": ANGLE_TOLERANCE_DEG, "scale": SCALE_TOLERANCE},
            "garment_fit_and_animation_acceptance": "NOT_ASSESSED"}


def per_mesh_reference_bones(mesh, unreal):
    """Read the mesh's own reference skeleton from a private, uncommitted copy.

    SetSkeletalMesh's name refers to binding the transient reader to an input;
    source confirms it does not modify/commit the input SkeletalMesh. It requires
    editor MeshDescription data. Never use a shared Skeleton fallback if absent.
    """
    reader = unreal.SkeletonModifier()
    if not reader.set_skeletal_mesh(mesh):
        raise RuntimeError("Cannot initialize per-mesh reference reader; editor MeshDescription required")
    bone_names = reader.get_all_bone_names()
    names = [str(name) for name in bone_names]
    if not names or len(names) != len(set(names)):
        raise ValueError("Missing or duplicate per-mesh reference bones")
    bones = {}
    for index, name in enumerate(bone_names):
        parent = str(reader.get_parent_name(name))
        if parent == "None":
            parent = None
        elif parent not in names:
            raise ValueError("Reference parent absent from mesh: " + parent)
        bones[str(name)] = {
            "index": index, "parent": parent,
            "local": transform(reader.get_bone_transform(name, False)),
            "component": transform(reader.get_bone_transform(name, True)),
        }
    return bones


def capture(asset_path):
    import unreal
    required = ("GeometryScript_AssetUtils", "GeometryScript_MeshQueries",
                "GeometryScript_List", "DynamicMesh", "SkeletonModifier")
    missing = [name for name in required if not hasattr(unreal, name)]
    if missing:
        raise RuntimeError("GeometryScripting/SkeletalMeshModifiers APIs unavailable: " + ", ".join(missing))
    mesh = unreal.load_asset(asset_path)
    if not isinstance(mesh, unreal.SkeletalMesh):
        raise TypeError("Input must be an existing SkeletalMesh, not a MetaHumanCharacter")
    package = mesh.get_path_name().split(".", 1)[0]
    if not package.startswith("/Game/") or ".." in package:
        raise ValueError("Capture requires a project /Game skeletal mesh")
    project = Path(unreal.Paths.project_dir()).resolve()
    disk = (project / "Content" / (package[6:] + ".uasset")).resolve()
    disk.relative_to(project / "Content")
    before_hash = sha256(disk)
    options = unreal.GeometryScriptCopyMeshFromAssetOptions()
    options.apply_build_settings = False
    options.use_build_scale = False
    options.request_tangents = False
    lod = unreal.GeometryScriptMeshReadLOD()
    lod.lod_type = unreal.GeometryScriptLODType.RENDER_DATA
    lod.lod_index = 0
    dynamic, outcome = unreal.GeometryScript_AssetUtils.copy_mesh_from_skeletal_mesh(
        mesh, unreal.DynamicMesh(), options, lod)
    if outcome != unreal.GeometryScriptOutcomePins.SUCCESS:
        raise RuntimeError("Could not copy explicit render-data LOD0")
    queries = unreal.GeometryScript_MeshQueries
    _, positions_list, vertex_gaps = queries.get_all_vertex_positions(dynamic, False)
    _, triangle_list, triangle_gaps = queries.get_all_triangle_indices(dynamic, False)
    if vertex_gaps or triangle_gaps:
        raise RuntimeError("Dynamic mesh ID gaps prevent unambiguous indexed comparison")
    positions = [vector(p) for p in unreal.GeometryScript_List.convert_vector_list_to_array(positions_list)]
    triangles = [[int(t.x), int(t.y), int(t.z)] for t in
                 unreal.GeometryScript_List.convert_triangle_list_to_array(triangle_list)]
    if not positions or not triangles or not all(math.isfinite(x) for p in positions for x in p):
        raise ValueError("Missing/nonfinite geometry")
    bones = per_mesh_reference_bones(mesh, unreal)
    after_hash = sha256(disk)
    if before_hash != after_hash:
        raise RuntimeError("Source mesh file changed during read; discard capture")
    return {"schema": SCHEMA, "status": "CAPTURED", "asset": mesh.get_path_name(),
            "project": str(project), "source_file": str(disk), "source_sha256": before_hash,
            "source_disk_unchanged": True,
            "reference_bone_reader": "SkeletonModifier_private_GetRefSkeleton_copy_no_commit",
            "sampling": {"lod": 0, "type": "RENDER_DATA", "space": "mesh_reference_cm"},
            "bones": bones, "geometry": {"vertex_count": len(positions),
            "triangle_count": len(triangles), "positions_cm": positions,
            "bounds_min_cm": [min(p[i] for p in positions) for i in range(3)],
            "bounds_max_cm": [max(p[i] for p in positions) for i in range(3)],
            "topology_sha256": hashlib.sha256(json.dumps(triangles, separators=(",", ":")).encode()).hexdigest()},
            "limitations": ["Loaded asset state may include in-memory edits; use a fresh isolated session.",
                            "No raw FBX geometry parsing or automatic asset import occurs.",
                            "Shared Skeleton equivalence alone cannot establish garment fit.",
                            "Topology mismatch is inconclusive; no nearest-neighbor correspondence is assumed.",
                            "This does not verify weights, morph extremes, clothing clearance or animation."]}


def main():
    output = absolute_file(os.environ["NEON_BODY_REFERENCE_OUTPUT"], must_exist=False)
    if output.exists() or not output.parent.is_dir():
        raise ValueError("Output must be new and its parent directory must exist")
    # Reserve before capture so concurrent readers cannot overwrite evidence.
    with output.open("x", encoding="utf-8") as stream:
        report = {"schema": SCHEMA, "status": "FAILED"}
        try:
            report = capture(os.environ["NEON_BODY_REFERENCE_ASSET"])
            report["provenance"] = {}
            for env in ("NEON_BODY_REFERENCE_FBX", "NEON_BODY_REFERENCE_CHARACTER_FILE"):
                if os.environ.get(env):
                    path = absolute_file(os.environ[env])
                    report["provenance"][env] = {"file": str(path), "sha256": sha256(path)}
            if os.environ.get("NEON_BODY_REFERENCE_BASELINE"):
                baseline = absolute_file(os.environ["NEON_BODY_REFERENCE_BASELINE"])
                report["comparison"] = compare(json.loads(baseline.read_text(encoding="utf-8")), report)
                report["baseline"] = {"file": str(baseline), "sha256": sha256(baseline)}
        except Exception as exc:
            report.update(status="FAILED", error=str(exc))
            raise
        finally:
            json.dump(report, stream, ensure_ascii=False, indent=2, allow_nan=False)


if __name__ == "__main__":
    main()
