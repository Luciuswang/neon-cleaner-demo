# Linxia Rig Assets QA - 2026-08-28

## Scope

Started the asset-level rider animation route for Lin Xia. This pass creates
inspectable UE assets for Phase instead of continuing blind C++ bone tuning.

## Assets

- IK Rig: `/Game/LinxiaRig/IKR_Linxia_Phase`
- Control Rig: `/Game/LinxiaRig/CR_Linxia_Phase`
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
- Gate 3 map validation, rig validation, smoke test, HUD binding, visual
  alignment markers, and proof-frame sanity checks passed.

Proof frames are generated under ignored `ue/NeonCleanerUE/Saved/Quality/`.

## Verdict

Engineering and recoverability: PASS.

Rider pose: CONDITIONAL. This pass gives the project real rig assets to work
from, but does not yet provide a final seated motorcycle animation. The strict
rider pose gate must remain blocked until a seated FBX is retargeted or a
Control Rig pose is authored and reviewed from default / side / rear views.

## Next Step

Use `CR_Linxia_Phase` to author visible rider controls / effectors, or import a
permitted seated motorcycle FBX and retarget it through the Phase IK Rig.
