"""Local-only Blender CPU texture conversion; no render, network or publication.

Run with Blender --background --factory-startup --disable-autoexec --python this
file. Original glTF geometry, hierarchy, UVs and PBR material JSON are retained;
only embedded images are resized/re-encoded and buffer offsets are repacked.
Use -- --merge-only for a geometry-only material batch pass on the existing
local derivative. It copies all embedded texture bytes without decoding them.
The output is NOT license-cleared or visually approved for distribution.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector


REPO = Path(__file__).resolve().parents[3]
OUTPUT_SCOPE = REPO / ".local" / "river-downloaded-house"
DEFAULT_SOURCE = Path("C:/Users/baomin.wang/Downloads/wooden_house_house_in_the_woods_project.glb")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_glb(data):
    magic, version, length = struct.unpack_from("<4sII", data)
    assert (magic, version, length) == (b"glTF", 2, len(data))
    doc, binary = None, None
    offset = 12
    while offset < length:
        size, kind = struct.unpack_from("<I4s", data, offset)
        payload = data[offset + 8:offset + 8 + size]
        assert len(payload) == size
        if kind == b"JSON":
            doc = json.loads(payload)
        elif kind == b"BIN\0":
            binary = payload
        offset += 8 + size
    assert doc is not None and binary is not None and offset == length
    return doc, binary


def pack_glb(doc, binary):
    encoded = json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode("utf8")
    encoded += b" " * (-len(encoded) % 4)
    binary += b"\0" * (-len(binary) % 4)
    return (struct.pack("<4sII", b"glTF", 2, 28 + len(encoded) + len(binary))
            + struct.pack("<I4s", len(encoded), b"JSON") + encoded
            + struct.pack("<I4s", len(binary), b"BIN\0") + binary)


def geometry_stats(doc, binary):
    assert not doc.get("skins"), "This converter is for the static house, not the character"
    formats = {5121: ("B", 1), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
    components = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}

    def read(ai, i):
        accessor = doc["accessors"][ai]
        assert not accessor.get("sparse") and not accessor.get("normalized")
        view = doc["bufferViews"][accessor["bufferView"]]
        fmt, size = formats[accessor["componentType"]]
        count = components[accessor["type"]]
        stride = view.get("byteStride", size * count)
        offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0) + i * stride
        return struct.unpack_from("<" + fmt * count, binary, offset)

    low, high = [float("inf")] * 3, [-float("inf")] * 3
    stats = {"triangles": 0, "vertices": 0, "meshNodes": 0, "primitives": 0}

    def walk(ni, parent):
        node = doc["nodes"][ni]
        if "matrix" in node:
            values = node["matrix"]
            local = Matrix([values[i:i + 4] for i in range(0, 16, 4)]).transposed()
        else:
            q = node.get("rotation", [0, 0, 0, 1])
            local = Matrix.LocRotScale(Vector(node.get("translation", [0, 0, 0])),
                                       Quaternion((q[3], q[0], q[1], q[2])),
                                       Vector(node.get("scale", [1, 1, 1])))
        matrix = parent @ local
        if "mesh" in node:
            stats["meshNodes"] += 1
            for primitive in doc["meshes"][node["mesh"]]["primitives"]:
                assert primitive.get("mode", 4) == 4 and not primitive.get("targets")
                ai = primitive["attributes"]["POSITION"]
                count = doc["accessors"][ai]["count"]
                indices = primitive.get("indices")
                index_count = doc["accessors"][indices]["count"] if indices is not None else count
                assert index_count % 3 == 0
                stats["triangles"] += index_count // 3
                stats["vertices"] += count
                stats["primitives"] += 1
                for i in range(count):
                    point = matrix @ Vector(read(ai, i))
                    for axis in range(3):
                        low[axis] = min(low[axis], point[axis])
                        high[axis] = max(high[axis], point[axis])
        for child in node.get("children", []):
            walk(child, matrix)

    for root in doc["scenes"][doc.get("scene", 0)]["nodes"]:
        walk(root, Matrix.Identity(4))
    stats["boundsMetres"] = {"min": low, "max": high, "sizeXYZ": [b - a for a, b in zip(low, high)]}
    stats["materials"] = len(doc.get("materials", []))
    return stats


def merge_by_material(output):
    """Bake static transforms and join by material; no texture regeneration."""
    destination = output / "wooden-house-browser.glb"
    receipt_path = output / "receipt.json"
    before_bytes = destination.read_bytes()
    original, binary = read_glb(before_bytes)
    receipt = json.loads(receipt_path.read_text(encoding="utf8"))
    assert sha(before_bytes) == receipt["output"]["sha256"]
    assert not original.get("skins") and not original.get("animations")
    if receipt.get("merge", {}).get("complete"):
        print("HOUSE_ALREADY_MERGED " + json.dumps(receipt["output"]))
        return
    before_stats = geometry_stats(original, binary)
    formats = {5121: ("B", 1), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
    components = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}

    def read(ai):
        a = original["accessors"][ai]
        assert not a.get("sparse") and not a.get("normalized")
        v = original["bufferViews"][a["bufferView"]]
        fmt, size = formats[a["componentType"]]
        count = components[a["type"]]
        stride = v.get("byteStride", size * count)
        start = v.get("byteOffset", 0) + a.get("byteOffset", 0)
        return [struct.unpack_from("<" + fmt * count, binary, start + i * stride) for i in range(a["count"])]

    groups, source_parts, horizontal = {}, [], {}

    def walk(ni, parent):
        node = original["nodes"][ni]
        if "matrix" in node:
            values = node["matrix"]
            local = Matrix([values[i:i + 4] for i in range(0, 16, 4)]).transposed()
        else:
            q = node.get("rotation", [0, 0, 0, 1])
            local = Matrix.LocRotScale(Vector(node.get("translation", [0, 0, 0])), Quaternion((q[3], *q[:3])), Vector(node.get("scale", [1, 1, 1])))
        matrix = parent @ local
        linear = matrix.to_3x3()
        normal_matrix = linear.inverted().transposed()
        mirrored = linear.determinant() < 0
        if "mesh" in node:
            mesh = original["meshes"][node["mesh"]]
            for p in mesh["primitives"]:
                assert p.get("mode", 4) == 4 and not p.get("targets")
                assert set(p["attributes"]) <= {"POSITION", "NORMAL", "TANGENT", "TEXCOORD_0", "TEXCOORD_1"}
                attrs = {key: read(ai) for key, ai in p["attributes"].items()}
                attrs["POSITION"] = [tuple(matrix @ Vector(v)) for v in attrs["POSITION"]]
                attrs["NORMAL"] = [tuple((normal_matrix @ Vector(v)).normalized()) for v in attrs["NORMAL"]]
                attrs["TANGENT"] = [(*tuple((linear @ Vector(v[:3])).normalized()), v[3] * (-1 if mirrored else 1)) for v in attrs["TANGENT"]]
                indices = [v[0] for v in read(p["indices"])] if "indices" in p else list(range(len(attrs["POSITION"])))
                assert len(indices) % 3 == 0 and max(indices) < len(attrs["POSITION"])
                if mirrored:
                    for i in range(0, len(indices), 3):
                        indices[i + 1], indices[i + 2] = indices[i + 2], indices[i + 1]
                material = p["material"]
                group = groups.setdefault(material, {"attributes": {k: [] for k in attrs}, "indices": [], "parts": []})
                assert set(group["attributes"]) == set(attrs), "Cannot silently discard a UV channel during batching"
                offset = len(group["attributes"]["POSITION"])
                for key, values in attrs.items():
                    group["attributes"][key].extend(values)
                group["indices"].extend(i + offset for i in indices)
                bounds = {"min": [min(v[k] for v in attrs["POSITION"]) for k in range(3)], "max": [max(v[k] for v in attrs["POSITION"]) for k in range(3)]}
                part = {"sourceNode": ni, "sourceName": node.get("name"), "sourceMesh": mesh.get("name"), "material": material,
                        "vertexOffset": offset, "vertexCount": len(attrs["POSITION"]), "triangles": len(indices) // 3, "mirrored": mirrored, "boundsMetres": bounds}
                group["parts"].append(part)
                source_parts.append(part)
                # CPU geometric clue only: horizontal area levels cannot prove
                # floor access, roof construction or the number of storeys.
                for i in range(0, len(indices), 3):
                    a, b, c = [Vector(attrs["POSITION"][j]) for j in indices[i:i + 3]]
                    cross = (b - a).cross(c - a)
                    if cross.length > 1e-8 and abs(cross.y) / cross.length > .995:
                        level = round(((a.y + b.y + c.y) / 3) / .05) * .05
                        horizontal[level] = horizontal.get(level, 0) + cross.length / 2
        for child in node.get("children", []):
            walk(child, matrix)

    for root in original["scenes"][original.get("scene", 0)]["nodes"]:
        walk(root, Matrix.Identity(4))
    assert len(groups) == 10
    doc = {key: copy.deepcopy(original[key]) for key in ["asset", "materials", "textures", "samplers", "extensionsUsed", "extensionsRequired"] if key in original}
    doc.update({"scene": 0, "scenes": [{"name": "Woodland house material batches", "nodes": [0]}],
                "nodes": [{"name": "woodland-house", "mesh": 0}], "meshes": [{"name": "woodland-house-static", "primitives": []}],
                "accessors": [], "bufferViews": [], "buffers": [], "images": []})
    doc["asset"]["generator"] += " | static material batches"
    result_bin = bytearray()

    def view(payload, target=None):
        result_bin.extend(b"\0" * (-len(result_bin) % 4))
        result = {"buffer": 0, "byteOffset": len(result_bin), "byteLength": len(payload)}
        if target is not None:
            result["target"] = target
        result_bin.extend(payload)
        doc["bufferViews"].append(result)
        return len(doc["bufferViews"]) - 1

    def accessor(values, kind, component=5126):
        count = components[kind]
        fmt = formats[component][0]
        data = b"".join(struct.pack("<" + fmt * count, *row) for row in values)
        a = {"bufferView": view(data, 34963 if kind == "SCALAR" else 34962), "componentType": component, "count": len(values), "type": kind}
        if kind == "VEC3":
            a["min"] = [min(row[k] for row in values) for k in range(count)]
            a["max"] = [max(row[k] for row in values) for k in range(count)]
        doc["accessors"].append(a)
        return len(doc["accessors"]) - 1

    for material, group in sorted(groups.items()):
        attrs = {key: accessor(values, "VEC" + str(len(values[0]))) for key, values in group["attributes"].items()}
        index_type = 5123 if max(group["indices"]) < 65536 else 5125
        indices = accessor([(i,) for i in group["indices"]], "SCALAR", index_type)
        doc["meshes"][0]["primitives"].append({"attributes": attrs, "indices": indices, "material": material, "mode": 4})
    image_hashes = []
    for image in original["images"]:
        v = original["bufferViews"][image["bufferView"]]
        payload = binary[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]]
        im = copy.deepcopy(image)
        im["bufferView"] = view(payload)
        doc["images"].append(im)
        image_hashes.append(sha(payload))
    doc["buffers"] = [{"byteLength": len(result_bin)}]
    result = pack_glb(doc, bytes(result_bin))
    checked, checked_binary = read_glb(result)
    stats = geometry_stats(checked, checked_binary)
    assert stats["triangles"] == before_stats["triangles"] == 22041
    assert stats["vertices"] == before_stats["vertices"] == 21955
    assert stats["primitives"] == 10 and len(result) <= 4000000
    assert stats["boundsMetres"] == before_stats["boundsMetres"]
    for field in ["materials", "textures", "samplers", "extensionsUsed", "extensionsRequired"]:
        assert checked.get(field) == original.get(field)
    for i, image in enumerate(checked["images"]):
        v = checked["bufferViews"][image["bufferView"]]
        assert sha(checked_binary[v["byteOffset"]:v["byteOffset"] + v["byteLength"]]) == image_hashes[i] == receipt["imageReceipts"][i]["sha256"]
    assert sha(Path(receipt["source"]["path"]).read_bytes()) == receipt["source"]["sha256"]
    # Retain the pre-merge derivative for recovery and independent comparison.
    backup = output / "wooden-house-browser-premerge.glb"
    if backup.exists():
        assert backup.read_bytes() == before_bytes
    else:
        backup.write_bytes(before_bytes)
    (output / "receipt-premerge.json").write_text(json.dumps(receipt, indent=2), encoding="utf8")
    receipt["output"].update({"bytes": len(result), "sha256": sha(result), **stats})
    receipt["merge"] = {"complete": True, "method": "CPU static world-transform bake, inverse-transpose normals, transformed tangent handedness; material batches",
                        "inputSha256": sha(before_bytes), "inputPrimitives": before_stats["primitives"], "outputPrimitives": 10,
                        "texturesReencoded": False, "allImageBytesUnchanged": True, "materialJSONUnchanged": True,
                        "boundsUnchanged": True, "trianglesUnchanged": True, "decimated": False, "sourceParts": source_parts,
                        "nominalBaseDrawsPerHouse": 10, "twoHousesNominalBaseDraws": 20,
                        "drawCaveat": "Primitive count excludes shadow/reflection/transmission passes and any renderer double-sided transparent extra draw",
                        "runtimeOrigin": {"geometryRecentred": False, "centreXZ": [(stats["boundsMetres"]["min"][i] + stats["boundsMetres"]["max"][i]) / 2 for i in [0, 2]], "minY": stats["boundsMetres"]["min"][1]},
                        "horizontalAreaLevels": [{"y": round(y, 3), "areaSquareMetres": round(a, 3)} for y, a in sorted(horizontal.items(), key=lambda item: -item[1])[:12]],
                        "visualStructure": "Geometry-based clues only; floor count, door openings and human-scale access still require native preview"}
    receipt["conversion"]["geometryBufferSha256UnchangedBeforeMerge"] = receipt["conversion"].pop("geometryBufferSha256Unchanged")
    receipt["conversion"]["method"] += "; subsequent static material batching replaces geometry buffers without changing world shape"
    receipt["knownTradeoffs"] = [s for s in receipt["knownTradeoffs"] if not s.startswith("26 source primitives retained")]
    receipt["knownTradeoffs"].append("Static parts merged by material; original door/window object pivots are no longer independently operable in this derivative; original and premerge retained")
    destination.write_bytes(result)
    receipt_path.write_text(json.dumps(receipt, indent=2), encoding="utf8")
    print("HOUSE_MERGED " + json.dumps({"receipt": str(receipt_path), **receipt["output"], "origin": receipt["merge"]["runtimeOrigin"], "horizontalAreaLevels": receipt["merge"]["horizontalAreaLevels"]}))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=OUTPUT_SCOPE)
    parser.add_argument("--merge-only", action="store_true", help="Merge existing derivative geometry only; never decode/regenerate its textures")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    output = args.output.resolve()
    assert output.is_relative_to(OUTPUT_SCOPE.resolve()), "Output outside owned local scope"
    if args.merge_only:
        merge_by_material(output)
        return
    source = args.source.resolve()
    assert source.is_file() and not source.is_relative_to(output)
    output.mkdir(parents=True, exist_ok=True)
    (output / "tmp").mkdir(exist_ok=True)
    bpy.context.preferences.filepaths.temporary_directory = str(output / "tmp")
    raw = source.read_bytes()
    original, binary = read_glb(raw)
    stats = geometry_stats(original, binary)
    assert stats["triangles"] <= 40000
    assert all(not item.get("uri") for item in original.get("buffers", []) + original.get("images", []))
    assert len(original["buffers"]) == 1
    image_roles = {i: set() for i in range(len(original["images"]))}
    for material in original.get("materials", []):
        slots = {**material.get("pbrMetallicRoughness", {}), **material}
        for slot in ["baseColorTexture", "normalTexture", "metallicRoughnessTexture", "occlusionTexture", "emissiveTexture"]:
            if slot in slots:
                image_roles[original["textures"][slots[slot]["index"]]["source"]].add(slot)
        # No alpha-bearing base-color map may silently become opaque JPEG.
        if material.get("alphaMode", "OPAQUE") != "OPAQUE":
            assert "baseColorTexture" not in material.get("pbrMetallicRoughness", {})

    source_images = output / "source-embedded"
    source_images.mkdir(exist_ok=True)
    loaded = []
    for i, image in enumerate(original["images"]):
        view = original["bufferViews"][image["bufferView"]]
        payload = binary[view.get("byteOffset", 0):view.get("byteOffset", 0) + view["byteLength"]]
        ext = ".png" if image["mimeType"] == "image/png" else ".jpg"
        path = source_images / (f"image-{i:02d}" + ext)
        path.write_bytes(payload)
        im = bpy.data.images.load(str(path), check_existing=False)
        roles = image_roles[i]
        is_data = not bool(roles & {"baseColorTexture", "emissiveTexture"})
        im.colorspace_settings.name = "Non-Color" if is_data else "sRGB"
        width, height = im.size[:]
        target = [max(1, round(v * min(1, 1024 / max(width, height)))) for v in [width, height]]
        if target != [width, height]:
            im.scale(*target)
        loaded.append((im, {"index": i, "roles": sorted(roles), "sourceDimensions": [width, height],
                            "dimensions": target, "sourceSha256": sha(payload), "sourceBytes": len(payload),
                            "colorSpace": im.colorspace_settings.name}))

    attempts = []
    for data_max, quality in [(1024, 90), (1024, 86), (1024, 82), (512, 94), (512, 90), (512, 86)]:
        processed = output / f"textures-color1k-data{data_max}-q{quality}"
        processed.mkdir(exist_ok=True)
        replacements, image_receipts = {}, []
        for i, (im, details) in enumerate(loaded):
            maximum = data_max if details["colorSpace"] == "Non-Color" else 1024
            width, height = im.size[:]
            target = [max(1, round(v * min(1, maximum / max(width, height)))) for v in [width, height]]
            if target != [width, height]:
                im.scale(*target)
            path = processed / f"image-{i:02d}.jpg"
            im.file_format = "JPEG"
            im.save(filepath=str(path), quality=quality)
            payload = path.read_bytes()
            assert payload[:2] == b"\xff\xd8"
            replacements[original["images"][i]["bufferView"]] = payload
            image_receipts.append({**details, "dimensions": target, "mimeType": "image/jpeg", "quality": quality,
                                   "bytes": len(payload), "sha256": sha(payload)})
        doc = copy.deepcopy(original)
        result_bin = bytearray()
        for i, view in enumerate(doc["bufferViews"]):
            source_view = original["bufferViews"][i]
            payload = replacements.get(i, binary[source_view.get("byteOffset", 0):source_view.get("byteOffset", 0) + source_view["byteLength"]])
            result_bin.extend(b"\0" * (-len(result_bin) % 4))
            view["byteOffset"] = len(result_bin)
            view["byteLength"] = len(payload)
            result_bin.extend(payload)
        for image in doc["images"]:
            image["mimeType"] = "image/jpeg"
        doc["buffers"][0]["byteLength"] = len(result_bin)
        doc["asset"]["generator"] = original["asset"].get("generator", "") + " | Blender CPU texture derivative"
        result = pack_glb(doc, bytes(result_bin))
        attempts.append({"colorMaxDimension": 1024, "dataMaxDimension": data_max, "quality": quality, "bytes": len(result), "limitBytes": 4000000})
        if len(result) <= 4000000:
            break
    else:
        raise RuntimeError("Cannot meet 4 MB without further quality decisions: " + json.dumps(attempts))

    # Reparse the actual final GLB, verifying exact unchanged geometry/PBR data.
    checked, checked_bin = read_glb(result)
    for field in ["meshes", "nodes", "scenes", "scene", "accessors", "materials", "textures", "samplers", "extensionsUsed", "extensionsRequired"]:
        assert checked.get(field) == original.get(field), field + " changed unexpectedly"
    geometry_hash = hashlib.sha256()
    for i, view in enumerate(original["bufferViews"]):
        if i in replacements:
            continue
        before = binary[view.get("byteOffset", 0):view.get("byteOffset", 0) + view["byteLength"]]
        v = checked["bufferViews"][i]
        after = checked_bin[v["byteOffset"]:v["byteOffset"] + v["byteLength"]]
        assert before == after
        geometry_hash.update(before)
    assert geometry_stats(checked, checked_bin) == stats
    destination = output / "wooden-house-browser.glb"
    destination.write_bytes(result)
    assert source.read_bytes() == raw, "Original source changed during conversion"
    receipt = {
        "kind": "house", "id": "woodland-house",
        "status": "LOCAL CPU DERIVATIVE; NOT VISUAL OR LICENSE ACCEPTANCE",
        "source": {"path": str(source), "bytes": len(raw), "sha256": sha(raw), "asset": original["asset"],
                   "provenance": "NTFS download metadata: Fab referrer and Epic download host; exact product listing unknown",
                   "copyright": original["asset"].get("copyright"), "license": "UNKNOWN / NOT EMBEDDED",
                   "redistributionApproved": False},
        "output": {"kind": "house", "id": "woodland-house", "path": str(destination), "bytes": len(result), "sha256": sha(result), **stats,
                   "images": len(loaded), "maxTextureDimension": 1024, "selfContained": True,
                   "extensionsUsed": checked.get("extensionsUsed", []), "extensionsRequired": checked.get("extensionsRequired", [])},
        "conversion": {"tool": "Blender " + bpy.app.version_string, "method": "CPU image scale/JPEG encode; original glTF graph, geometry and PBR definitions preserved",
                       "rendered": False, "gpuUsed": False, "decimated": False, "attempts": attempts,
                       "geometryBufferSha256Unchanged": geometry_hash.hexdigest(), "materialDefinitionsUnchanged": True},
        "materials": checked["materials"], "imageReceipts": image_receipts,
        "knownTradeoffs": ["JPEG normal and metallic/roughness maps are lossy; channels and Non-Color interpretation retained, visual inspection required",
                           "Color maps retained up to 1K; data maps may use 512px to respect the strict 4 MB cap; imageReceipts contain exact sizes",
                           "26 source primitives retained; no merging of potential door/window parts before visual review",
                           "Source material 2 uses 4x texture transform for base color/normal but not ORM; preserved, not silently repaired",
                           "Source transmission and double-sided materials retained; runtime cost not benchmarked"],
        "pending": ["Exact Fab listing/license and account entitlement", "Native offscreen exterior/interior/PBR preview",
                    "Door pivot/accessibility/collision assessment", "Current-map draw/shadow/transmission performance review"]}
    (output / "receipt.json").write_text(json.dumps(receipt, indent=2), encoding="utf8")
    print("HOUSE_RECEIPT " + json.dumps({"receipt": str(output / "receipt.json"), **receipt["output"], "attempts": attempts}))


if __name__ == "__main__":
    main()
