# Custom MetaHuman rider and leather jacket — 2026-11-09

Task `metahuman-rider-2026-11-09`: BLOCKED / REWORK. User explicitly requested their
custom character replace the motorcycle rider, with the downloaded free leather
jacket, then see the game running. This overrides the older Kelly-identity
mandate for this replacement. Do not overwrite the user's saved character.

Baseline `Heroine_MetaHuman.uasset` SHA256:
`417c3940f0bf14539f0060a95b1f95caa4fcb8729f9bd098a180ca29524326f3`.
The original and prior Kelly remain in the private snapshot. A copy is used in
`.local/metahuman-rider-work/` while the user's editor stays open.

The CC-BY jacket source from CG StudioX / Fab has been copied, byte-verified,
to `.local/private-sources/metahuman-leather-2026-11-09/`; SHA256
`70b22abf3fb2ffe048587aaff00e6de654e9a96cf8bc70767f16650bde797d39`.
It is an unrigged single FBX with embedded albedo/normal and separate 4K maps;
fitting and skinning to this specific character are required. Never assert a
rigged/parametric outfit based on file existence alone. Preserve CC-BY credit.

Current pawn uses Kelly-specific bone names and procedural pose. A MetaHuman
replacement requires a complete assembled body/face/groom blueprint, a riding
animation or retargeted rig, and clothes bound to the proper skeleton. Simply
changing the mesh path will not work. Input/collision/camera must remain intact.
Gatekeeper requires actual asset reload, identity and clothing checks, neutral
and moving offscreen views plus gameplay outcomes; prior cinematic acceptance
remains blocked separately. User explicitly asked to see the actual game.

Initial isolated UE inspection loaded the saved character copy, found it has no
high-resolution textures and `can_build_meta_human=False`. Official automated
rig and texture requests are being tried only on the copy. The Epic service
opened a device-authorization browser and is awaiting account-holder action;
no credentials or codes are recorded. Work on jacket preparation can continue.

## Checkpoint and remaining work

- User screenshot of this exact Fab download confirms CC BY 4.0. Source credit,
  extracted embedded albedo/normal and other maps are in
  `docs/assets/metahuman-leather-jacket-2026-11-09.md` and the private sources.
- The jacket's *unrigged, unfitted* static mesh and five PBR textures were
  imported into an isolated UE project, reloaded in a fresh UE process and
  checked for material assignment and texture color space. Seven identical,
  checksum-verified candidate assets were copied to the new, previously absent
  `/Game/MetaHumanWorkspace/Clothing/LeatherJacketSource` directory. They are
  not assigned to the character or rider and are not a wearable garment.
- Body-only fitting geometry was generated from a duplicate of the saved
  character in an isolated full UE editor with offscreen rendering. Its saved
  FBX is backed up in `.local/private-sources/metahuman-rider-2026-11-09/`, has
  342 reference bones and SHA256
  `59ab431128009ad90aad4901e835c1816319313b9674107dad839697dd26dbfe`.
  Source hash was unchanged. The wrapper reached its timeout while the editor
  was shutting down, after the script had logged successful export and written
  the FBX/manifest; Max subsequently imported and inspected the reference.
  This is an unassembled fitting reference, not the final runtime character.
- A separate Max experiment adjusted 1,151 of 2,521 jacket vertices for the
  reference arm pose. The unskinned and failed-wrap `.max` scenes and reports
  are preserved privately. They are **experimental, visually unreviewed and not
  game-ready**. Skin Wrap produced zero control points and no Skin modifier.
  Reproducible batch runner is `tools/assets/Run-MetaHumanJacketFit.ps1`; it
  now refuses an imported body with no Skin instead of producing a false result.
  The FBX had Skin in an earlier batch inspection but not subsequent automated
  imports; the context difference remains unresolved.
- The attempted official face rig/texture preparation ran on the isolated copy.
  Epic requested account-holder device authorization; after it remained pending,
  the bounded test timed out. No account credentials or device codes are stored
  in project artifacts. A new request is needed after the account holder is ready.
- **Not done:** no skinned/fitted jacket, no MetaHuman runtime assembly, no
  riding animation/retarget, no replacement of the Kelly pawn, and no new-game
  visual, input or performance verification. The original game was not presented
  as the requested replacement. The current editor and original character remain.

Next: retry the Epic binding request after interactive device authorization,
assemble and persist the actual character, resolve the 3ds Max FBX Skin import
context, transfer/validate jacket weights and rider pose, implement the runtime
integration, run current-build QA and then launch the actual game. Do not redo
the completed source acquisition, FBX texture extraction or body fitting export.
