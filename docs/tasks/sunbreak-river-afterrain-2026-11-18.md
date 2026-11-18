# Task: Riverfall after-rain daylight and rocky river valley

- ID: sunbreak-river-afterrain-2026-11-18
- State: REWORK (playable WIP checkpoint; art/performance release blocked)
- Baseline: f5c34e83a1268e1fe24a0815080d0aed2c2e5820
- Branch: codex/character-continuity-pipeline
- Owner: main integrator; budget two bounded producers and two independent reviewers
- Authority: user explicitly requests after-rain sunshine, light mist, strong
  directional contrast, licensed internet detail assets, mixed mud/stone/grass
  banks and layered mountain background from five attached references.

## Scope

Keep both timber buffer cabins, six village centers, combat/crossings, collision,
weapons/NPC animations and four earlier demos. Replace default rain with sunny
wet weather. Use a coherent sun/HDR reflection direction, blue sky, warm key and
cool readable shade; thin distance haze must not conceal missing foreground art.
Add scanned river pebbles/rock textures, low dimensional bank gravel, larger
outcrops outside crossing lanes, broken wet/dry shore transitions and shore grass.
Add distant layered mountain/ridge geometry outside playable terrain, without
turning the Vietnamese village into a snowy alpine map or moving gameplay lanes.
Retain selectable overcast/storm modes, with rain/ripple/thunder correctly gated.

## Plan / write ownership

1. Main locally owns world.js, index.html, map-layout.js if needed, QA and
   integration/packaging. Main acquires daylight HDR to assets/afterrain-light/**
   with daylight-assets.json and tools/daylight-assets.mjs. Preserve previous
   materials and asset provenance. Main may adjust vegetation material/placement
   only after coordination; no worker writes vegetation.js.
2. Bank specialist owns ONLY new riverbank-detail.js,
   assets/afterrain-detail/**, afterrain-assets.json,
   tools/afterrain-assets.mjs and qa/riverbank-checks.mjs. Acquire permitted CC0
   Poly Haven scans, verify official MD5/size and record SHA256/license. Build
   bounded instanced gravel/outcrops/shore tufts; no invisible solid obstacles.
   Export pure plan for CPU validation. Does NOT edit world/map/vegetation.
3. Distant-landscape specialist owns ONLY new distant-landscape.js and
   qa/landscape-checks.mjs. Layer nonconical eroded ridges outside current
   terrain; terrain samples/profiles need deterministic CPU invariants. Receives
   material/light parameters from main; no external downloads or shared edits.
4. Descartes: independent read-only plan and final geometry/input/evidence review.
   Lovelace: independent read-only art screening of actual current native-headless
   WebGL frames against user references. No desktop screenshots/focus/clicks.
5. Main captures early matched hero/bank/sky views before freeze; fixes visible
   integration defects, then unit/input/cabin/traversal/weather, source-bound
   multiview and two predeclared strict1080p30s performance runs. Keep all failures.

## Risk and limits

All origin heads fetched; no new competing production after baseline. Existing
private-vault dirty state still prevents restoration; unrelated browser work
uses no missing private asset. Preserve it and skip private transfer explicitly
at this public-asset checkpoint; no UE/private portability assertion.
Previous art remains REVISE and performance BLOCKED (max53/53.2ms); these are
baseline failures, not acceptance of this revision. Do not weaken max50ms and
p95/p99<=33.3ms or trim hitches. New default weather requires explicit mode
selection in storm regressions and a separately labelled sunny sample.
No dynamic destruction, multiplayer, continuous-motion or AAA parity claim.

## Acceptance

- [x] Default after-rain sky/sun/reflections coherent; no falling rain or thunder.
- [ ] Readable sun/shade shape without crushed blacks or flat white foreground.
- [ ] River bank has interlocking stone/mud/grass transitions at gameplay scale,
      grounded geometry, no obvious flat ellipse edge or stepping through rocks.
- [ ] Background has layered ridges, valley opening and atmospheric perspective;
      no giant cone ring or foreground curtain obscuring the village.
- [x] Earlier gameplay routes/cabin entry and reused animation modules preserved.
- [x] Sources/licenses/hashes and public whitelist verified, budget recorded.
- [x] Current unit/input/weather evidence inspected; combat pacing pending below.
- [x] Independent art and engineering verdicts recorded separately. Existing
      public version only updated after applicable release gates pass.

## Verification / result

Use existing six Node suites and native-headless qa/browser.mjs phases, adding
new bank/landscape/weather tests and user-reference closeups. Evidence protocol
offscreen-cinematic-v1 (browser WebGL, not UE). Latest QA, blockers, next action,
handoff/worklog and verified Git/LFS checkpoint required before lease release.
Gatekeeper: PASS TO IMPLEMENT (Descartes), not release acceptance. Preserve two
strict storm/combat samples and add labelled sunny sample; bind actual asset bytes.
Frozen actual WebGL evidence:

- afterrain-2026-11-18T07-24-43-934Z: four reference-oriented views, weather checks PASS.
- map-2026-11-18T07-25-04-318Z: eight gameplay-scale views, GPU shader loading PASS.
- art-2026-11-18T07-25-26-829Z: cabins/interiors, ground, trees and ruins in two modes.
- weather-2026-11-18T07-26-29-426Z: actual live storm thunder/rain, then sunny
  shutdown (zero pending thunder/gain), four checks PASS.
- cabins-2026-11-18T07-26-59-773Z: 15 actual input checks PASS.
- checks-2026-11-18T07-27-27-011Z: 32 fire/reload/lifecycle checks PASS.
- traversal-2026-11-18T07-28-07-992Z: 40 actual route/support checks PASS.

Nine CPU suites PASS. Landscape 79,360 triangles /12 color draws; bank detail
186,720 triangles /28 draws, replacing153,000 old stone triangles. Grass was
redistributed, with thin stem placements partly reassigned to existing low leafy
Bermuda instead of increasing overall counts. New public CC0 assets12,480,032bytes;
package70files116,504,046bytes. All source/derivative hashes and whitelist verified.
Public bundle excludes original scan/source toolchain. Runtime evidence binds
actual new/shared textures, HDR, meshes, WAVs and bundled renderer/add-on bytes.

Retained failed visual iterations: over-tall clothlike ridges; pale pebble sheet;
rotated sunny light revealed bright mountain albedo and glossy distant dirt.
Corrected before freeze: lower/rougher mountain relief, linear mineral albedo.18,
dry distant shoulders; full HDR/background rotated with direct sun and IBL solar
radiance limited16 (scan peak111,382 versus median.171) to separate sky fill/key.
Puddle fade follows irregular boundary. No geometry change inside combat bounds.

Independent art (Lovelace): REVISE. Improvement confirmed, but broad water glare,
continuous gravel-bank strip, rounded ridge repetition and bare foothill ecology
remain Major. This is four-still representative review, not continuous motion or
AAA acceptance. Engineering (Descartes): CONDITIONAL PASS implementation only.

The predeclared performance runs all FAILED unchanged thresholds:

- Storm07:29: p95=18.4ms, p99=18.6ms, max53ms, one frame>50ms.
- Storm07:30: p95=18.4ms, p99=18.6ms, max247.4ms, four frames>50ms.
- Sunny07:31: p95=18.4ms, p99=18.6ms, max53.2ms, one frame>50ms.

No further retries to obtain a lucky PASS. A late independent audit found that
the legacy vendor/three import was omitted from evidence bindings (presentation
build was included). Collector fixed to include both builds and full dependencies;
server restarted and all seven functional/evidence phases regenerated. The old
performance reports retain their original incomplete bindings and failed results;
do not silently backfill or claim complete current-byte performance acceptance.

07:35 complete-binding cabin rerun failed: east player moved0.171m then state
became paused, not a geometric collision. Harness had duplicate exitPointerLock
requests via pause()+loseLock(). Removed duplicate pause/exit and drained queued
native lifecycle with two animation frames before synthetic next travel. No game
code or thresholds changed; failure retained. 07:37 cabin rerun15PASS; remaining
functional evidence regenerated with this harness. See final qa/release.json for
canonical latest paths rather than earlier successful batches above.

Final checkpoint collector: functional=true, all nine persisted CPU suites PASS,
seven functional/evidence phases PASS with complete current144-file byte binding.
Art REVISE; performance BLOCKED. Overall release BLOCKED; local playable WIP
only. Canonical evidence and retained failures: qa/release.json and
qa/afterrain-units.json. Public page unchanged. Normal source Git checkpoint and
upload are authorized; private transfer explicitly skipped for unrelated dirty
vault. Follow handoff/worklog and verified remote HEAD for checkpoint status.

Next concrete production: one naturally interlocking hero riverbank sample with
local reflection/roughness control, then rugged ridge/forest-foot transition;
profile the retained long frames independently. No AAA parity or release PASS;
preserve previous public page. Only the source WIP checkpoint may upload.
