# SUNBREAK: After Rain

An isolated realistic-rendering iteration of the preserved Fable 5.2 FPS.
The original remains in `../sunbreak-fable52/` without modifications.

## Run

```powershell
node experiments/sunbreak-realistic-v2/serve.mjs
```

Open `http://127.0.0.1:5187/`. First load requires access to the pinned
Three.js 0.160 CDN. All surface maps and HDR environment are local.

Separate comparison pages, served concurrently:

- Realistic / recorded-audio version: `http://127.0.0.1:5187/`
- Earliest unchanged demo: `http://127.0.0.1:5187/original/`

The latter serves the original file's exact bytes, without audio changes,
injection or rewriting. A link in the realistic version's menu opens it in
another tab. Neither version overwrites the other.

WASD moves, mouse or arrows look, left mouse/F fires, right mouse aims,
R reloads, Shift sprints, Space jumps, P/Escape pauses, V changes lighting,
T changes weather, and G freezes the scene for inspection. Mouse dragging
is the fallback when pointer lock is unavailable. This is a desktop-input
demo; narrow-screen layout verification does not imply touch controls.

## What Changed

- Local CC0 color, normal and roughness maps plus an HDR environment.
- Directional shadow maps, ambient occlusion and masked planar puddle reflections.
- Daylight, overcast and rain; animated foliage and camera-local rainfall.
- Recessed windows, soffits, tile geometry, drainage, signs and background facades.
- A more detailed first-person carbine, gloves and sleeves.
- Gateway production and independent gameplay/art review.
- Local CC0 AR-15/M4 recordings, mechanical reload effects, quiet hit-confirm
  cue, distance filtering and stereo direction for enemy fire.
- Gesture-unlocked audio with volume/mute, bounded voices and pause/focus
  cancellation. If samples or Web Audio fail, gameplay remains available;
  no synthesized gunshot fallback. Start at a moderate device volume.

Audio sources, credits, archive/member hashes and reproducible preparation:
`assets/audio/NOTICE.md`, `assets/audio/manifest.json`, `tools/prepare-audio.py`.
Playback variation uses an independent seed and does not alter combat RNG.
The near and mid perspectives are two recorded singles, not many unique takes.

This is rasterized WebGL, not hardware ray tracing, Lumen or a global-illumination
solver. Its weapon and characters remain authored procedural geometry unless
`weapon-provenance.json` records a later source-model integration.

## Preservation And Known Limits

The baseline game module, physics, AI, damage, timings, six opponents and
original 18 collision/shot proxies are preserved. New scene meshes do not
silently change cover. The original upper crates in three two-crate stacks
are visual-only and do not block shots; that inherited behavior remains.
New architectural trim is thin render-only detail, not additional cover.

Engineering acceptance, playable art acceptance and reference visual parity
are separate. Read `qa/art-review.md`, `qa/gameplay-review.md` and
`qa/release-report.json` for the actual current verdict, not feature claims.
No UE cinematic or private-asset acceptance is implied.

## Verification

Open `/test` for the original 19 integration fixtures and additional frozen-state
geometry/raycast/weather invariants. Reports are saved locally under
`qa/captures/`. `?bench=1&combat=1&weather=2` runs a 180-frame warm-up and 30-second
scripted real-combat rain benchmark. Add `&audio=1`, then click the explicit
benchmark button, for the recorded-audio performance gate. `/audio-test` provides
a separate explicit-click audio/decode/lifecycle/offline-stress test.
That suite pauses for a second real click on "重新开始" to verify recovery from
a suspended audio context. `/audio-load-failure` tests absent-module fallback.
Outcomes restart naturally; every measured
frame is retained, including hitches. This is not a human full-playthrough.

Selected current evidence is preserved in `qa/evidence/`. Verify source binding,
asset hashes, canvas checks, runtime fixtures and performance using:

```powershell
node experiments/sunbreak-realistic-v2/qa/verify-release.mjs
```

The original acquisition manifest documents Poly Haven sources and CC0 licensing.
Ignored `assets/evidence/` contains acquisition-page copies, not runtime assets.
Raw model streams, credentials, caches and unrelated UE/Fab assets are excluded.
