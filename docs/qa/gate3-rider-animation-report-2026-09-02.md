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

## Next Step

Author an explicit contact pass through `CR_Linxia_Phase` or an imported seated
motorcycle animation source on `phase_Skeleton`, then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1 `
  -FullVisualQA `
  -StrictRiderPoseGate `
  -RiderPoseVerdict PASS
```
