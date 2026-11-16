# SUNBREAK / BLACK SQUALL — v3

Separate browser FPS storm rendering study. Earlier v1 and v2 are preserved.
**UE5-inspired visual direction; not Unreal Engine, Lumen, Nanite or ray tracing.**

## Play

Run `node experiments/sunbreak-storm-v3/serve.mjs` from the repository root.
Open http://127.0.0.1:5188/ . v1 is `/original/`, v2 is `/v2/`.
WASD movement, mouse/arrow aim, left click/F fire, R reload, Shift sprint.
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

The combat module is preserved after narrowly enumerated presentation hooks:
18 collision proxies, six spawn anchors, original AI, hits, damage, ammunition,
fire cadence and 1.2-second reload. The SMG changes appearance, not weapon rules.
Gun audio remains the v2 CC0 AR15/M4 recordings, **not an MP5 field recording**.
Rooms are decorative shaders, not newly enterable geometry. Enemy animation is
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
Local `/test` and `/storm-test` are explicit synthetic fixtures; diagnostic
routes/capture injection are not shipped in the static build.
Final evidence/report: `qa/release-report.json`, `qa/review.md`.
Engineering pass and art acceptance are deliberately separate. Sampled images
do not certify full continuous motion or AAA/UE5 photorealistic parity.
