# SUNBREAK / BLACK SQUALL — v3

Separate browser FPS storm rendering study. Earlier v1 and v2 are preserved.
**UE5-inspired visual direction; not Unreal Engine, Lumen, Nanite or ray tracing.**

## Play

Run `node experiments/sunbreak-storm-v3/serve.mjs` from the repository root.
Open http://127.0.0.1:5188/ . v1 is `/original/`, v2 is `/v2/`.
WASD movement, mouse/arrow aim, left click/F fire, R reload, Shift sprint.
Approach the timber house's porch stairs and aim at its door: E or the
proximity button opens/closes it. The room is genuinely enterable and lit.
Click Start to enable audio. P pauses; T changes weather; V changes lighting.
The on-screen controls disable post-processing and lightning individually.
Desktop keyboard/mouse is the supported play target, not mobile touch.

## Rendering and scope

- Default rain with scanned 2K asphalt, uneven wetness and masked planar
  reflections, animated ripple normals/splashes and photographic HDR storm sky.
- Shadow maps, SSAO, warm practical lights and parallax-shaded window interiors.
- Peripheral grass/ferns, wind-driven palms, slow bounded lightning and
  synthesized environmental rain/wind/thunder.
- CC-BY MP5 plus textured gloved arms and six CC-BY tactical soldier skins.
- Optional restrained bloom/color grade. All v3 runtime dependencies local.

The baseline imports exact upstream Three r160. Its separate presentation
dependency graph has a documented module-local random source (UUIDs/SSAO/noise)
so asynchronous visuals never consume the original combat random stream.
The vendor manifest records upstream and transformed hashes. Production never
temporarily replaces the global random generator.

The 2026-11-17 tactical revision intentionally changes v3's six NPC spawns and AI:
obstacle-grid navigation, reserved cover pairs, crouched hiding, timed peeks,
aiming, short bursts, recoil and retreat/repositioning. One defender stays inside
the cabin. Shoulder-to-muzzle and muzzle-to-player geometry checks prevent firing
through the closed door/walls. NPC hitboxes follow stance and the elevated floor.
The exact player input/movement/fire/damage/ammunition/1.2-second reload contract
is separately checked against checkpoint `2f116226e4bd`; the SMG remains cosmetic.
The former MERCADO12 at [12,-18] is now the reference-led
timber cabin: horizontal squared logs, corner laps, pale raised plinth,
black overlapping tiled roof, cream windows and railed veranda/stairs. Its former
solid proxy alone is replaced by the visible assembly for bullets/LOS and
dedicated body/door/overhead bounds. Other17 original movement bounds remain.
Opening the cabin intentionally changes local traversal, cover and sightlines;
it is not an unchanged18-proxy world. Only players climb the new stairs.
Gun audio remains the v2 CC0 AR15/M4 recordings, **not an MP5 field recording**.
Other houses retain decorative parallax rooms; only this cabin has a real
floor, ceiling, furniture, two interior lamps and hinged door. The unseen
interior/rear are authored interpretation, not claimed photo reconstruction.
The user's reference photo/watermark is not redistributed. Enemy animation uses
authored procedural skeleton poses: planted-foot two-bone leg IK, weapon-relative
arm IK, hips/spine motion, stance/lean, aim and actual-shot recoil/flash. This is
not motion capture or a human-behavior simulation. The original NPC weapon
geometry/fingers are retained.
Rain impacts use 360 exposed wet-field locations, expanding/fading rings with
varied sizes and timing, crown splashes and ballistic droplets. Dry weather
disables them; pause/death/presentation freeze their simulation.
Original stacked upper crates have no original collision proxy; preserved here.
This is not a real-world combat or ballistics simulation.

## Assets / evidence

In-game `credits.html`, `assets-manifest.json`, `weapon-provenance.json`,
`soldier-provenance.json` and `vendor/manifest.json` record licenses and hashes.
No Marketplace/private UE assets are included. The optional social cover is
AI-generated promotional artwork, not gameplay evidence; its prompt/mode are
in `assets/social-cover-provenance.json`.

`node tools/build.mjs` in this directory makes an exact-byte static `dist/`.
The build can use sibling preserved versions or isolated `comparisons/` inputs.
The earlier `qa/compare-gameplay.mjs` describes the historical unchanged-NPC
contract; it cannot certify this authorized tactical revision. Current checks:
`node qa/tactical-player-contract.mjs` (exact player module + negative mutations),
`node qa/tactical-unit.mjs`, `node qa/tactical-actor-check.mjs --report`, and
`node --experimental-vm-modules qa/tactical-environment-check.mjs`.
Local `/tactical-test` and `/tactical-house-test` exercise actual geometry and the
working house with the authorized spawn map. `/test`, `/storm-test` and `/house-test`
remain historical explicit synthetic fixtures; diagnostic
routes/capture injection are not shipped in the static build.
Pre-house historical evidence/report: `qa/release-report.json`, `qa/review.md`.
Historical house slice: `node qa/check-house-logic.mjs`,
`node qa/verify-house-release.mjs --collect`, `qa/house-release-report.json`
and `qa/house-art-review.json`. The original full18-proxy runtime suite does
not certify the intentionally changed house contract. Historical house evidence
is stored separately in `qa/house-evidence/`, bound to loaded source hashes.
Engineering pass and art acceptance are deliberately separate. Sampled images
do not certify full continuous motion or AAA/UE5 photorealistic parity.

## Public GitHub Pages release

Live v3: https://luciuswang.github.io/neon-cleaner-demo/sunbreak/
Comparisons: `original/` and `v2/` below that address. All three were started
and fired in an actual public browser on 2026-11-17 for the earlier tactical
release; its138 deployed file hashes and original root/web entry were verified.

## User manual-edit verification — 2026-11-17

The current runtime cabin uses the user's saved Blender project, including the
yellow handwritten Hello / red wood-texture paint, changed door plate material
and three edited foundation/stair meshes. Source and export are preserved in
`authoring/user-house-2026-11-17/`; the original downloadable55MB art kit remains
unchanged as the comparison baseline, NOT the user's latest source.

The submitted GLB and external textures were still old. Actual changes were
inside `timber-house-editable.blend` (packed images and saved edit mode). Import
flushed edit data in memory and exported without saving the original file.
User paint is on shared wood, so its appearance on walls, floor, ceiling and
furniture is expected shared-texture reuse, not newly painted individual props.
Packed Image_1 is only reencoded; Image_4 has the real changed pixels.

The reviewed contract changes exactly three structural records while retaining
the generic20micrometre/oriented-triangle checks. The user's new small bottom
step has a matching7.478cm walk-support area. Two small below-floor plinth side
corner cutouts are retained as authored, not silently filled or certified as
watertight. Door layout, combat and v1/v2 are preserved.

Reproduce this specific source audit/export with Blender background:
`--background --factory-startup --python-exit-code 1 --python tools/import-user-house.py`.
This tool pins this particular source and expected edit set; it is intentionally
not a general contract-regeneration bypass for arbitrary future architecture.
New reports/canvases use `qa/user-house-*`, preserving the previous QA.
Local immediate visual check: `/?view=houseinside&capture=manual-house&clean=1`.
Normal play remains `/`; final current task/QA receipt is in the task packet.

`node tools/github-pages.mjs` reads the existing Pages status without mutation.
After committing and building validated source, `--publish` installs only the
sanitized static `dist/` under `sunbreak/` through a normal protected-main PR,
preserving the existing
root/web Neon Cleaner site. No private/UE content, QA hooks or server is shipped.
The source push and Pages live verification are separate checkpoints.
`node tools/pages-pr.mjs --pr=N` inspects review/check state; `--merge` uses a
normal merge only when clean and requirements pass. No rule changes or bypass.
v1 remains byte-identical; the packaged v2 comparison hyperlink alone is adapted
to `../original/` for nested hosting, without changing its game module.

## Editable cabin and left-arm repair — 2026-11-17

The actual downloadable art handoff is
`assets/house/timber-house-art-kit.zip` (about55MB). Its unpacked source lives in
`authoring/timber-house/`: original GLB, real editable Blender project, edited GLB,
11 extracted texture images, material mapping, license and file-hash manifests,
and the Chinese `README-美术交接.md`. It contains no player weapon/private assets.
The real Blender trial bevels both door-hardware parts and assigns aged brass;
it does not claim a human artist has manually finished the entire cabin.

The game now loads the validated Blender derivative through `house-asset.js`.
Keep names, identity root and independent DoorPivot. Structural geometry must
match within20micrometres; only named cosmetic hardware has a small editable
envelope. Any building-layout edit requires reviewed collision updates, not a
silent GLB swap. Existing four game-owned lights are retained exactly once;
imported static surfaces are batched only AFTER validation.

Reproduce locally: open `/tools/house-authoring.html` with `node serve.mjs`
running, then run Blender5.3 background with `tools/house-roundtrip.py`,
`tools/verify-house-blend.py`, and `node tools/package-house.mjs`.
Do not overwrite the retained original GLB with an artist's edited derivative.
The `.blend` reopens in a fresh process and decodes all11 packed images.

The old `fitSleeveEnd` nonrigid rear displacement is replaced by an articulated
held-arm fit with locked hand contact, unchanged joint lengths and a shoulder
garment closure. Original licensed source GLB/textures and baseline weapon
gameplay remain unchanged. This is not a full hand-driven reload animation.

New task QA: `node qa/roundtrip-contract.mjs`,
`node --experimental-vm-modules qa/roundtrip-run-units.mjs`,
and `node qa/roundtrip-browser.mjs --phase=checks|captures|benchmark`.
These write new reports without replacing historical QA. The earlier tactical
player contract intentionally asserted weapon.js unchanged and is historical
for that weapon clause; the new exact whole inline game-module check supersedes
only that authorized rendering change. Preserve all other old regression rules.
Use `tools/verify-public.mjs --report=roundtrip-public-live` for this publication.

Final local evidence: `qa/roundtrip-release.json` binds current source hashes to
all11 actual-game canvas views, roundtrip28/house47/tactical24 browser assertions,
arm55 and final1080p combat/audio pacing. Independent engineering and bounded
art findings: `qa/roundtrip-independent-review.json`. Two final30s pacing runs
passed; one earlier428ms hitch is preserved with unknown cause, not discarded.
No full continuous visual review, globally watertight arm, hand-driven reload,
or UE cinematic/AAA parity is claimed. The unchanged original right shoulder
opening and minor cloth/lighting polish notes remain documented.

Current editable-cabin release is live through normal protected-main PR7,
public commit `b208c68dc84db962078bce088d4c52bbeda8e698` from source
`e9dfc9244a23206960931b9aba7b0d457e4142d5`. Anonymous checks passed146/146
files, including the real ZIP and imported GLB, with original root/web preserved.
`qa/roundtrip-public-live.json` and `qa/roundtrip-public-smoke.json` record the
actual public start/fire/reload test and working download link. Play remains at
the v3 address above; download `assets/house/timber-house-art-kit.zip` there.
