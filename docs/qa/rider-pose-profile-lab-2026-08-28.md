# Rider Pose Profile Lab - 2026-08-28

## Goal

Improve production speed for Lin Xia motorcycle rider pose work by making pose
experiments reproducible from command-line captures.

## Result

```text
ENGINEERING TOOLING: PASS
RIDER POSE: CONDITIONAL
COMPACT PROFILE: REJECT
BARS PROFILE: REJECT
ASYMBARS PROFILE: REJECT
NEXT METHOD: seated animation source or UE Control Rig asset pass
```

## What Changed

- Added `-Pose` to `ue/Capture-LinxiaMotorcycleChase.ps1`.
- Added `-RiderPoseProfile` to `ue/Run-Gate3QualityCheck.ps1`.
- Added `ue/Test-LinxiaRiderPoseProfiles.ps1` to capture side / rear frames for
  multiple candidate profiles into ignored `Saved/Quality`.
- Added runtime logging for the selected rider pose profile.

## QA Findings

- `Default` remains the mainline fallback because it is stable and does not
  stretch limbs.
- `Compact` makes the rider read more seated, but arms lift toward the chest /
  head instead of the handlebars.
- `Bars` and `AsymBars` improve left / right separation in logs but fail the
  side silhouette: one arm still lifts too high and feet do not read as planted
  on pegs.

## Useful Capture Paths

```text
ue/NeonCleanerUE/Saved/Quality/linxia_pose_compact_side_2026-08-28.png
ue/NeonCleanerUE/Saved/Quality/linxia_pose_bars_side_2026-08-28.png
ue/NeonCleanerUE/Saved/Quality/linxia_pose_asymbars_side_2026-08-28.png
```

## Decision

Stop trying to solve the final rider pose through blind C++ local bone deltas.
The next production-quality path should be:

- import or create a seated motorcycle animation on a compatible skeleton, or
- build a UE Control Rig / IK Rig asset pass where effectors and pole vectors
  can be inspected visually.
