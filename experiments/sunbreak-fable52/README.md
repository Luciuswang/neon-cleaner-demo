# SUNBREAK — Fable 5.2 FPS snapshot

Saved 2026-11-16 at the user's request. This preserves the current playable
prototype, **not an accepted Free Fire art-style result**. No game or visual
changes were made for this checkpoint.

## Run

Requires Node.js (18+ recommended), a modern WebGL browser and internet access
for Three.js 0.160.0 from jsDelivr. No npm installation or API key is needed.
From this directory run:

```sh
node serve.mjs
```

Open http://127.0.0.1:5186/ . If this demo already occupies port 5186, use the
existing server or stop it before starting another. The server binds to loopback.

## Controls

- Start button; WASD move; mouse / arrow keys look.
- Left click / F fire; right click aim; R reload.
- Shift sprint; Space jump; Esc / P pause.
- V switches tropical competitive / cool industrial styles.
- G freezes presentation and hides the center menu for same-camera comparisons.

One map, six opponents, finite ammunition/reload, wall occlusion, victory/defeat
and restart. Style changes preserve camera and combat state.

## Provenance and contents

The generation CLI recorded producer model `claude-fable-5-2`. Compact generation
and a model-generated repair pass were followed by Codex integration fixes:
weapon visibility/scale, frozen recoil, collider transforms, spawn positions,
tap-to-fire and QA instrumentation. This is not an untouched one-shot result.

- `index.html`: current game and procedural visuals/audio, two style presets.
- `serve.mjs`, `smoke-inject.js`: local server and synthetic integration checks.
- `prompt.md`, `repair.md`: original briefs, not proof every request was achieved.
- `verification.json`: recorded checks, visual observations and limitations.

Raw model streams, generation outputs, account/login diagnostics and local
generation runners are excluded. Runtime needs no model access. No Free Fire
logos, characters, extracted assets or Epic/Fab content are included.

## Verification and limits

Game SHA256:
`4b0de43249fd1c787554ea1735c84669b1df687fc9e03aba263571c48a101a85`.

The earlier run recorded 19 passing synthetic integration checks. Open
http://127.0.0.1:5186/test to rerun; inspect the JSON overlay for all checks
passing. Fixtures manipulate game state and are not a manual playthrough.
Actual UI start/fire/defeat and both rendered styles were observed. Screenshots
remain in the originating task and are not archived here.

Art fidelity remains **REVISE**: blocky characters/weapons, sparse buildings and
simplified palms do not meet the intended Free Fire-inspired semi-realism.
Style switching is demonstrated, not independent-generation consistency.
No full manual six-enemy playthrough, performance benchmark, mobile validation
or listening test was completed.

This isolated experiment does not change Neon Cleaner UE assets or clear its
cinematic QA. No private assets are required. Next development step, when
requested: agree a visual reference and revise art before expanding gameplay.
