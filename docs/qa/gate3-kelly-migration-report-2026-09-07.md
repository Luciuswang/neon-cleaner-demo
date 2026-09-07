# Gate 3 Kelly Migration QA Report - 2026-09-07

## Verdict

- `KELLY MIGRATION: PASS`
- `ENGINEERING: PASS`
- `RIDER POSE: CONDITIONAL PASS`
- `STRICT GATE 3: BLOCKED`

Kelly now replaces Paragon Phase in the playable preview and motorcycle chase.
The private dependency closure loads from `/Game/KellySource`, and no Kelly
binary assets are committed to the public repository.

## Verified

- Skeletal mesh, skeleton, PhysicsAsset, 13 material slots, and 384-bone
  hierarchy load successfully.
- All migrated `/Game` dependencies stay within `/Game/KellySource`.
- The original `D:\kelly-UE` project remained unchanged during staging.
- A reproducible Kelly-specific riding AnimSequence replaces the standing
  reference pose in the chase.
- Editor build, map validation, possession, movement, HUD, motorcycle
  alignment, smoke test, and proof-frame sanity checks pass.
- Independent QA confirms the rider is seated, knees are bent, feet are off the
  road, and no severe bone stretching is visible.

## Evidence

- Preview:
  `source/reference/linxia/ue-captures/linxia_kelly_preview_2026-09-07.png`
- Final Gate 3:
  `ue/NeonCleanerUE/Saved/Quality/linxia_motorcycle_gate3_quality_2026-09-07_191623.png`
- Side and rear use the same basename with `-side.png` and `-rear.png`.

Verification:

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1 `
  -SkipBuild `
  -FullVisualQA `
  -RiderPoseVerdict CONDITIONAL
```

## Known Source Limits

The supplied UE package is not visually equivalent to
`D:\kelly-UE\渲染图.jpg`. It contains the bound body/clothing mesh and material
instances, but no production texture assets and no imported XGen/Groom hair.
The project therefore uses a local yellow/black/white material palette.

## Remaining Strict-Gate Work

The gameplay silhouette is accepted conditionally, but the current views do
not prove both wrists are locked to the grips or both ankles are locked to the
foot pegs. A separate Kelly Control Rig/IK slice and closer contact captures
are required before setting `RiderPoseVerdict PASS`.
