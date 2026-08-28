# Rider Animation Source Plan - 2026-08-28

## Decision

Do not continue blind C++ rider-pose tuning as the main production path. The
next quality step is an asset-level animation / rig pass:

1. Use a seated motorcycle / bike riding animation if a compatible FBX source is
   found.
2. Otherwise, build a UE Control Rig / IK Rig pass for `phase_Skeleton` so hand,
   foot, pelvis, elbow, and knee effectors can be inspected visually.
3. Keep the existing `UPoseableMeshComponent` local pose as the stable fallback
   until a stricter rider pose gate passes.

## Local Asset Facts

- Lin Xia current mesh:
  `/Game/ParagonPhase/Characters/Heroes/Phase/Meshes/Phase_GDC.Phase_GDC`
- Lin Xia current skeleton:
  `/Game/ParagonPhase/Characters/Heroes/Phase/Meshes/phase_Skeleton`
- Existing Paragon Phase animation set has combat, locomotion, aim offset, and
  ability clips, but no dedicated seated / motorcycle riding animation.
- UE template Control Rig assets exist for Mannequin, not for Phase:
  `/Game/Characters/Mannequins/Rigs/CR_Mannequin_Body`
  and related mannequin rigs.
- `ControlRig` and `IKRig` are now explicitly enabled in the UE project.

## External Source Scan

- Rokoko free mocap: official page states the 263 free mocap pack can be used in
  animation, VFX, game, and 3D projects, including commercial use, and lists FBX
  plus Mixamo / Unreal / Human IK skeleton exports.
  Source: https://www.rokoko.com/resources/download-263-rokoko-motion-capture-assets
- Mixamo: official site provides a full-body character animation library and
  Adobe documentation describes uploading / rigging custom characters to apply
  animations.
  Sources:
  https://www.mixamo.com/
  https://helpx.adobe.com/creative-cloud/help/mixamo-rigging-animation.html
- Dedicated motorcycle riding mocap exists on marketplace sites, but license,
  cost, and account requirements must be checked before importing into this repo.

## Next Production Slice

Use the project as-is and do one of:

- Find or download a permitted seated riding FBX, then retarget it to
  `phase_Skeleton` in UE.
- If no source is immediately available, create a Phase-specific Control Rig /
  IK Rig asset and drive the current rider mesh from visible controls instead of
  C++ bone deltas.

## Acceptance Gate

After any animation / rig change:

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1 `
  -FullVisualQA `
  -StrictRiderPoseGate `
  -RiderPoseVerdict PASS
```

Do not mark AI-video continuity unblocked until this strict gate passes.
