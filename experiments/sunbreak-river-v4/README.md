# RIVERFALL — independent v4 river map

Local preview: run `node experiments/sunbreak-river-v4/serve.mjs`, then open
http://127.0.0.1:5190/river/ . Public playable page:
https://luciuswang.github.io/neon-cleaner-demo/sunbreak/river/
All four earlier demo source directories and public pages remain unchanged.

Rainy Vietnamese-inspired village, six paired buildings (intact, partly ruined,
and ruined), central shallow river, one timber bridge and two gravel fords.
The entire river is wadeable. Mirrored collision geometry and equal path lengths
are geometric checks, not proof of competitive balance. This remains a six-bot
single-player experiment by default. The opt-in network entry below shares its
map and art. Neither entry is Unreal Engine or a certified AAA build.

### 4v4 elimination — friends and quick match

Open `https://luciuswang.github.io/neon-cleaner-demo/sunbreak/river/?mode=squads`
on a desktop browser. Accept the peer-to-peer notice, then create an invitation
room or choose quick match. From inside a room use **邀请 → 复制**; the generated
link, not just the lobby URL, joins that match. Click the game canvas to play.
Each side has four seats. Additional humans take AI seats on alternating teams
without resetting their life; departure returns the same seat to AI. Warmup,
one life, teammate spectating, a 75-second round and first to five. Timeout
uses survivors then health; tied rounds do not award a point. This is team
elimination, not plant/defuse or an economy mode. No friendly damage.

The host tab simulates both teams. Keep it open and active: no host migration,
dedicated server or ranked anticheat. Browser/network restrictions can prevent
peer connections. Public quick-match rooms and private invite rooms are separate.
Only online mode loads the vendored MIT PeerJS 1.5.5; see `peer-notice.html`.
For repeatable local transport QA run the existing game server, plus PeerServer
`peerjs --host 127.0.0.1 --port 5193 --path /squads`, then
`node experiments/sunbreak-river-v4/qa/squads-network.mjs --capacity`.
`--cloud` tests real remote signaling; `BASE_URL` can select the deployed overlay.

Controls: WASD, mouse / arrow keys, hold left mouse / F for automatic fire,
R reload, Shift sprint, Space jump, T weather, V color grade, G presentation,
P pause. Use a desktop keyboard and mouse. Lightning can be disabled. Existing
v4 MP5/arms, NPC skin/animation, 105ms fire cadence and 2.25s reload are retained.
Gun audio is licensed AR15/M4 recording, not an MP5 field recording.

## Implementation and provenance

- `map-layout.js` is the shared movement/AI/architectural geometry contract.
- `world.js` integrates PBR surfaces, reflected river, rain rings/splashes,
  lighting, postprocessing and the retained player/NPC assets.
- `terrain-ray.js` uses an exact grid traversal over the rendered terrain
  triangles; it does not disable terrain shot occlusion for performance.
- `vegetation.js` instances CC0 scanned foliage, with wind and separate near/far
  tree geometry. `tools/derive-foliage.mjs` preserves whole leaf components.
- `asset-sources.json` records official source URLs, licenses, MD5 and SHA256.
  `foliage-derivatives.json` records derivative hashes. Credits retain CC BY
  authorship for the weapon, arms and characters.
- `tools/fable-candidate.mjs` invokes exactly `claude-fable-5-2` via the existing
  Gateway, without granting tools. It retains only visible candidate code and
  sanitized usage receipts, never credentials or raw reasoning streams.

## Verification

`qa/map-checks.mjs`, `qa/terrain-rays.mjs`, and `qa/browser.mjs` perform separate
geometry, raycast and actual native-headless WebGL checks. Canvas exports are
game render evidence, not desktop screenshots. `quick` is diagnostic only;
`map`, `traversal`, `checks` and `benchmark` are release evidence phases.
Failures remain in `qa/evidence/`; a representative frame review must not be
described as complete continuous motion review. Final release status is recorded
in `qa/release.json` only after current-source binding and independent review.

## Publishing

`tools/package.mjs` verifies pinned shared assets and builds an isolated overlay.
`tools/publish.mjs --prepare` requires a clean source checkpoint and creates a
normal protected-main PR containing only `sunbreak/river/`. The reviewed PR can
be merged with `--pr=N --merge`. `tools/verify-public.mjs` checks anonymous live
bytes and earlier pages; `qa/browser.mjs --phase=public` tests actual live inputs.
QA hooks, local server and original high-poly tree source are not publicly served.
Private UE assets are unrelated and are not included.
