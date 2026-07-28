# Neon Cleaner UE PC Prototype - Day 1

## Goal

Create the first playable PC-side Unreal prototype for the project:

1. play an AI-generated cinematic clip at startup
2. keep the vehicle scene preloaded behind the clip
3. hand input back to the vehicle when the clip ends or the player clicks skip

## Current Engine State

- Local installed engine: `D:\Program Files\Epic Games\UE_5.0`
- Project is created from UE's Advanced Vehicle Blueprint template so the first prototype has a working vehicle immediately.
- Target engine for the production branch remains UE 5.8. This Day 1 project is upgrade-ready and should be converted after UE 5.8 is installed.

## Project Entry

Open:

```text
ue/NeonCleanerUE/NeonCleanerUE.uproject
```

Startup map:

```text
/Game/VehicleTemplate/Maps/VehicleExampleMap
```

Bridge movie:

```text
Content/Movies/NeonCleaner_A0_Bridge.mp4
```

## Local Playtest Build

Packaged Windows build:

```text
ue/Builds/Windows/NeonCleanerUE.exe
```

Convenience launcher:

```text
ue/Run-Day1-PC.bat
```

This build directory is intentionally ignored by Git because it is a local packaged artifact.

## Controls

- `W` / `S`: throttle and reverse
- `A` / `D`: steer
- `Space`: hand brake
- `Tab`: switch camera
- `Backspace`: reset vehicle
- `Take Control`: skip the bridge movie and hand control to the vehicle scene

## What Was Added

- `UNeonCinematicBridgeWidget`
  - Builds a fullscreen UMG video overlay in C++.
  - Plays `Content/Movies/NeonCleaner_A0_Bridge.mp4`.
  - Provides a `Take Control` skip button.

- `UNeonCinematicBridgeSubsystem`
  - Auto-runs when the game world begins play.
  - Shows the video overlay once per session.
  - Temporarily switches input to UI-only.
  - Restores game input when the movie ends.

## Verification

- Editor target builds successfully.
- Game target builds successfully.
- Windows packaged build completed successfully.

## Day 2 Direction

The next pass should replace the stock vehicle template level with a post-war San Francisco chase slice:

1. create a spline-driven elevated road
2. add storm lighting, wet road materials, fog, and magenta signal lights
3. replace stock car feel with a motorcycle / interceptor camera rig
4. add branch metrics: pursuit, stability, collision count, elapsed time
5. connect branch result to ending videos
