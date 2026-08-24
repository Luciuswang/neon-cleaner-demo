# Gate 2 Rider / Motorcycle Proxy

Date: 2026-08-24

## Purpose

Create the smallest recoverable UE slice that reads as Lin Xia on a black
electric motorcycle from rear, side, and rear-three-quarter review cameras.
This is a production proxy for Gate 2 QA, not a final riding system.

## Assets Created By Script

Run:

```powershell
& "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" `
  "E:\codex_project\neon-cleaner-demo\ue\NeonCleanerUE\NeonCleanerUE.uproject" `
  -unattended -nop4 -nosplash `
  -ExecutePythonScript="E:\codex_project\neon-cleaner-demo\ue\scripts\create_linxia_rider_proxy_level.py"
```

Generated level:

```text
/Game/LinxiaRiderProxy/LVL_Linxia_RiderProxy
```

Main actors:

```text
Linxia_RiderProxy_Phase
Linxia_RiderRuntimePawn_Phase
NC_Motorcycle_FrontWheel
NC_Motorcycle_RearWheel
NC_Motorcycle_BatterySpine
NC_Motorcycle_Seat
NC_Motorcycle_Handlebar
Linxia_Rider_HandoffCamera
Linxia_Rider_SideCamera
Linxia_Rider_RearCamera
```

## Validation

Run:

```powershell
& "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" `
  "E:\codex_project\neon-cleaner-demo\ue\NeonCleanerUE\NeonCleanerUE.uproject" `
  -unattended -nop4 -nosplash `
  -ExecutePythonScript="E:\codex_project\neon-cleaner-demo\ue\scripts\validate_linxia_rider_proxy_level.py"
```

Current validation passed with:

```text
Rider mesh: /Game/ParagonPhase/Characters/Heroes/Phase/Meshes/Phase_GDC.Phase_GDC
Visible pose rider root: (-54, 0, 8)
Runtime Player0 pawn: (-54, 0, 84)
Motorcycle wheelbase: 292.0
Front wheel z: 43.0
Rear wheel z: 43.0
Handoff camera: low rear-three-quarter, FOV 36
```

Capture:

```powershell
.\ue\Capture-LinxiaRiderProxy.ps1
```

Current capture:

```text
source/reference/linxia/ue-captures/linxia_rider_proxy_handoff_2026-08-24.png
```

The capture script crops the editor viewport and enters Game View before
capturing, so the proof image no longer includes the Unreal menu bar, side
panels, light icons, or selection outlines.

## Producer Notes

- `PlayablePhaseCharacter` was not modified.
- The visible review rider is a `PoseableMeshComponent` using the same Phase
  mesh; a hidden `Linxia_RiderRuntimePawn_Phase` remains auto-possessed by
  Player 0 as the runtime anchor.
- The proxy uses Engine BasicShapes and generated project materials, so it does
  not add new third-party vehicle content.
- The current rider pose is still a silhouette proxy. It is better for judging
  scale, camera direction, and handoff composition, but not enough for final
  rider animation or AI video generation.
- `ue/scripts/inspect_phase_bones.py` logs the key Phase skeleton bone names
  for the next pose pass.
- Do not restart AI still or video generation until QA reviews this level and a
  UE reference capture pack exists.
