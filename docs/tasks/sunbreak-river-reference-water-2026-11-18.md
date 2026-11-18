# Task Packet: sunbreak-river-reference-water-2026-11-18

- State: REWORK (independently approved WIP checkpoint; reference quality/release BLOCKED)
- Owner: main integrator
- Created: 2026-11-18
- Branch: codex/character-continuity-pipeline
- Baseline: 192f5f5d5fa38aefb67f490eac8a1db1c416f85d
- Quality profile: offscreen-cinematic-v1; native-headless browser WebGL evidence, NOT Unreal Engine
- Worker budget: two disjoint producers, independent engineering and art reviewers
- Authority: user requests reference-led clumped vegetation, dimensional rocky riverbank, flowing non-mirror water and brighter reference daylight. No engine migration or public Pages release in this slice.

## Objective

Replace the planted-row/mirror-canal read with irregular gravel/grass/soil and
shallow moving water, preserving houses, playable routes, combat and earlier demos.
The two current user images define bright neutral daylight, readable shade,
individual partially buried stones, open mud gaps and clustered bank vegetation.

## Scope / write set

- Main: world.js (lighting/integration), new river-water.js, QA browser/hooks and
  tests/collector/report, this packet and final handoff/worklog. Single writer.
- Foliage producer: ONLY vegetation.js and qa/vegetation-clumps.mjs. Remove the
  lattice/regular foreground rows; deterministic nonuniform clump cores, satellites
  and bare gaps. Existing licensed foliage, no new assets or layout/collision edits.
- Bank producer: ONLY riverbank-detail.js and qa/riverbank-checks.mjs. Irregular
  gravel deposits rather than continuous sheet, modeled diverse stones including
  submerged stones. Preserve crossings, cabin entries and traversable support.
  No map-layout edits. Existing permitted scanned material assets only.
- Descartes: independent read-only Gatekeeper/engineering QA.
- Lovelace: independent read-only reference/art QA using actual render output.
- Read-only: map-layout.js, weapon/actors/combat, earlier demos, shared vendor and
  source assets, UE and private vault. Main serializes all browser GPU capture.

## Dependencies / risk

Start fetched all origin branches; source clean and unchanged remotely. Stable
remote lease acquired for experiment and this packet. Private restore failed on
pre-existing dirty private vault. Preserve it; no missing private dependency is
used/recreated. Finish may skip private transfer for this isolated public-browser
checkpoint, explicitly without full UE/private portability claim.
Baseline art REVISE and strict pacing BLOCKED are retained. No AAA/UE5 parity claim.
No account purchase, new service, multiplayer or AI-video production.

## Plan and acceptance

1. Gatekeeper reviews plan before implementation; main inspects current shaders.
2. Disjoint foliage/bank production; main builds directional multi-scale moving
   water with actual surface relief, depth-sensitive reflection, localized glints
   and shallow-bed visibility. Brighter neutral daylight and readable blue shade.
3. Actual 1920x1080 matched hero/bank/wide views plus reference close-up; inspect
   before freezing. Capture timed water sequence, no AI images or desktop pixels.
4. Run existing geometry/controls/cabin/traversal/weather regressions and new CPU
   clump/water checks. Verify new modules included in source hashes/package.
5. Frozen sunny and two storm 30s real-time measurements: p95/p99 <=33.3ms, max<=50ms,
   zero >50ms. Retain failures, no cherry-picking, no reduced thresholds.
6. Independent separate engineering/art verdicts. A still review cannot clear
   continuous motion. Record REWORK/BLOCKED honestly when target not reached.
7. Inspect staged scope; update QA/handoff/worklog, normal Git/LFS checkpoint,
   release lease only after verified upload. Existing public page stays unchanged.

## Verification

Node CPU suites in qa/; native-headless `node experiments/sunbreak-river-v4/qa/browser.mjs`
with named phases. Runtime source-binding includes real module/texture bytes.
Rollback is a new scoped revert commit; never reset unrelated work or old evidence.

## Review decision

- Gatekeeper: Descartes PASS TO IMPLEMENT; preserve real collision/support and
  footprint clearances, bind new module, keep two storm plus one sunny sample.
- Result: eight current-bound browser phases and eleven CPU suites PASS;
  independent engineering CONDITIONAL PASS for WIP checkpoint only; art REVISE,
  strict performance BLOCKED, continuous motion UNVERIFIED.

## Implemented / measured geometry (2026-11-18)

- Vegetation: 269 irregular compound clumps in 104 patches, 13,874 grass roots,
  six deliberate bare bank intervals. Grass core/satellite density ratio 4.35;
  source tree transforms unchanged. Full spatially culled foliage inventory
  31,517,045 triangles /112 color draws (baseline32,850,886 /125); shadow
  inventory4,894,491 /21. These are submitted geometry maxima, not frame rates.
- Shore: 2,500 microstones,720 cobbles,360 low grass instances and12 inaccessible
  outcrops. Mixed geological tints/UV phases,36 deposits,7 grass
  islands,2,546 submerged stones.199,776 triangles /28 draws; shadows3,456 /4.
  Maximum checked reachable support discrepancy6.07cm, within original6.5cm.
  Asset bytes unchanged. `afterrain-assets.json.runtime` is the PREVIOUS
  acquisition baseline; current actual budgets are in runtime mapInfo and QA.
- Water: four downstream warped wave components, maximum1.71cm displacement,
  128x1400 surface grid (358,400 triangles),1024x576 reflection target /5 taps.
  Actual GLSL scalar depth and bent displacement checked against CPU functions;
  mesh sampling checks include maximum spatial phase gradients. No physics or
  riverbed support edits. This is analytic flow, not fluid simulation.
- Lighting: HDR/key rotated together to southwest front-light the northbound
  view; stronger readable sky/ground fill; underwater pebble roughness avoids
  duplicate broad specular. Opaque SSAO override excludes transparent surfaces
  and cutout cards; normal pass preserves the genuine sun shadow cache.
- Public packaging whitelist includes new module:71 files116,519,185bytes at
  first preflight; final preflight116,519,727bytes (71 files).

## Retained failed experiments and limits

- Early09:32 image still had a pale shiny riverbed. Corrected per actual render,
  not accepted as reference match.
- Intermediate09:34 grass was sparse and deposits too isolated. Producers
  thickened distinct irregular grass bodies and added broken underwater gravel.
- Direct WebGL recording09:35 and diagnostic same-size2D pixel-copy recording
  09:38 both timed out at Runtime.evaluate. Cause UNKNOWN; no GPU-driver diagnosis
  established. Keep both failure reports. Six timed actual-gameplay canvas frames
  are sampled-motion evidence only, not full continuous10s/24fps acceptance.
- Independent technical review triggered finer water tessellation, projected
  reflection perturbations, actual bent-function tests, shadow-update guard and
  camera-equality metadata. Regenerate old bindings after these changes.
- Reference/AAA acceptance remains unestablished; no UE engine, Lumen, Nanite,
  multiplayer, dynamic destruction or public Pages update is claimed.

## Final independent visual/performance findings

- Lovelace reviewed all five09:44 stills, then independently re-opened final
 09:52:49 riverbank/reference-close after the shadow-cache fix. REVISE, high
 confidence within viewed stills. Improvements: less white mirror glare,
 visible bed, brighter readable sunlight, fuller grass and submerged gravel.
 Remaining Major: near-bank pale wedge/depth separation; planar sediment;
 isolated pale grass islands. No full continuous-motion acceptance.
- Final native1920x1080 real-time samples retain all frames after declared
 contiguous10s warmup, each>=30s. All FAIL unchanged thresholds:
 sunny09:49 p95/p99=18.3/18.6ms, max53.3ms,1 frame>50;
 storm09:50 p95/p99=18.3/18.6ms, max52.7ms,1 frame>50;
 storm09:51 p95/p99=18.4/18.6ms, max390.6ms,2 frames>50.
 No extra runs to obtain a lucky pass; hitch cause unverified.
- Current source-bound water-samples09:49:01 passes time/weather and exact camera
 pose/FOV equality across six actual rendered frames (water clock1.77..8.32s).
 A fixed river-only pixel ROI changes between first/last frames; this is not
 a video, optical-flow direction proof or uninterrupted temporal review.
- New reports: qa/reference-water-review.json, qa/reference-water-units.json and
 canonical qa/release.json. Previous after-rain reports retained separately.
- Next: author one close bank sediment section with matching support, diagnose
  pale shore reflection and remaining hitches, then reassess art before release.

## Checkpoint audit

All145 current runtime dependency hashes match final phase reports, actual staged
Git blobs/LFS object identities and local working bytes. No gameplay/weapon/actor,
house/layout or earlier-demo source changed. Source binding/publish whitelist
includes river-water.js. Final evidence phases:

- afterrain09:52:49, map09:53:12, art09:53:39, weather09:54:11
- cabins09:54:44 (15), controls09:55:11 (32), traversal09:55:53 (40)
- water-samples09:49:01 (2), plus the three failed current-build pacing reports

Descartes final decision: APPROVED FOR WIP CHECKPOINT ONLY, CONDITIONAL PASS
engineering. No new blocker to preserving this limited public-browser slice.
No current UE/private asset restore or portability claim. The existing private
vault conflict remains untouched. Git/LFS upload acknowledgement and immutable
worklog are recorded by the normal finish checkpoint; lease released afterwards.
