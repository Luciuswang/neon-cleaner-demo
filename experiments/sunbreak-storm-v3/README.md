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

The combat module is preserved after narrowly enumerated presentation and
target-local architecture hooks: six spawn anchors, original AI, hits, damage,
ammunition, fire cadence and 1.2-second reload. The SMG changes appearance,
not weapon rules. The former MERCADO12 at [12,-18] is now the reference-led
timber cabin: horizontal squared logs, corner laps, pale raised plinth,
sheet-metal gabled roof, cream windows and railed veranda/stairs. Its former
solid proxy alone is replaced by the visible assembly for bullets/LOS and
dedicated body/door/overhead bounds. Other17 original movement bounds remain.
Opening the cabin intentionally changes local traversal, cover and sightlines;
it is not an unchanged18-proxy world. Only players climb the new stairs.
Gun audio remains the v2 CC0 AR15/M4 recordings, **not an MP5 field recording**.
Other houses retain decorative parallax rooms; only this cabin has a real
floor, ceiling, furniture, two interior lamps and hinged door. The unseen
interior/rear are authored interpretation, not claimed photo reconstruction.
The user's reference photo/watermark is not redistributed. Enemy animation is
simple visual leg swing with authored bent arms, not full motion capture/IK.
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
`node qa/compare-gameplay.mjs --self-test` checks source preservation/tripwires.
Local `/test`, `/storm-test` and `/house-test` are explicit synthetic fixtures; diagnostic
routes/capture injection are not shipped in the static build.
Pre-house historical evidence/report: `qa/release-report.json`, `qa/review.md`.
Current house slice: `node qa/check-house-logic.mjs`,
`node qa/verify-house-release.mjs --collect`, `qa/house-release-report.json`
and `qa/house-art-review.json`. The original full18-proxy runtime suite does
not certify the intentionally changed house contract. Current house evidence
is stored separately in `qa/house-evidence/`, bound to loaded source hashes.
Engineering pass and art acceptance are deliberately separate. Sampled images
do not certify full continuous motion or AAA/UE5 photorealistic parity.
