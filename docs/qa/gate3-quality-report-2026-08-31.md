# Gate 3 QA Report - 2026-08-31

## Task

`G3-RIDER-POSE Strict Visual QA`

## Automated Check

Command:

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1 `
  -SkipBuild `
  -FullVisualQA `
  -RiderPoseVerdict CONDITIONAL
```

Result: `BLOCKED` during map validation, after the local UE toolchain and
compiled game module were restored.

Observed blockers:

- The full UE 5.8 editor build now passes with Visual Studio Build Tools 2022
  17.14.39, MSVC 14.44, Windows SDK 10.0.26100.0, and .NET Framework
  Developer Pack 4.8.1. `UnrealEditor-NeonCleanerUE.dll` is present.
- The validation command now reaches
  `validate_linxia_motorcycle_chase_level.py` correctly even though the repo
  path contains spaces. The PowerShell wrappers were fixed to use UE's
  `-run=pythonscript -script=` commandlet form.
- `ParagonPhase` Marketplace content is still missing locally. The validator
  reports the missing `Phase_GDC` skeletal mesh and `Phase_AnimBlueprint`, so
  the Lin Xia rider cannot pass construction or animation validation.

The command did not produce new default/side/rear captures because the required
Phase assets are not available yet.

## Existing Visual Evidence

The latest committed proof frame is:

```text
source/reference/linxia/ue-captures/linxia_motorcycle_gate3_quality_2026-08-27_123649.png
```

Human visual read of that frame:

- Playable route, HUD, target marker, and motorcycle silhouette are readable.
- Lighting is too overexposed for a strong AI-video continuity reference.
- The frame does not prove believable hand-to-bar, hip-to-seat, or leg-to-peg
  contact from a strict multi-view review.
- Rider pose remains suitable only for the existing playable prototype
  condition, not a strict continuity pass.

## Verdict

```text
ENGINEERING: BLOCKED by missing local ParagonPhase content
VISUAL: CONDITIONAL based on existing single proof frame
AI VIDEO CONTINUITY: BLOCKED
```

Do not dispatch a new pose implementation from this result. First restore the
environment, then run the full check with default/side/rear captures and use
an explicit `PASS` only after a human visual review confirms rider contact and
balance.

## Unblock Plan

1. Restore `Paragon: Phase` from Epic/Fab into the local UE project.
2. Run Gate 3 once without `-SkipBuild`.
3. Run `-FullVisualQA` and inspect default, side, and rear frames.
4. Only then decide whether one bounded animation/Control Rig writer task is
   justified.
