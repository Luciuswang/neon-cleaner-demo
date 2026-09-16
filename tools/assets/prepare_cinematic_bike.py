"""Prepare the existing private high-detail GLB as an isolated UE candidate.

Does not replace the active motorcycle or assume its hand/foot contact anchors.
"""
import hashlib
import io
import json
from pathlib import Path
import struct
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "web/models/player-motorcycle.glb"
OUT = ROOT / ".local/assets/CinematicBike"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    data = SOURCE.read_bytes()
    length = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20+length])
    binary = data[28+length:]
    def acc(index):
        a = gltf["accessors"][index]
        view = gltf["bufferViews"][a["bufferView"]]
        dtype = np.dtype({5126: "<f4", 5125: "<u4", 5123: "<u2"}[a["componentType"]])
        width = {"VEC3": 3, "VEC2": 2, "SCALAR": 1}[a["type"]]
        return np.ndarray((a["count"], width), dtype=dtype, buffer=binary,
                          offset=view.get("byteOffset", 0)+a.get("byteOffset", 0),
                          strides=(view.get("byteStride", width*dtype.itemsize), dtype.itemsize)).copy()
    if len(gltf["meshes"]) != 1 or len(gltf["nodes"]) != 1 or gltf.get("skins"):
        raise RuntimeError("Source structure changed; review candidate conversion")
    prim = gltf["meshes"][0]["primitives"][0]
    positions = acc(prim["attributes"]["POSITION"])
    normals = acc(prim["attributes"]["NORMAL"])
    uv = acc(prim["attributes"]["TEXCOORD_0"])
    faces = acc(prim["indices"]).astype(np.int64).reshape(-1, 3)
    node = gltf["nodes"][0]
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    rotation = np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],
                         [2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],
                         [2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])
    matrix = rotation @ np.diag(node.get("scale", [1, 1, 1]))
    world = positions @ matrix.T + node.get("translation", [0, 0, 0])
    # glTF world +Y up. Its longest axis is Z; preserve complete node transform.
    if np.argmax(np.ptp(world, axis=0)) != 2:
        raise RuntimeError("Unexpected motorcycle longitudinal axis")
    axis = np.array([[0, 0, 1], [-1, 0, 0], [0, 1, 0]])
    positions = world @ axis.T
    normals = normals @ np.linalg.inv(matrix) @ axis.T
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)
    if np.linalg.det(axis @ matrix) < 0:
        faces = faces[:, [0, 2, 1]]
    low, high = positions.min(axis=0), positions.max(axis=0)
    scale = 230.0/(high[0]-low[0])
    positions = (positions - [(low[0]+high[0])/2, (low[1]+high[1])/2, low[2]])*scale
    mat = gltf["materials"][prim.get("material", 0)]
    image_map = {}
    for label, info in [("Color",mat["pbrMetallicRoughness"]["baseColorTexture"]),
                        ("NormalDX",mat["normalTexture"]),
                        ("MetalRough",mat["pbrMetallicRoughness"]["metallicRoughnessTexture"])]:
        im = gltf["images"][gltf["textures"][info["index"]]["source"]]
        view = gltf["bufferViews"][im["bufferView"]]
        payload = binary[view.get("byteOffset", 0):view.get("byteOffset", 0)+view["byteLength"]]
        pixels = np.array(Image.open(io.BytesIO(payload)).convert("RGB"))
        if label == "NormalDX":
            pixels[:, :, 1] = 255-pixels[:, :, 1]
        name = "T_CinematicBike_"+label+".png"
        Image.fromarray(pixels).save(OUT/name)
        image_map[label] = {"file": name, "dimensions": [pixels.shape[1],pixels.shape[0]],
                            "source_sha256": hashlib.sha256(payload).hexdigest()}
        if label == "Color": color = pixels

    # Weld UV seams only for topology audit, never modify exported geometry.
    _, welded = np.unique(np.round(positions, 4), axis=0, return_inverse=True)
    parent = np.arange(int(welded.max())+1)
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    for face in welded[faces]:
        a = find(int(face[0]))
        for b in face[1:]:
            b = find(int(b))
            if a != b: parent[b] = a
    labels = np.array([find(int(i)) for i in welded])
    component_ids, counts = np.unique(labels, return_counts=True)
    components = []
    for i in np.argsort(counts)[-12:][::-1]:
        mask = labels == component_ids[i]
        points = positions[mask]
        components.append({"vertices": int(counts[i]), "min_cm": points.min(axis=0).tolist(),
                           "max_cm": points.max(axis=0).tolist()})
    path = OUT/"SM_CinematicBike.obj"
    with path.open("w", encoding="utf8", newline="\n") as f:
        f.write("# Candidate only: centimeters, +X longitudinal, +Z up.\nmtllib CinematicBike.mtl\no CinematicBike\nusemtl M_CinematicBike\n")
        f.writelines("v %.7f %.7f %.7f\n" % tuple(p) for p in positions)
        f.writelines("vt %.7f %.7f\n" % (p[0],1-p[1]) for p in uv)
        f.writelines("vn %.7f %.7f %.7f\n" % tuple(p) for p in normals)
        for face in faces+1:
            f.write("f "+" ".join(f"{v}/{v}/{v}" for v in face)+"\n")
    (OUT/"CinematicBike.mtl").write_text("newmtl M_CinematicBike\nKd 1 1 1\nmap_Kd T_CinematicBike_Color.png\n",encoding="utf8")

    # An orthographic source-geometry inspection, not a cinematic quality proof.
    canvas = np.full((850,1400,3),24,dtype=np.uint8)
    screen_x = np.clip(((positions[:,0]+115)*5.4+75).astype(int),0,1399)
    screen_y = np.clip((760-positions[:,2]*5.4).astype(int),0,849)
    tx=np.clip((uv[:,0]*color.shape[1]).astype(int),0,color.shape[1]-1)
    ty=np.clip((uv[:,1]*color.shape[0]).astype(int),0,color.shape[0]-1)
    order=np.argsort(positions[:,1])
    canvas[screen_y[order],screen_x[order]]=color[ty[order],tx[order]]
    preview=Image.fromarray(canvas)
    ImageDraw.Draw(preview).text((20,15),"SOURCE GEOMETRY INSPECTION / +X to right / candidate, not runtime proof",fill="white")
    preview.save(OUT/"source_side_inspection.png")
    manifest={"schema":1,"source":"web/models/player-motorcycle.glb","source_bytes":len(data),
        "source_sha256":hashlib.sha256(data).hexdigest(),"source_asset_metadata":gltf["asset"],
        "rights_status":"Existing project/user-provided local asset. GLB has no copyright/license metadata; external distribution rights not verified.",
        "candidate_only":True,"target":"/Game/CinematicBike/SM_CinematicBike.SM_CinematicBike",
        "axis":"+X forward, +Y right, +Z up; XY centered; ground Z0. Front sign visually verified from source_side_inspection.png: fork/headlight/front wheel on +X, saddle/tail on -X.",
        "dimensions_cm":np.ptp(positions,axis=0).tolist(),"vertices":len(positions),"triangles":len(faces),
        "maps":image_map,"skins":len(gltf.get("skins",[])),"animations":len(gltf.get("animations",[])),
        "welded_component_count":len(component_ids),"largest_components":components,
        "wheel_split_status":"Not segmented: connectivity audit does not establish semantic wheel/steering ownership. Requires inspected component selection or DCC retopology; no blind spatial cutting.",
        "contact_status":"Old motorcycle grip, seat, footpeg and wheel anchors are invalid until recalibrated.",
        "render_status":"Offline candidate prepared; UE import, material validation, LOD budget and dynamic contacts not yet verified."}
    (OUT/"manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf8")
    (ROOT/"docs/assets/cinematic-bike-source.json").write_text(json.dumps(manifest,indent=2),encoding="utf8")
    print(json.dumps({k:manifest[k] for k in ["dimensions_cm","vertices","triangles","welded_component_count","largest_components"]},indent=2))


if __name__=="__main__":main()
