"""Fetch the attributed CarConcept source and deterministically prepare UE OBJ parts.

No DCC dependency: numpy decodes GLB accessors; Pillow preserves embedded PBR maps.
Run normally to download missing sources, or --offline to rebuild from the cache.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import struct
import urllib.request

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BASE = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/"
CACHE = ROOT / ".local/assets/CarConcept"
SOURCES = {
    "CarConcept.glb": BASE + "Models/CarConcept/glTF-Binary/CarConcept.glb",
    "README.md": BASE + "Models/CarConcept/README.md",
    "Khronos-trademark.txt": BASE + "LICENSES/LicenseRef-LegalMark-Khronos.txt",
    "CC-BY-4.0.txt": BASE + "LICENSES/CC-BY-4.0.txt",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    provenance = []
    for name, url in SOURCES.items():
        path = CACHE / name
        if not path.exists():
            if args.offline:
                raise FileNotFoundError(path)
            request = urllib.request.Request(url, headers={"User-Agent": "NeonCleaner-asset-preparation/1.0"})
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = response.read()
            path.write_bytes(payload)
        payload = path.read_bytes()
        provenance.append({"file": name, "url": url, "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()})
    raw = (CACHE / "CarConcept.glb").read_bytes()
    magic, version, total = struct.unpack_from("<III", raw)
    if magic != 0x46546C67 or version != 2 or total != len(raw):
        raise ValueError("Invalid GLB header")
    offset, gltf, binary = 12, None, None
    while offset < len(raw):
        length, kind = struct.unpack_from("<II", raw, offset)
        data = raw[offset + 8:offset + 8 + length]
        if kind == 0x4E4F534A:
            gltf = json.loads(data)
        elif kind == 0x004E4942:
            binary = data
        offset += length + 8
    out = CACHE / "prepared"
    texture_dir = out / "textures"
    texture_dir.mkdir(parents=True, exist_ok=True)
    image_names = []
    for i, im in enumerate(gltf.get("images", [])):
        view = gltf["bufferViews"][im["bufferView"]]
        payload = binary[view.get("byteOffset", 0):view.get("byteOffset", 0) + view["byteLength"]]
        name = f"T_CC_{i:02d}"
        image = Image.open(io.BytesIO(payload)).convert("RGB")
        image.save(texture_dir / (name + ".png"))
        image_names.append(name)
    materials = []
    normal_images = set()
    for i, mat in enumerate(gltf["materials"]):
        pbr = mat.get("pbrMetallicRoughness", {})
        def texture(info):
            if not info:
                return None
            return image_names[gltf["textures"][info["index"]]["source"]]
        def texture_info(info):
            if not info:
                return None
            transform = info.get("extensions", {}).get("KHR_texture_transform", {})
            return {
                "tex_coord": transform.get("texCoord", info.get("texCoord", 0)),
                "offset": transform.get("offset", [0.0, 0.0]),
                "scale": transform.get("scale", [1.0, 1.0]),
                "rotation_radians": transform.get("rotation", 0.0),
                "normal_strength": info.get("scale", 1.0),
            }
        normal = texture(mat.get("normalTexture"))
        if normal:
            normal_images.add(normal)
        materials.append({
            "index": i, "name": f"M_CC_{i:02d}", "source_name": mat.get("name", "Panel"),
            "base_color": pbr.get("baseColorFactor", [1, 1, 1, 1]),
            "metallic": pbr.get("metallicFactor", 1), "roughness": pbr.get("roughnessFactor", 1),
            "color_texture": texture(pbr.get("baseColorTexture")),
            "orm_texture": texture(pbr.get("metallicRoughnessTexture")),
            "normal_texture": normal + "_DX" if normal else None,
            "emissive_texture": texture(mat.get("emissiveTexture")),
            "emissive": mat.get("emissiveFactor", [0, 0, 0]),
            "emissive_strength": mat.get("extensions", {}).get("KHR_materials_emissive_strength", {}).get("emissiveStrength", 1),
            "clearcoat": mat.get("extensions", {}).get("KHR_materials_clearcoat", {}).get("clearcoatFactor", 0),
            "glass": "KHR_materials_transmission" in mat.get("extensions", {}),
            "double_sided": mat.get("doubleSided", False),
            "texture_infos": {
                "color_texture": texture_info(pbr.get("baseColorTexture")),
                "orm_texture": texture_info(pbr.get("metallicRoughnessTexture")),
                "normal_texture": texture_info(mat.get("normalTexture")),
                "emissive_texture": texture_info(mat.get("emissiveTexture")),
                "occlusion_texture": texture_info(mat.get("occlusionTexture")),
            },
        })
    for name in normal_images:
        pixels = np.array(Image.open(texture_dir / (name + ".png")))
        pixels[:, :, 1] = 255 - pixels[:, :, 1]
        Image.fromarray(pixels).save(texture_dir / (name + "_DX.png"))

    dtypes = {5120: "i1", 5121: "u1", 5122: "<i2", 5123: "<u2", 5125: "<u4", 5126: "<f4"}
    widths = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
    def accessor(index):
        acc = gltf["accessors"][index]
        view = gltf["bufferViews"][acc["bufferView"]]
        dtype = np.dtype(dtypes[acc["componentType"]])
        width = widths[acc["type"]]
        stride = view.get("byteStride", width * dtype.itemsize)
        arr = np.ndarray((acc["count"], width), dtype=dtype, buffer=binary,
                         offset=view.get("byteOffset", 0) + acc.get("byteOffset", 0),
                         strides=(stride, dtype.itemsize)).copy()
        if acc.get("normalized"):
            arr = arr.astype(float) / np.iinfo(dtype).max
        return arr

    def transform(node):
        if "matrix" in node:
            return np.array(node["matrix"]).reshape(4, 4).T
        x, y, z, w = node.get("rotation", [0, 0, 0, 1])
        rot = np.array([[1-2*y*y-2*z*z, 2*x*y-2*z*w, 2*x*z+2*y*w],
                        [2*x*y+2*z*w, 1-2*x*x-2*z*z, 2*y*z-2*x*w],
                        [2*x*z-2*y*w, 2*y*z+2*x*w, 1-2*x*x-2*y*y]])
        mat = np.eye(4)
        mat[:3, :3] = rot @ np.diag(node.get("scale", [1, 1, 1]))
        mat[:3, 3] = node.get("translation", [0, 0, 0])
        return mat

    parts = {name: [] for name in ("Body", "WheelFrontL", "WheelFrontR", "WheelRearL", "WheelRearR")}
    wheel_pivots, removed = {}, []
    # glTF world Y-up, forward +Z -> UE forward +X, right +Y, up +Z.
    axis = np.array([[0, 0, 1], [-1, 0, 0], [0, 1, 0]])
    def visit(index, parent, group="Body"):
        node = gltf["nodes"][index]
        name = node.get("name", "")
        if name in {"License Plate", "InteriorSteeringEmblem"}:
            removed.append(name)
            return
        matrix = parent @ transform(node)
        if name in parts and name != "Body":
            group = name
            wheel_pivots[name] = axis @ matrix[:3, 3]
        if "mesh" in node:
            for primitive in gltf["meshes"][node["mesh"]]["primitives"]:
                if primitive.get("mode", 4) != 4:
                    raise ValueError("Only triangle primitives supported")
                material = primitive.get("material", 0)
                if material == 9:
                    removed.append(name + ":LicenseMaterial")
                    continue
                attrs = primitive["attributes"]
                pos = accessor(attrs["POSITION"])
                world = (pos @ matrix[:3, :3].T + matrix[:3, 3]) @ axis.T
                normals = accessor(attrs["NORMAL"]) @ np.linalg.inv(matrix[:3, :3]) @ axis.T
                normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-9)
                uv = accessor(attrs["TEXCOORD_0"]) if "TEXCOORD_0" in attrs else np.zeros((len(pos), 2))
                indices = accessor(primitive["indices"]).astype(np.int64).reshape(-1, 3)
                if np.linalg.det(axis @ matrix[:3, :3]) < 0:
                    indices = indices[:, [0, 2, 1]]
                parts[group].append((world, normals, uv, indices, material))
        for child in node.get("children", []):
            visit(child, matrix, group)
    for node_index in gltf["scenes"][gltf.get("scene", 0)]["nodes"]:
        visit(node_index, np.eye(4))
    points = np.concatenate([p[0] for values in parts.values() for p in values])
    lower, upper = points.min(axis=0), points.max(axis=0)
    scale = 480.0 / (upper[0] - lower[0])
    # Source is an unusually broad concept car; normalize its width (including
    # mirrors) to 220cm for a plausible road pursuit vehicle. Wheel circles lie
    # in XZ, so this changes tire width without making their profile elliptical.
    scale_xyz = np.array([scale, 220.0 / (upper[1] - lower[1]), scale])
    center = np.array([(lower[0]+upper[0])/2, (lower[1]+upper[1])/2, lower[2]])
    manifest_parts = []
    for name, primitives in parts.items():
        pivot = (wheel_pivots[name] - center) * scale_xyz if name in wheel_pivots else np.zeros(3)
        path = out / ("SM_CC_" + name + ".obj")
        triangles, counter = 0, 1
        with path.open("w", encoding="utf-8", newline="\n") as stream:
            stream.write("# UE centimeters; +X forward, +Y right, +Z up.\nmtllib CarConcept.mtl\n")
            for pos, normals, uv, faces, material in primitives:
                pos = (pos - center) * scale_xyz - pivot
                normals = normals / scale_xyz
                normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-9)
                stream.write(f"o {name}_{counter}\nusemtl M_CC_{material:02d}\n")
                stream.writelines("v %.7f %.7f %.7f\n" % tuple(v) for v in pos)
                stream.writelines("vt %.7f %.7f\n" % (v[0], 1-v[1]) for v in uv)
                stream.writelines("vn %.7f %.7f %.7f\n" % tuple(v) for v in normals)
                for face in faces + counter:
                    stream.write("f " + " ".join(f"{v}/{v}/{v}" for v in face) + "\n")
                triangles += len(faces)
                counter += len(pos)
        manifest_parts.append({"name": "SM_CC_" + name, "file": path.name, "pivot_cm": pivot.tolist(),
                               "triangles": triangles, "materials": sorted({p[4] for p in primitives})})
    with (out / "CarConcept.mtl").open("w", encoding="utf-8", newline="\n") as stream:
        for mat in materials:
            stream.write(f"newmtl {mat['name']}\nKd " + " ".join(map(str, mat["base_color"][:3])) + "\n")
            if mat["color_texture"]:
                stream.write(f"map_Kd textures/{mat['color_texture']}.png\n")
    manifest = {"schema": 1, "asset": "CarConcept", "license": "CC-BY-4.0",
        "attribution": "Car Concept by Eric Chadwick / Darmstadt Graphics Group GmbH (2024), CC BY 4.0. Modified: logos removed, UE axis conversion, 480cm length/220cm width normalization, wheel separation, DirectX normals, pursuit graphite materials.",
        "license_url": "https://creativecommons.org/licenses/by/4.0/", "sources": provenance,
        "axis": "+X forward, +Y right, +Z up", "units": "centimeters", "length_cm": 480,
        "dimensions_cm": ((upper-lower)*scale_xyz).tolist(), "removed_nodes": removed,
        "exported_uv_channels": [0],
        "texture_transform_convention": "glTF UV: offset + rotation * (scale * UV); OBJ V flip is reversed by UE import; material UV0 matches glTF UV0.",
        "source_bounds": [lower.tolist(), upper.tolist()], "parts": manifest_parts, "materials": materials,
        "limitations": ["No skeletal rig or source animation; animate wheel components around local Y.",
                         "glTF AO on UV1 is not baked into UV0; skipped to avoid incorrect shading.",
                         "No runtime or visual quality verdict is implied by asset preparation."]}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    doc = ROOT / "docs/assets/cinematic-car-source.json"
    doc.parent.mkdir(parents=True, exist_ok=True)
    doc.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(out), "dimensions_cm": manifest["dimensions_cm"], "parts": manifest_parts}, indent=2))


if __name__ == "__main__":
    main()
