# Task: sunbreak-house-roundtrip-arms-2026-11-17

- State: DONE — bounded browser-demo scope, live verified
- Date: 2026-11-17
- Branch: codex/character-continuity-pipeline
- Owner: main Producer; single writer for house/runtime/release
- User authorization: actual editable house export/edit/reimport and left-arm fix;
  preserve comparison demos; standing checkpoint/public Pages publishing authority.
- Lease: acquired for experiments/sunbreak-storm-v3 and this task/worklog.
- Gatekeeper: Planck PASS TO IMPLEMENT, with the hard requirements below.

## Scope and ownership

Main: timber-house.js, new house-asset.js, authoring tools/export package,
world integration, server/local browser QA, README, build and existing Pages release.
Arm specialist: weapon.js, weapon-provenance.json, new qa/arm-* only.
Independent Planck: read-only gate/final engineering review.
Independent art reviewer: current native canvas evidence only; no shared writes.
No agent may call Sites provisioning, edit .openai/hosting.json, private/UE assets,
old QA evidence, or v1/v2. Prior Sites provider creation terminally failed; existing
GitHub Pages is the established explicit public hosting destination.

## Acceptance criteria

1. Editable local-origin metre/Y-up GLB plus texture package and ZIP; semantic
   wall/roof/window/furniture groups retained BEFORE runtime batching. Independent
   DoorPivot at original hinge. Original baseline retained, names/UV/materials,
   license, dimensions and collision contract documented.
2. Actual headless Blender import, a restrained identifiable cosmetic edit and
   GLB re-export; real game GLTFLoader loads it instead of duplicate generated
   visuals. Keep authored practical lights once and existing collision/door logic.
   Validate structural anchors/geometry against fixed collision contract and
   reject incompatible architectural edits, not silently drift.
3. Left sleeve: remove the nonrigid rear vertex translation. Preserve source
   hand/grip UV/contact, muzzle coincidence, player inputs/fire/reload/damage,
   all tactical rules and v1/v2 bytes. Review idle/ADS/fire/reload and surface
   stretch/normal quality; numeric checks do not substitute for art review.
4. Current source-bound house47 and tactical browser tests; export/import
   structure/material/texture validation; source-bound representative canvas
   before/after evidence and real-time 1080p >=30s pacing with raw samples.
5. Independent engineering and bounded art verdict before final handoff.
   No UE/AAA/full continuous animation claim. Retain failed evidence if any.
6. Deliver actual files with exact paths and public ZIP link; source checkpoint
   verified, existing Pages updated normally via protected-main PR and anonymous
   release hash verification. Preserve root/web and public v1/v2.

## Boundaries / risks

Dirty private vault already blocked startup restore; inspected and preserved.
This isolated public browser asset slice needs no private dependency and will
skip private snapshot transfer; no complete UE portability assertion.
The house uses authored geometry and existing CC0 textures. The separate weapon
is CC-BY-4.0 with attribution retained; do not label weapon as CC0.
No arbitrary architectural redesign: cosmetic edits within the collision
envelope only; altered doors/stairs/walls require reviewed collision changes.
Human external art refinement is not claimed; Blender roundtrip is this trial.

## Plan

Export source semantic assembly -> Blender edit/re-export -> validate/import ->
runtime regressions and independent QA -> normal source checkpoint -> existing
Pages publication -> live hashes and final durable handoff/worklog.

## Results — verified local checkpoint

- Actual semantic source GLB, Blender5.3 editable `.blend`, edited derivative GLB,
  11 packed/extracted texture images and a 20-file ZIP handoff exist under v3.
  ZIP: `assets/house/timber-house-art-kit.zip`, 54,851,845 bytes.
  A fresh Blender process reopened the delivered project and decoded all11 maps.
- Real edit: handle/plate welded then4mm/3segment bevel, aged-brass PBR; each
  handle component24→96 Blender vertices. No human manual finish is claimed.
- Runtime loads edited GLB;1372 source meshes are validated, static opaque
  surfaces become11 runtime batches. Original physics root/door references and
  four actual lights retained; source semantic assembly preserved separately.
- Fixed-layout validation now compares oriented triangle surfaces, not only
  point clouds. Negative probes reject collapsed/deleted/reversed faces.
  Injected batch failure leaves live root/door/lights/metadata untouched.
- Left arm: removed rear vertex translation, articulated the actual measured
  joints without bone-length scale, retained held hand contact and source UVs,
  and sewed a short garment closure into the24-edge left shoulder opening.
  No left opening/nonmanifold/winding defect in actual topology checks.
- Exact whole player/combat/NPC/input inline module and v1/v2 preserved.
  Original licensed weapon GLB and textures remain byte-exact.
- QA: preservation/package35, actual-browser roundtrip28, house47, tactical24,
  unit house28/AI10/weather-audio12, arm55 assertions, final source-bound
  collector41 checks PASS, including staged Git/LFS byte portability.
  Evidence: v3 `qa/roundtrip-release.json`.
- Independent Planck engineering PASS for the three corrected blockers.
  Independent Zeno bounded art PASS after extra oblique hardware close-up.
  Minor polish notes retained: angular rear-sleeve contour in ADS-fire and
  bright windows/practicals flattening some nearby detail.
- Final current-build30s1080p scripted combat+audio runs3 and4 both passed the
  unchanged strict limits on native NVIDIA RTX5070 D3D11: p99≈18.4ms,
  max≈18.8ms, zero>50ms hitches. Run2 had one428.2ms hitch, cause unknown;
  its full raw record is retained. Not a promise of universally hitch-free play.
- All11 actual-game native canvas views bind current source hashes; numerical
  pose sweep is1815 evaluations, not full continuous visual review.

## Retained limits / next action

The original RIGHT shoulder opening is unchanged; this is the requested LEFT
arm repair, not a globally watertight asset. The original root-level reload
cosmetics remain; no full hand-driven reload is claimed. General structural
house edits still require collision review. This browser slice does not satisfy
unrelated UE/AAA/AI-video cinematic gates.

## Publication receipt — complete

- Core source `a32056a66d3b0a09f7719855a1bea83305af40c7` uploaded and verified,
  including4 unique LFS objects/107MB (GLBs, real Blender file and ZIP).
- Publishing-tool correction/source release:
  `e9dfc9244a23206960931b9aba7b0d457e4142d5`. This preserves exact pinned
  TextureUtils bytes; no runtime or source-bound QA change.
- Ordinary protected-main PR7:
  `https://github.com/Luciuswang/neon-cleaner-demo/pull/7`.
  Merge `b208c68dc84db962078bce088d4c52bbeda8e698`.
  No rules changed, force push, bypass, or self-review approval.
- Anonymous live verification at2026-11-17T07:25:22Z:146/146 release files,
  178,467,426 bytes, all SHA256 correct; pinned original root/web entries
  preserved. Report: v3 `qa/roundtrip-public-live.json`.
- Actual public hardware-headless browser start/fire/reload smoke PASS,
  zero console/runtime errors. Magazine30→28→30, reserve90→88; real handoff
  download link present. Report: v3 `qa/roundtrip-public-smoke.json`.
- Play: `https://luciuswang.github.io/neon-cleaner-demo/sunbreak/`.
  ZIP: `https://luciuswang.github.io/neon-cleaner-demo/sunbreak/assets/house/timber-house-art-kit.zip`.
  Separate comparisons remain at `/sunbreak/original/` and `/sunbreak/v2/`.
- Private transfer was explicitly skipped for this self-contained public slice;
  pre-existing dirty vault preserved. No full UE asset-portability claim.

Next concrete action, only on user request: human artist edits the delivered
`.blend`/GLB; validate the edited derivative against the documented fixed-layout
contract and repeat import/door/collision/lighting/runtime QA before publishing.
Structural redesign needs an explicitly reviewed collision update. No further
production or email is pending for this request.
