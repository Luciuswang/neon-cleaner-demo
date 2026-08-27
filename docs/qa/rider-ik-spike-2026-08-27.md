# Rider IK Spike - 2026-08-27

## Goal

Improve Lin Xia's motorcycle rider pose without changing the source character,
motorcycle mesh, player input, or camera behavior.

## Result

```text
ENGINEERING: PASS
RIDER POSE: CONDITIONAL
DIRECT LEAF-BONE IK: REJECTED
NEXT METHOD: seated animation / Control Rig / two-bone IK
```

## What Was Tried

- Added stricter rider QA capture modes:
  - `Default`
  - `Side`
  - `Rear`
- Tested direct component-space locking for `hand_l`, `hand_r`, `foot_l`, and
  `foot_r`.
- QA rejected that approach because leaf-bone translation stretched limbs
  instead of solving the full arm / leg chains.
- Removed the direct position locks.
- Kept a safer local bone-space riding pose:
  - rider relative pitch `4`
  - stronger but conservative arm bend
  - conservative leg bend
  - runtime contact-pose logging for hands and feet

## Verification

Command:

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1 -SkipBuild -FullVisualQA
```

Result: `PASS`.

Smoke markers:

```text
[LinxiaMotorcycle] Visual alignment bikeRot=R(0) riderRot=R(P=4.00, Y=-90.00)
[LinxiaMotorcycle] Rider contact pose handL=V(X=-16.85, Y=5.96, Z=116.86) handR=V(X=-14.07, Y=-10.60, Z=111.03) footL=V(X=-24.22, Y=-2.73, Z=22.18) footR=V(X=-83.09, Y=-13.87, Z=67.56)
```

## QA Notes

- Default chase camera reads better than the previous collapsed / reclining
  pose.
- Side view confirms the rider is seated on the bike, but not yet in a strong
  sport-riding pose.
- Rear view confirms the pose remains prototype quality and is not suitable for
  final AI-video continuity.

## Next Slice

Do not continue tuning by moving only hand or foot leaf bones. The next quality
step should use one of:

- a proper seated motorcycle FBX animation retargeted to `phase_Skeleton`,
- a Control Rig with pelvis, hand, and foot effectors,
- a small C++ two-bone IK solver for upper/lower arms and thighs/calves.

Acceptance criteria remain:

- hands read as reaching the bars,
- feet read as near pegs,
- torso leans forward intentionally,
- no limb stretching,
- `Run-Gate3QualityCheck.ps1 -FullVisualQA` passes.
