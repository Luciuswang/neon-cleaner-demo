# Gate 3 QA Report - 2026-08-27

## Scope

Playable Lin Xia motorcycle chase:

```text
/Game/LinxiaChase/LVL_Linxia_MotorcycleChase
```

## Automated Result

Command:

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1
```

Result: `PASS`.

Evidence:

- C++ build: passed.
- Map validation: passed.
- Player 0 possession: passed.
- Smoke chase movement: passed.
- Visual alignment marker: `bikeRot=R(0) riderRot=R(P=-11.00, Y=-90.00)`.
- UE proof capture: passed.
- Capture sanity metrics:
  - resolution `1280x720`
  - mean luminance `74.5`
  - non-black sample ratio `43.4%`
  - cyan HUD samples `16`
  - magenta HUD samples `15`

Proof frame:

```text
source/reference/linxia/ue-captures/linxia_motorcycle_gate3_quality_2026-08-27_123649.png
```

## QA Verdict

```text
PLAYABLE FEEDBACK: PASS
ENGINEERING RECOVERABILITY: PASS
RIDER POSE: CONDITIONAL
AI VIDEO CONTINUITY: BLOCKED
```

## Findings

- `P0`: Do not use the current rider pose as a final AI-video continuity
  reference. It reads as a prototype pose rather than a real seated motorcycle
  animation.
- `P1`: Hands, torso, hips, and feet are not yet locked to believable riding
  contact points. A seated riding animation, Control Rig, or IK pass is needed.
- `P1`: The chase is readable, but the route and target are still prototype
  shapes. This is acceptable for gameplay iteration, not for external visual
  presentation.
- `P2`: The HUD is now readable and should remain part of every playable proof
  capture until there is a stronger in-game feedback system.

## Next Required Slice

Producer should build only one of these next:

```text
Rider animation / IK pass
```

Acceptance criteria:

- Lin Xia reads as seated on the motorcycle from rear, rear-three-quarter, and
  side proof captures.
- Hands align to handlebar contact points.
- Feet align near pegs or foot supports.
- Torso forward lean looks intentional and balanced, not collapsed.
- Motorcycle keeps pawn-forward alignment while moving.
- `Run-Gate3QualityCheck.ps1` still passes.

No AI-video regeneration should start before this slice receives QA `PASS`.
