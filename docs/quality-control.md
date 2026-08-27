# Neon Cleaner Quality Control

This project uses repo-local quality gates so every PC and every Codex session
can judge progress from the same evidence.

## Core Rule

Do not advance a major production slice from memory or optimism. Advance only
after the repo contains:

- the implementation,
- the command used to verify it,
- the latest proof artifact when visual quality matters,
- a QA verdict: `PASS`, `CONDITIONAL PASS`, or `BLOCKED`.

## Gate 3 One-Command Check

For the playable Lin Xia motorcycle chase, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1
```

By default the proof capture is written under the ignored UE `Saved/Quality`
folder so routine QA does not dirty the Git worktree. To create a commit-worthy
proof frame, pass an explicit repository path:

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1 `
  -CaptureOutputPath .\source\reference\linxia\ue-captures\linxia_motorcycle_gate3_quality_<date>.png
```

For rider pose or IK changes, run the stricter multi-view check:

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1 -FullVisualQA
```

This command must pass before treating Gate 3 as recoverable. It checks:

- UE editor C++ build.
- `/Game/LinxiaChase/LVL_Linxia_MotorcycleChase` validation.
- Player 0 motorcycle possession.
- Automatic chase movement completion.
- Imported motorcycle visual yaw marker.
- Chase HUD binding.
- UE-rendered proof-frame creation.
- Proof-frame sanity: not blank, not mostly black, expected HUD colors visible.

With `-FullVisualQA`, it also captures side and rear rider QA frames so the pose
cannot pass only because the chase camera hides a bad silhouette.

The script may return `PASS` for engineering stability while still reporting a
`CONDITIONAL` art or animation limitation. That conditional note is important
and must not be hidden in status reports.

## Visual QA Rule

Screenshot sanity is not an art pass. A visual QA pass must inspect the proof
frame and record whether these are true:

- The motorcycle reads as driving forward along the route.
- The rider reads as Lin Xia / Phase and keeps identity continuity.
- The rider pose reads as seated, balanced, and intentional.
- Hands, feet, hips, and torso relate believably to bars, pegs, and seat.
- HUD text is readable on the current lighting.
- The frame is usable as an AI-video continuity reference.

Current Gate 3 visual verdict:

```text
PLAYABLE FEEDBACK: PASS
RIDER POSE: CONDITIONAL
AI VIDEO CONTINUITY: BLOCKED until seated riding animation or IK pass
```

## Efficiency Rule

Each work slice should be small enough to verify in the same session. Prefer:

- one feature or one quality fix,
- one automated validation command,
- one proof capture when visual,
- one doc update,
- one coherent commit.

Avoid starting AI video, character identity changes, environment dressing, and
vehicle handling changes in the same slice. Mixing them makes QA slow and hides
the real failure point.

## Report Rule

Progress reports should include both:

- what passed automatically,
- what remains conditional or blocked by visual QA.

Do not report a Gate as complete if the repo documents a conditional rider pose,
missing proof capture, unverified local Marketplace asset, or unpushed work.
