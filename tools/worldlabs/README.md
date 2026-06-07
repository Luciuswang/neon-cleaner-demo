# World Labs / Marble tools

This folder contains helper scripts for generating Marble worlds for the `Neon Cleaner` prototype.

## API key

Set one of these variables before running the scripts:

```powershell
$env:WORLDLABS_API_KEY = "your_api_key"
```

or:

```powershell
$env:WLT_API_KEY = "your_api_key"
```

Do not commit API keys to the repo.

## Generate the first world

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\worldlabs\generate_text_world.ps1
```

Expected output:

```text
web/worlds/a0-war-signal-world.json
web/worlds/a0-war-signal-500k.spz
web/worlds/a0-war-signal-collider.glb
```

## Local key helpers

Set the API key interactively without committing it:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\worldlabs\set_api_key.ps1
```

Check whether this machine can read the key:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\worldlabs\check_api_key.ps1
```
