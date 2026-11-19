# Task Packet: sunbreak-river-material-combat-polish-2026-11-19

- State: QA / scoped WIP; art REVISE; public release BLOCKED
- Owner: root integrator, codex/character-continuity-pipeline
- Created: 2026-11-19
- Baseline: d5b2114d07e1496824b6b788757364412e18908e
- Worker budget: two disjoint producers and independent engineering/art reviewers
- Human approval: not required for scoped local changes and normal checkpoint

## Objective

Improve Riverfall close-range material relief, stone cover, dense natural ground
growth and perimeter forest, with world-responsive weapon lighting and visible
muzzle/actual-hit feedback. Preserve playable layout, combat and prior demos.

## Dependencies and risks

All-origin startup fetched; browser source and separately verified private imports
are local. Canonical UE private-vault restore remains blocked by pre-existing
local changes; preserve them. Imported licenses remain unverified/local-only.
Previous 1080p performance is BLOCKED (~35.6ms p95); extra density must be spatially
batched/bounded with shadow/reflection cost considered. This is WebGL, not UE5.

## Scope and write set

- Root: world.js, index.html, vegetation.js, ground-surface.js, ground detail,
  local-only loader optimization if justified, QA tools/reports, task/handoff/worklog.
- Combat producer: weapon.js and new combat-feedback.js only, plus its own
  qa/combat-feedback-checks.mjs. Root integrates all shared hooks.
- Material producer: village.js, masonry-materials.js, new stone-cover.js and
  qa/stone-cover-checks.mjs only. No authoritative map-layout edits.
- Reviewers read-only. Root serializes GPU evidence and benchmarks.
- Lease acquired for experiments/sunbreak-river-v4 and status/worklog paths.

## Plan

1. Review screenshot and actual source; reuse appropriately licensed existing PBR
   normals and roughness, correct scale before increasing amplitude.
2. Replace low cover visuals with bounded stone masonry, retain dimensions and
   shot/movement correspondence. Strengthen house light-dependent relief without
   metallic plaster or arbitrary silhouette changes.
3. Add irregular low ground growth and layered perimeter trees/understorey while
   preserving paths, openings, crossing views and foundation supports. Add bounded
   shallow physical ground detail rather than a single flat color texture.
4. Map scene sunlight/environment/local lighting into the separate weapon view;
   use bounded occlusion checks. Pooled muzzle, dust/chips/sparks at authoritative
   first hit positions and surface normals. No damage/cadence/hitbox changes.
5. Current-source CPU regressions and native-headless WebGL near/wide, light/shade
   and actual-shot captures; controls, traversal, cabins, fallback. Serialized
   strict 1080p sunny/storm performance. Retain all failures and historical QA.
6. Independent engineering/art verdict, accurate current report; scoped source
   checkpoint upload and preserve pinned private backup. No Pages promotion.

## Acceptance

- Convincing nonmetallic stone joints and directional highlights; no blank boxes.
- Close house and ground detail responds to light; normal direction/scale checked.
- Natural clustered vegetation with clear travel routes and no hidden solid cover.
- Gun changes with world direction, weather and shelter; hand/reload rig preserved.
- Muzzle visible, impacts only at real first hits with bounded pools/lifetimes.
- No regression to old demos, damage, movement, doors, reload or hitbox contracts.
- Fixed prior import caps <=8 families/25MB/500k tris/60 draws remain unchanged.
- Automated functionality, sampled visual, continuous motion and performance are
  separate verdicts. No AAA/UE5/public acceptance without passing current evidence.

## Review decision

Descartes PASS TO IMPLEMENT. Total addition cap <=150k scene triangles and
<=12 beauty draws; shadow/reflection amplification reported separately. Material
producer allocation <=40k/3draws, combat <=10k/3draws, environment <=100k/6draws.
Containment alone is insufficient: visible stone cover must agree with opaque
shot shell, within unchanged 3cm detail tolerance. Root owns authoritative hit
events and world lighting. Prior release/performance BLOCKED remains in force.

## Result / next action

Implemented and frozen: six stone-cover replacements (536 stones), stronger
scanned plaster/timber relief, derivative-based shallow soil relief, 3,600 low
meadow instances in irregular patches, 1,350 embedded small gravel pieces and
190 distant orientation-selected tree impostors behind the original 3D forest.
World-direction/environment/shelter-responsive viewmodel lighting, compact
26-triangle muzzle flare and bounded actual-hit dust/chip/water/spark pools are
integrated without changing combat. Stone hit visuals project onto visible
relief. Water hits use finite front-to-back 1cm search brackets and bisection;
this is a search resolution, not a universal exact tangency guarantee.

Final frozen CPU21/21 suites PASS with exact original gameplay HTML after four
presentation-only insertions; all original205 village colliders and non-cover
geometry fingerprints retained. Browser phases PASS: polish14, controls32,
cabins17, traversal54, weather4, no-import fallback2. Evidence starts at
qa/evidence/polish-2026-11-19T09-07-08-953Z;18 sampled art views,23 total final
functional images. Prior failed/intermediate evidence is retained, not relabeled.

Independent engineering CONDITIONAL PASS for implementation/budgets:84,479 net
added triangles;10 new/9 net beauty draws. These counts exclude pass amplification.
Independent art REVISE: static hipfire/ADS flame visibility PASS and sunlit plaster
relief confirmed, but near stone/plaster black micro-lines, planar stone read,
bright polymer/dark indoor weapon extremes remain. Earth/water impact evolution
needs delayed-frame or continuous-motion inspection; instantaneous hit frames do
not validate it. Continuous motion UNVERIFIED; AAA remains REVISE.

All three strict performance samples FAIL. Exact prescribed one-sunny/two-storm
samples and values are bound in qa/polish-release.json. Thresholds remain
p95/p99<=33.3ms,max<=50ms,zero hitches>50ms at1920x1080 after10s same-workload
warmup and30s actual combat/reload. No Pages deployment.
Measured p95/p99/max (ms): sunny35.8/36.6/71.6 (10 frames>50ms),
stormA35.8/36.5/338.7 (8), stormB35.9/37.3/229.3 (13). All three source,
workload and native RTX5070 evidence bindings valid; failures are retained.

Source-only checkpoint reuses the unchanged, already fresh-cache LFS-verified
private import snapshot cc1f9345cfb74e06e3b26f4ba9446bd7b5cf2407. No new model or
texture binaries. Canonical dirty UE vault remains untouched; skipping whole-UE
private transfer does not establish whole-project portability. Public package
excludes all12 local-only models; public licenses remain unverified for imports.

Next: isolate close-range micro-line artifacts with shader/AO A/B, calibrate
polymer/metal/cloth separately, inspect delayed material-specific impacts and
continuous movement, then profile strict frame pacing before public promotion.
