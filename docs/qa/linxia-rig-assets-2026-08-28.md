# Linxia Rig Assets QA - 2026-08-28

## Scope

Started the asset-level rider animation route for Lin Xia. This pass creates
inspectable UE assets for Phase instead of continuing blind C++ bone tuning.

## Assets

- IK Rig: `/Game/LinxiaRig/IKR_Linxia_Phase`
- Control Rig: `/Game/LinxiaRig/CR_Linxia_Phase`
- Ride animation: `/Game/LinxiaRig/Animations/AN_Linxia_MotorcycleRide_Idle`
- Source mesh:
  `/Game/ParagonPhase/Characters/Heroes/Phase/Meshes/Phase_GDC.Phase_GDC`

## Validation

Commands:

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Setup-LinxiaRigAssets.ps1 -ValidateOnly
powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1 -SkipBuild -FullVisualQA -RiderPoseProfile Default
```

Results:

- `IKR_Linxia_Phase` loads, uses retarget root `pelvis`, and exposes critical
  arm / leg chains.
- `CR_Linxia_Phase` loads, uses the Phase preview mesh, and instantiates with
  the required Phase bones.
- `AN_Linxia_MotorcycleRide_Idle` loads, uses the Phase skeleton, is 1 second
  long, and exposes the required rider pose tracks.
- Gate 3 map validation, rig validation, smoke test, HUD binding, visual
  alignment markers, and proof-frame sanity checks passed.

Proof frames are generated under ignored `ue/NeonCleanerUE/Saved/Quality/`.

## Verdict

Engineering and recoverability: PASS.

Playable ride animation: CONDITIONAL PASS. The runtime now uses
`USkeletalMeshComponent` and plays `AN_Linxia_MotorcycleRide_Idle`, so the rider
pose is an asset rather than runtime-only C++ bone deltas.

AI-video continuity: BLOCKED. The current animation is a generated first pass;
side and rear views still need cleaner hand-bar and leg-bike contact before the
strict rider pose gate should be marked PASS.

## Next Step

Use `CR_Linxia_Phase` to author visible rider controls / effectors, or import a
permitted seated motorcycle FBX and retarget it through the Phase IK Rig.
