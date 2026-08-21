# UE Install Checklist

Last updated: 2026-08-20

## Installed Locally

- Epic Games Launcher: installed and running.
- Visual Studio Build Tools 2022: installed.
- MSVC C++ toolchain: installed.
- Windows 11 SDK 22621: requested during Build Tools install.
- UE 5.8.1 installation started through Epic Games Launcher.
- Install path selected: `C:\Program Files\Epic Games\UE_5.8`.
- MetaHuman Creator Core Data was enabled in install options.
- Fab UE Plugin / Quixel Bridge were queued by the Launcher.

## Install UE From Epic Games Launcher

Open Epic Games Launcher:

```text
Unreal Engine -> Library -> Engine Versions -> Add (+)
```

Recommended:

- Install the latest stable UE5 available in the Launcher.
- Use D drive for the engine install if possible.
- Click `Options` before installing.

Enable these options:

- Starter Content
- Templates and Feature Packs
- MetaHuman Creator Core Data
- Editor symbols only if you have extra space and need deep debugging

## After UE Is Installed

Open:

```text
E:\codex_project\neon-cleaner-demo\ue\NeonCleanerUE\NeonCleanerUE.uproject
```

Or run:

```powershell
powershell -ExecutionPolicy Bypass -File E:\codex_project\neon-cleaner-demo\ue\Open-NeonCleanerUE.ps1 -Log
```

Expected first-open behavior:

- UE may ask to rebuild C++ modules.
- Accept rebuild.
- If it asks for engine version conversion, create a copy only if testing a new
  major/minor engine version.

## Character Creation First Pass

Inside UE:

1. Enable MetaHuman Creator plugin.
2. Create a new MetaHuman Character asset for `Heroine_v01`.
3. Keep the first pass simple and game-readable.
4. Capture UE references before generating any new AI video.
