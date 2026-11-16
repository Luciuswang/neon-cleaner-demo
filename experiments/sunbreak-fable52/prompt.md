# SUNBREAK — FPS art-direction control experiment

Build a polished, playable first-person browser shooter named SUNBREAK.
The purpose is to demonstrate controllable art direction using Fable 5.2.
Deliver index.html, README.md and a concise verification.json in this directory.
Use Three.js pinned to a specific CDN version. Generate geometry, textures and
audio procedurally. Do not load external models, image assets or audio samples.
Keep the scope small enough to polish: one tropical coastal training courtyard,
one detailed assault rifle with visible gloved hands, six humanoid opponents,
and a short replayable encounter. No networking or battle royale systems.

## Primary art direction: tropical competitive shooter

Use Free Fire as a broad art-direction reference: approachable semi-realism,
sunny tropical locations, contemporary streetwear and readable competitive
action. Create original designs. Avoid using its logos, characters or UI assets.

- Bright azure sky (#4CBFE8), turquoise water (#20B6AE), warm sand (#E6C88A),
  leafy green (#538F48), coral accents (#F26955), charcoal weapons (#26323C).
- Warm afternoon key light, cool sky fill, soft readable shadows; preserve
  color in shaded surfaces. Exposure must not bleach the sand or sky.
- Tropical coastal outpost: painted stucco buildings, terracotta roofing,
  cyan doors, railings, palms, shipping crates, cloth awnings and ocean beyond.
- Believable human-scale proportions with broad, clean silhouettes. Restrained
  surface wear, selective material detail and clear roughness differences.
  Avoid voxel blocks, faceted toy geometry and dense muddy noise.
- Rifle: convincing receiver, barrel, rail, magazine, sight and stock with
  matte metal/polymer, coral/turquoise panels and restrained graphic markings.
  Hands visibly grip the weapon, with a readable reload animation.
- Enemies: articulated humanoid silhouettes, original streetwear/tactical
  clothing, distinguishable heads, torsos and limbs, simple locomotion and
  hit reactions. Avoid floating drones as the main opponents.
- VFX: brief orange muzzle flash, subtle dust, bright hit marker, readable
  damage numbers, controlled bloom. Effects must not hide the target.
- HUD: crisp white type, charcoal translucent panels, orange/yellow action
  accents, compact health/ammo/remaining-enemy indicators. Chinese controls.

## Demonstrate control with a reversible comparison

The default view must be the tropical style above. Add an accessible on-screen
style button and a V shortcut switching between "热带竞技" and "冷调工业".
The comparison changes palette, lighting, fog, material finish, weapon accent
colors, HUD treatment and VFX color in the SAME scene. Do not rebuild the map,
randomize enemies, reset health/ammo, move the camera or alter collision and
damage rules when switching. The industrial style has desaturated concrete,
cool directional light and restrained amber signals; keep it legible.

Add a presentation mode that freezes simulation and permits style switching at
an identical camera pose. Explain that this is a configurable art-direction
demonstration, not proof of reliability across independent generation runs.
Centralize the two art-direction presets in readable configuration objects.

## Playability

WASD move; mouse look; left click fire; right click aim; R reload; Shift sprint;
Space jump; Esc pause; restart after victory or defeat. A clear start screen
must explain controls and require user action before pointer lock or audio.
Enemies patrol, see the player, approach and fire with understandable telegraphs.
Use world collision, wall occlusion for gunfire, finite magazine/reload timing,
player damage, enemy deaths, victory/defeat and a reliable full restart.
Pause on pointer-lock loss and window blur. Bound frame delta after inactivity.
Provide fallback UI for failed CDN/WebGL/pointer-lock initialization.

## Verification and reporting

Use offscreen browser rendering for this standalone web experiment; never take
desktop screenshots or focus/click native windows. If appropriate browser tools
are unavailable, report the limitation rather than claiming visual validation.
Verify startup, movement/collision, aiming, shooting/occlusion, reload, enemy
damage, both outcomes, pause/restart and reversible style switching. Compare
both styles at identical camera pose and game state. Inspect actual rendered
frames for silhouette, color, shadows, materials, weapon/hands and HUD clarity.
Record actual WebGL renderer, viewport and any measured frame times; do not
claim performance based on a fixed-timestep render. Inspect generated audio
for clipping/silence and state "未经人耳试听" unless actually auditioned.
Report producer model from invocation metadata, not a model's self-description.
Do not claim completion, QA pass, cost or elapsed time without evidence.
