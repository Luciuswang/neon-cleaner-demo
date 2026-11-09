# MetaHuman leather jacket source preparation — 2026-11-09

Status: **SOURCE PREPARED; unrigged, unfitted, not gameplay-ready.**
This record covers source inspection and preparation only. The integrator owns
Unreal import, fitting, skinning, character assembly and gameplay verification.

## Source and credit

The user supplied `C:/Users/baomin.wang/Downloads/female-leather-jacket-free-model.zip`
(46,116,242 bytes). SHA-256:
`70b22abf3fb2ffe048587aaff00e6de654e9a96cf8bc70767f16650bde797d39`.

[Female Leather Jacket - Free Model, CG StudioX](https://www.fab.com/listings/d541ccae-385a-4f98-b678-ea57a60c5f85).
The user's screenshot of this exact listing explicitly displays **Creative
Commons Attribution (CC BY 4.0)**, verified by the integrator on 2026-11-09.
Credit CG StudioX, the title, source link and
[CC BY 4.0 license](https://creativecommons.org/licenses/by/4.0/), and identify
fitting, skinning and material changes. Preserve the acquisition evidence.
Do not infer a different marketplace license from similarly named listings.

## Inspected contents

- One FBX 7700 mesh, exported by FBX SDK 2020.2.3: `polySurface4`, one material,
  2,521 control vertices, 2,506 polygons, 4,947 triangles after triangulation.
- No skin deformers, clusters or limb bones. The empty animation stack is not
  a usable animation. No MetaHuman wardrobe package or simulation mesh exists.
- Source uses centimeters and Y-up. Bounds: X −59.2996 to 59.3011,
  Y 100.4916 to 159.3137, Z −15.8541 to 10.5077. These are source coordinates,
  not evidence of fitting to the user's body.
- External 4096×4096 maps: metalness, roughness, AO, normal. A 512×512
  `internal_ground_ao_texture.jpeg` is preserved but not connected to the jacket.
- **Albedo is embedded in the FBX**, not missing: 7,192,916 bytes. A second
  normal image (14,591,358 bytes) is embedded too. Both are extracted losslessly;
  the external normal remains unchanged. Normal green-channel convention needs
  engine comparison before acceptance.

## Reproducible preparation and candidate import

`ue/scripts/metahuman/import_leather_jacket.py --prepare-only` runs with ordinary
Python and needs only the standard library. It pins the audited ZIP hash,
checks its exact entry set, parses FBX without executing contents, preserves all
original files and extracts embedded images. It validates output paths and
preflights differing existing files; writes use exclusive creation.
When Downloads is absent on another PC, it uses the preserved ZIP in the
private-source folder, with the same mandatory SHA-256 verification.

Prepared sources are under `.local/private-sources/MetaHumanLeatherJacket/`:
the original ZIP, `source/jacket.fbx`, all original `textures/`, extracted
`embedded/Albedo.jpg` and `embedded/Normal.jpg`, and a hashed `manifest.json`.
This location is covered by the existing private-source inventory. Source
preparation does not prove that a private snapshot has been published.

When explicitly executed by the integrator in Unreal Python, the same script
prepares sources and imports into
`/Game/MetaHumanWorkspace/Clothing/LeatherJacketSource`. It creates
`SM_LeatherJacket_Unfitted`, five textures and `M_LeatherJacket_Source`, with
base color in sRGB and normal/metalness/roughness/AO in linear interpretation.
FBX scene/unit conversion is enabled. Material is two-sided for the candidate;
the finished garment still needs lining/backface review. The script refuses
existing destination assets and never changes the character, skeleton, level,
wardrobe or active pawn. A partially completed import must be inspected before
retrying; the script does not erase it.

Preparation ran twice successfully with identical output; path traversal,
absolute-path rejection and Python syntax were checked. No UE process was
started by the source-preparation agent; UE API behavior remains for the
integrator's actual import test.

## Fit and integrate

1. Preserve the saved `Heroine_MetaHuman` and the user's identity/body edits.
   Obtain that character's actual rigged body and reference A-pose before fitting.
   At source inspection, no assembled body mesh was saved under MetaHumans.
2. Fit jacket shoulder, sleeve, bust, waist and hem to the actual body, preserving
   seams and leather thickness; global scale alone is insufficient. Local
   3ds Max 2026 and `3dsmaxbatch.exe` exist; license/runtime was not exercised.
3. Transfer weights from the matching body, preserve its skeleton and rest pose,
   then correct armpits/elbows and sleeve cuffs. Fixed skeletal clothing is a
   bounded route for this specific heroine. Epic's
   [body-to-clothing workflow](https://dev.epicgames.com/documentation/metahuman/metahuman-stylized-character-character-geometry-and-rig-creation)
   requires pose alignment and articulation checks after transfer.
4. If resizable wardrobe is required, use Epic's
   [render-mesh Outfit workflow](https://dev.epicgames.com/documentation/metahuman/building-a-metahuman-parametric-outfit-with-a-render-mesh?lang=en-US):
   import fitted render/sim inputs, transfer body skin weights, create the cloth
   asset and outfit with the correct source body. A generic FBX is not already
   parametric. Epic specifically warns of armpit tearing after automatic transfer.
5. Verify front/side/back appearance plus seated riding, lean, steering and arm
   extension; inspect body penetration, cuff contact, hem clearance, normals,
   roughness and metal-only hardware response. Then assemble and test actual
   gameplay animation, LOD behavior and frame time. Candidate import alone cannot
   satisfy cinematic or AI-video acceptance.
