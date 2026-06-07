# Marble MVP Experiment

Goal: test whether World Labs / Marble-style 3D worlds can become the playable takeover layer for `Neon Cleaner`.

## Experiment 1

Use Marble to create a navigable `A0 / I1` world:

```text
post-war future San Francisco, rainy night, broken elevated rails, damaged towers,
smoke columns, wet reflective streets, emergency glows, ruined drones, armored
convoy chase route, grounded cinematic sci-fi war drama
```

Then export:

```text
web/worlds/a0-war-signal-500k.spz
web/worlds/a0-war-signal-collider.glb
```

The prototype page is:

```text
web/world-prototype.html
```

If `web/worlds/a0-war-signal-500k.spz` is missing, the page shows a local low-poly proxy scene instead of a real Marble world. This keeps mobile/control testing honest while making the missing asset obvious.

It currently tests:

- SparkJS / Three.js splat rendering in browser.
- A lightweight chase camera.
- Desktop and mobile control input.
- Branch readout: `C1`, `C2`, or `C3`.

## Preparation

1. Create a World Labs / Marble account.
2. Buy API credits on the World Labs Platform, not only inside the Marble web app.
3. Create an API key.
4. Store the key in an environment variable:

```powershell
$env:WORLDLABS_API_KEY = "your_api_key"
```

Alternative variable name:

```powershell
$env:WLT_API_KEY = "your_api_key"
```

## Generate with API

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\worldlabs\generate_text_world.ps1
```

The script saves the returned world metadata to:

```text
web/worlds/a0-war-signal-world.json
```

If the API response includes downloadable splat and collider URLs, it also saves:

```text
web/worlds/a0-war-signal-500k.spz
web/worlds/a0-war-signal-collider.glb
```

## Manual Marble workflow

If using the Marble web UI instead of API:

1. Generate the world from the prompt above.
2. Download the 500k SPZ export.
3. Rename it to `a0-war-signal-500k.spz`.
4. Put it in `web/worlds/`.
5. Reload `web/world-prototype.html`.

## Success criteria

- The scene loads on desktop and phone.
- Camera movement feels like entering the film world, not a separate mini-game.
- The world has readable depth and scale.
- The asset is light enough for mobile.
- We can later add collider mesh physics without redesigning the page.

## Phone testing

Local network test URLs for this machine:

```text
http://192.168.1.23:5177/world-prototype.html
http://192.168.180.23:5177/world-prototype.html
```

Use a phone on the same network. If neither opens, Windows firewall or network isolation is blocking the local server; use the GitHub Pages URL after pushing instead.

Public test URL:

```text
https://luciuswang.github.io/neon-cleaner-demo/web/world-prototype.html
```

## Known limits

- Marble is best used for environments, not the heroine character.
- The first MVP uses visual splats and simple chase scoring before full collision.
- True driving physics should wait until we have a collider mesh.
