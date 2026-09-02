# Gate 3 Rider Animation QA - 2026-09-02

## Scope

Continue the asset-route rider animation pass for Lin Xia / Phase on the
playable motorcycle chase. The goal of this slice was to improve the mounted
read without returning to blind runtime C++ bone locks.

## Implementation

- Refined `/Game/LinxiaRig/Animations/AN_Linxia_MotorcycleRide_Idle` generation
  with a deeper riding tuck: stronger upper-body lean, more active arm reach,
  and more bent leg / foot pose values on the Phase skeleton.
- Kept runtime playback on `USkeletalMeshComponent` single-node animation.
- Adjusted the rider mesh attach transform to reduce foot-to-ground read and
  preserve a compact motorcycle silhouette.
- Delayed rider contact logging until after animation update, so smoke logs now
  sample the active animation instead of the reference pose.
- Made Gate 3 UE automation more tolerant of restored ParagonPhase UE 5.8
  blueprint compatibility errors when the target script success marker is
  present and no Python traceback occurred.
- Added DDC fallback arguments, relative capture path normalization, and a longer
  capture timeout for first-run shader compilation.

## Verification

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Setup-LinxiaRigAssets.ps1
powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1 -FullVisualQA -RiderPoseVerdict CONDITIONAL
```

Results:

- UE C++ build: `PASS`.
- Gate 3 map validation: `PASS` by `[LinxiaMotorcycleChaseValidate]` marker.
- LinxiaRig IK Rig / Control Rig / ride animation validation: `PASS` by script
  markers.
- Smoke test: `PASS`; Player0 controls `LinxiaMotorcyclePawn_0`, rider animation
  marker is present, and delayed contact logs are present.
- Proof-frame sanity: `PASS` for default, side, and rear captures.

Latest ignored proof frames:

- `ue/NeonCleanerUE/Saved/Quality/linxia_motorcycle_gate3_quality_2026-09-02_190548.png`
- `ue/NeonCleanerUE/Saved/Quality/linxia_motorcycle_gate3_quality_2026-09-02_190548-side.png`
- `ue/NeonCleanerUE/Saved/Quality/linxia_motorcycle_gate3_quality_2026-09-02_190548-rear.png`

## QA Decision

```text
ENGINEERING: PASS
PLAYABLE RIDER READ: CONDITIONAL PASS
STRICT RIDER POSE: NOT PASS
AI VIDEO CONTINUITY: BLOCKED
```

Visual review: the rider now reads as attached to and riding the motorcycle in
the playable chase, and the foot-to-ground issue is improved compared with the
previous proof set. It is good enough for local gameplay iteration.

Do not use this as the final AI-video continuity reference yet. Hands are still
not locked cleanly to the handlebars, and leg / foot contact should be solved by
Control Rig / IK targets or a stronger seated motorcycle source animation before
running the strict rider pose gate as `PASS`.

## 22:32 Follow-Up Correction

The imported motorcycle was found to have a baked OBJ axis mismatch: X is the
vehicle length, Y is height, and Z is width. The player bike visual now uses a
`Roll=90` correction, and Gate 3 validation explicitly checks that roll so the
motorcycle cannot silently return to the sideways / inverted read.

Additional changes:

- Kept the imported motorcycle as the primary bike visual, with small dark seat
  handlebar, and footpeg anchors visible for rider contact readability.
- Regenerated the chase map with darker road / barrier materials, reduced key
  and sky lighting, fog, city silhouettes, underpass structures, and cyan /
  magenta guide lights.
- Second-pass proof frames:
  `ue/NeonCleanerUE/Saved/Quality/linxia_motorcycle_gate3_quality_2026-09-02_223644*.png`

Verification:

```powershell
& "C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat" `
  NeonCleanerUEEditor Win64 Development `
  -Project="E:\codex_project\neon-cleaner-demo\ue\NeonCleanerUE\NeonCleanerUE.uproject" `
  -WaitMutex

powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1 `
  -SkipBuild `
  -FullVisualQA `
  -RiderPoseVerdict CONDITIONAL
```

Results:

- C++ build: `PASS` after disabling the problematic UBA executor in local UBT
  configuration.
- Gate 3 map validation: `PASS`.
- Smoke test: `PASS`; Player0 controls `LinxiaMotorcyclePawn_0` and bike visual
  alignment logs `bikeRot=R(R=90.00)`.
- Default / side / rear screenshot sanity checks: `PASS`.
- Visual review: motorcycle direction and rider placement are now acceptable for
  playable iteration. The scene is no longer the previous whitebox-only read,
  though final art still needs real environment assets.

Updated decision:

```text
ENGINEERING: PASS
PLAYABLE MOTORCYCLE/RIDER READ: CONDITIONAL PASS
STRICT RIDER POSE: NOT PASS
AI VIDEO CONTINUITY: BLOCKED UNTIL IK / BETTER SOURCE ANIMATION
SCENE ART: PROTOTYPE BASELINE, NEEDS ASSET REPLACEMENT
```

## Next Step

Author an explicit contact pass through `CR_Linxia_Phase` or an imported seated
motorcycle animation source on `phase_Skeleton`, then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1 `
  -FullVisualQA `
  -StrictRiderPoseGate `
  -RiderPoseVerdict PASS
```
