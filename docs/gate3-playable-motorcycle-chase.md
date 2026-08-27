# Gate 3 - Playable Lin Xia Motorcycle Chase

Status: `PLAYABLE PROTOTYPE PASS / RIDER POSE CONDITIONAL`.

## Current Result

- Runtime map: `/Game/LinxiaChase/LVL_Linxia_MotorcycleChase`.
- Player pawn: `/Script/NeonCleanerUE.LinxiaMotorcyclePawn`.
- Game mode: `/Script/NeonCleanerUE.LinxiaMotorcycleChaseGameMode`.
- Player 0 controls the motorcycle pawn directly.
- Controls:
  - `W/S`: accelerate / brake.
  - `A/D`: steer.
  - Mouse: camera yaw / pitch.
  - `Space`: brake.
  - `R` or `Backspace`: reset.
- HUD:
  - Speed readout.
  - Target distance.
  - Pursuit / caught status.
  - Control reminder with a dark readability strip.
- Chase route includes a readable forward lane, five obstacle beats, and a visible target ahead.

## Motorcycle Asset

The prototype now uses the previously created high-quality vehicle asset instead
of the blockout proxy.

Source asset:

- `web/models/player-motorcycle.glb`
- `web/models/player-motorcycle-obj/model_1781781224363_obj.obj`
- `web/models/player-motorcycle-obj/textures/*`

Imported UE assets:

- `/Game/LinxiaChase/Imported/SM_PlayerMotorcycle`
- `/Game/LinxiaChase/Imported/TEX_Color_68fa4d52-54ee-46b9-af70-22149dd48be6`
- `/Game/LinxiaChase/Imported/TEX_NormalGL_68fa4d52-54ee-46b9-af70-22149dd48be6`
- `/Game/LinxiaChase/Imported/TEX_ORM_68fa4d52-54ee-46b9-af70-22149dd48be6`

Import command:

```powershell
& "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" `
  "E:\codex_project\neon-cleaner-demo\ue\NeonCleanerUE\NeonCleanerUE.uproject" `
  -unattended -nop4 -nosplash `
  -ExecutePythonScript="E:\codex_project\neon-cleaner-demo\ue\scripts\import_player_motorcycle_asset.py"
```

## Build / Validate / Run

Build:

```powershell
& "C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat" `
  NeonCleanerUEEditor Win64 Development `
  -Project="E:\codex_project\neon-cleaner-demo\ue\NeonCleanerUE\NeonCleanerUE.uproject" `
  -WaitMutex
```

Recreate and validate the map:

```powershell
& "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" `
  "E:\codex_project\neon-cleaner-demo\ue\NeonCleanerUE\NeonCleanerUE.uproject" `
  -unattended -nop4 -nosplash `
  -ExecutePythonScript="E:\codex_project\neon-cleaner-demo\ue\scripts\create_linxia_motorcycle_chase_level.py"

& "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" `
  "E:\codex_project\neon-cleaner-demo\ue\NeonCleanerUE\NeonCleanerUE.uproject" `
  -unattended -nop4 -nosplash `
  -ExecutePythonScript="E:\codex_project\neon-cleaner-demo\ue\scripts\validate_linxia_motorcycle_chase_level.py"
```

Smoke test:

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\SmokeTest-LinxiaMotorcycleChase.ps1
```

Run in a visible window:

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Run-LinxiaMotorcycleChase.ps1
```

Capture a reproducible UE-rendered proof frame:

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Capture-LinxiaMotorcycleChase.ps1
```

Run the full Gate 3 quality check:

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1
```

## Latest Verification

- C++ build succeeded.
- `validate_linxia_motorcycle_chase_level.py` passed.
- Validation confirmed:
  - `rider_mesh=/Game/ParagonPhase/Characters/Heroes/Phase/Meshes/Phase_GDC.Phase_GDC`
  - `motorcycle_mesh=/Game/LinxiaChase/Imported/SM_PlayerMotorcycle.SM_PlayerMotorcycle`
  - `motorcycle_relative_yaw=0.0`
  - `target_distance=4363.3`
  - `obstacle_count=5`
- Smoke test passed:
  - `Player0 now controls LinxiaMotorcyclePawn_0`
  - `Visual alignment bikeRot=R(0) riderRot=R(P=-11.00, Y=-90.00)`
  - `LinxiaMotorcycleSmokeTest Completed distance=6954.2 targetDistance=3235.6 speed=2049.9`
- 2026-08-26 update:
  - Added `ALinxiaMotorcycleHud` and set it as the chase game mode HUD.
  - Added `ue/Capture-LinxiaMotorcycleChase.ps1`, which uses UE's own screenshot request path instead of unreliable Windows foreground capture.
  - Visual QA proof frame:
    `source/reference/linxia/ue-captures/linxia_motorcycle_capture_2026-08-26.png`
- 2026-08-27 update:
  - Added `ue/Run-Gate3QualityCheck.ps1` as the one-command quality gate for build, validation, smoke, UE proof capture, and proof-frame sanity checks.
  - QA report:
    `docs/qa/gate3-quality-report-2026-08-27.md`
  - Latest proof frame:
    `source/reference/linxia/ue-captures/linxia_motorcycle_gate3_quality_2026-08-27_123649.png`
- 2026-08-25 update:
  - Imported motorcycle relative yaw changed from `90` to `0` to align the vehicle with pawn forward movement.
  - `validate_linxia_motorcycle_chase_level.py` now fails if the imported motorcycle yaw drifts away from `0` or the Phase rider yaw drifts away from `270` / `-90`.
  - `SmokeTest-LinxiaMotorcycleChase.ps1` now prints the visual alignment marker.
- Visual check retained:
  - `source/reference/linxia/ue-captures/linxia_motorcycle_imported_asset_check3_2026-08-24.png`

## Known Limitation

`Paragon: Phase` is a normal combat character with a valid skeleton and many
combat / locomotion animations, but no motorcycle / seated / riding animation
was found in the local asset set.

The current rider pose now uses `UPoseableMeshComponent` with local
bone-space deltas copied from the Phase reference pose. This avoids the earlier
component-space pose failure that could rotate the whole character sideways.
It has passed background build / validation / smoke tests. A visual QA pass is
now captured by `Run-Gate3QualityCheck.ps1`, but the rider pose remains a
prototype-quality conditional rather than an AI-video-ready animation.

Next quality step:

- Import or create a seated motorcycle rider animation.
- Retarget it onto `phase_Skeleton`.
- Replace or refine the local rider pose in `ALinxiaMotorcyclePawn`.
- Re-run visual QA before using this frame as the final AI-video continuity
reference.
