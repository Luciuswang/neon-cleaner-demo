# Local hero resource audit — 2026-09-16

Read-only source audit; no claim of cinematic acceptance. User authorized local
asset use and downloads; no purchases were made.

## Motorcycle candidate

`web/models/player-motorcycle.glb` is 56,233,204 bytes, 491,687 vertices and
799,914 triangles, with three embedded 4096 x 4096 PBR images. The old OBJ has
7,764 vertices, 4,793 polygon faces and three 2048 x 2048 maps. These are different
mesh assets; old contact anchors cannot be reused without calibration.

`tools/assets/prepare_cinematic_bike.py` produces the isolated candidate under
`.local/assets/CinematicBike`; provenance is in `cinematic-bike-source.json`.
Normalization is 230cm long, +X forward, +Y right, +Z up, ground Z0. Source-side
geometry inspection confirms headlight, fork and front wheel are toward +X.
After welding UV seams at 0.0001cm precision, all vertices form ONE connected
component. There are no skin or animation records. Automatic component splitting
cannot isolate wheels or steering. Production needs inspected DCC segmentation
and cleanup, a mechanical rig, LODs, new seat/grip/peg anchors, and rider retargeting.

`ue/scripts/import_cinematic_bike.py` targets `/Game/CinematicBike/SM_CinematicBike`
without changing the active pawn. Its optional `create_preview()` creates a
separate review map and refuses to overwrite an existing review. A commandlet
without StaticMeshEditorSubsystem imports LOD0 only and reports deferred LODs.

The GLB has no license/copyright metadata; it is an existing user/project asset.
Keep original and derived assets private; external redistribution not verified.

## City geometry

`../ExternalAssets/City3D66_10007031/3d66.com_10007031.max`: 13,737,824 bytes.
`Exported/city3d66_10007031_all.fbx`: 8,470,432 bytes, FBX7700, 333 Geometry
records and 207,376 vertices. Critically it has only ONE Material and ZERO Texture
records. Importing this file alone will not restore facade materials. The source
folder has 333 facade JPEGs at 1024 x 1024, plus smaller images/masks, and 23
individual building FBX exports. Re-export the MAX source with original material
assignments and resolved bitmaps. Use these buildings for mid/far distance; hero
facades need additional material detail rather than assuming 1K maps are final.

`../ExternalAssets/City3D66_C4D_54557304865/3d66.com_JJI54557304865.c4d`:
161,678,346 bytes. Its only external image is `tex/TextureSF-Building.jpg`,
4000 x 4000, 7,783,493 bytes. No UE-compatible mesh export was found. C4D export
and per-building UV/material review are required; file size does not establish
quality. Neither 3D66 folder contains a discovered license or purchase receipt.

## High Kelly

Original private project: `D:/kelly-UE/1. 正常版/kelly/我的项目/我的项目.uproject`.
`Import/rig.fbx` is 16,916,128 bytes; current `/Game/KellySource/rig` package is
32,234,535 bytes with skeleton, PhysicsAsset and 13 material instances. The base
Maya rig is `D:/kelly-UE/1. 正常版/kelly/绑定/HYN_rig.ma` (63,774,936 bytes).
The revised clothing-weight rig is
`D:/kelly-UE/2. 增加衣服权重绑定版本/HYN_rig1.ma` (65,188,572 bytes).

The Maya source references 47 unique missing images: 35 TIF, 11 IFF, one PNG.
They point to absent `F:/WB/xin/xin_DB/sourceimages` and other source paths.
XGen definition files exist but reference unavailable guides.abc, paintmaps and
collection data. The source does not contain the production images or groom
caches needed to reproduce `D:/kelly-UE/渲染图.jpg`. Switching to the high mesh
alone cannot deliver the requested final skin, clothing or hair. Keep textured
Kelly until those dependencies are restored or replacement materials/groom are
authored and identity-tested. Existing handoff explicitly marks this source as
user-provided private content, excluded from the public repository.
