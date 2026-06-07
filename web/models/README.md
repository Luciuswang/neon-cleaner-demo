# Vehicle Model Drop Folder

Put AI-generated GLB vehicle assets here:

- `player-cockpit.glb`: first-person cockpit/hood/dash asset, attached to the camera.
- `enemy-car.glb`: exterior enemy chase car, placed ahead on the driving path.

The page loads these files automatically when they exist. If a file is missing, it falls back to the built-in low-poly placeholder.

## Export Requirements

- Format: `.glb`
- Keep each file under roughly 10-20 MB for mobile testing.
- Use baked PBR textures if possible.
- Avoid huge transparent surfaces and dense hair/fabric simulations.
- Make the model front face `-Z`.
- Put the model origin at the vehicle center.
- Use real-world scale where possible: enemy car length around 2.5-3.2 units.

## Enemy Car Prompt

Create a cinematic sci-fi pursuit vehicle for a post-war San Francisco street chase. Compact armored electric muscle car, low wide stance, realistic hard-surface panels, damaged matte black graphite body, magenta emergency light strips, cyan headlights, visible wheels, battle scratches, wet reflective material response, no driver, no readable logos, no text, no weapons protruding too far, game-ready low/mid poly, PBR textures, front of vehicle facing negative Z, centered at origin, exported as GLB.

## Player Cockpit Prompt

Create a first-person cinematic racing cockpit interior for a damaged futuristic pursuit car. Low dashboard, partial steering wheel, windshield frame, angular hood visible at the bottom of the camera, magenta instrument glow, cyan HUD light strips, dark graphite and black carbon material, rain-streaked glass detail, battle-worn but not cluttered, open forward view, no readable text, no logos, game-ready low/mid poly, PBR textures, forward direction facing negative Z, centered for first-person camera, exported as GLB.

## Useful URL Parameters

- `?enemy=./models/my-enemy.glb`
- `?cockpit=./models/my-cockpit.glb`
- `?enemyScale=0.8`
- `?cockpitScale=1.2`
- `?camera=chase` to inspect the full player car.

