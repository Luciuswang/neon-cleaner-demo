# Task Packet: Riverfall reference-led art revision

- Task: sunbreak-river-art-2026-11-18
- State: REWORK (playable local checkpoint; public release blocked)
- Baseline: 0a0c45ce47e577359f0de84b2acbd65c035c2d63
- Branch: codex/character-continuity-pipeline
- Owner: main integrator, one writer per declared path
- Worker budget: two independent reviewers, up to two disjoint implementation workers
- Authority: user requests cabin placement and reference-led realistic art revision;
  existing licensed downloads, Gateway use and configured GitHub publishing authorized.

## Objective

Replace the weak Riverfall environment read with a reference-led rainy Vietnamese
village: two instances of the earlier actual timber cabin placed diagonally across
the river as enterable buffer spaces, detailed muddy paths, dense natural grass,
believable forest and structural masonry ruins. Keep NPC/weapon assets/animations.
Target is the supplied Delta Force reference quality, not a self-certified AAA label.

## Scope and plan

1. Reuse the original reference-led cabin authored assembly, black tiles and real
   interior with transform-aware doors, steps, floor, roof, bullet and movement.
   Candidate placements: west(-26,9), east(26,-17), east rotated180degrees about
   center(0,-4). Remove only overlapping outer cover and move any intersecting
   NPC start. Keep river/bridge/fords and six existing building centers.
2. Correct forest scale/silhouette/alpha, clustered grass/ferns and cleared paths.
   Use permitted scanned inputs; no detached oversized-leaf substitution, no
   resource extraction from reference games. Use varied species if verified.
3. Multi-scale physically tiled wet ground, localized tracks, gravel/debris and
   understory. Motivated soft daylight with directional shape and contact shadow,
   reduced flat ambient fill; rain/storm stays selectable, no darkness disguise.
4. Replace clean cut-down box ruins with thick irregular masonry edges, varied
   grounded rubble, supported broken roof sections and fallen rafters. Fable5.2
   may produce a bounded visible-code contribution; record exact usage honestly.
5. Current-source multiview offscreen WebGL canvas evidence, actual traversal/
   door/fire/reload tests and strict two30s1080p samples. Independent art verdict
   against supplied references; missing AAA/full-motion acceptance stays explicit.
6. Preserve older4demos, previous river evidence and Git history. Publish only
   river subtree via protected-main PR, exact manifest and live anonymous checks.

## Write set

- Main: world.js, map-layout.js, village.js, ruins.js, index.html, qa/**, tools/**,
  manifests/credits and this task packet; finish-appended docs/handoff.md.
- Cabin worker: new buffer-house.js, buffer-house-logic.js, timber-house.js,
  house-logic.js under experiments/sunbreak-river-v4 ONLY; no other writes.
- Foliage worker: vegetation.js, assets/foliage-revision/**,
  tools/foliage-revision.mjs and foliage-revision.json ONLY.
- Both specialists read existing files but do not touch original storm/v4 sources,
  shared state or assigned peer paths. No simultaneous UE work.
- Read-only reviewers: no writes, transfers or git mutations.

## Dependencies / risks

All remote heads fetched. No new source task work found beyond local HEAD.
Pre-existing private-vault unfinished changes still stop startup restore; preserve
them. This browser-only slice uses no UE/private dependency and must not recreate
private production or claim UE portability. Final checkpoint explicitly skips it.
Two cabins increase geometry/lighting/shot and collision load. Added diagonal
placement changes old exact-mirror assumptions: validate matched cabin transforms
and actual path clearance, not falsely retain an exact whole-map symmetry claim.

## Acceptance

- [x] Two actual reference-cabin assemblies on opposite banks, diagonal pair.
- [x] Both doors, stairs, entry/exit, floor/headroom, roof rain and bullet cover
      work; no through-wall use, paused interaction, shared state or spawn overlap.
- [ ] Ground/foliage/ruins/light quality materially improves in matched views;
      independent reviewer explicitly distinguishes improvement from AAA parity.
- [x] Weapon/NPC animation modules and old4demos stay byte-identical.
- [x] Geometry, terrain-ray, AI routes, actual inputs/traversal pass with final
      source/harness hashes: map04:30,art04:30,cabins04:31,controls04:31,traversal04:32.
- [ ] Two actual1080p30s rain/combat runs p95/p99<=33.3ms,max<=50ms,zero>50ms;
      all failed evidence retained and no post-hoc trimming/threshold reductions.
- [ ] Protected-main scoped publication and anonymous live verification, then
      uploaded handoff/worklog and released lease.

## Verification

Existing qa/map-checks.mjs,terrain-rays.mjs,ai-movement.mjs,village-checks.mjs;
new cabin/placement regressions; qa/browser.mjs current multiview/controls/
traversal/benchmark phases; exact source-bound collector; tools/package.mjs,
publish.mjs,verify-public.mjs. No desktop screenshots, focus or clicks.
Current cinematic UE gate is unrelated and remains unchanged.

## Review decision

Gatekeeper Descartes: PASS TO IMPLEMENT. Authoring assembly plus transformed
controller and batching accepted. Remove old indexed-collider guard; consistently
transform floor/ceiling/door/sweep/movement; outside support must preserve negative
river floor. Preserve NPC behavior; do not claim new indoor navigation. Asset and
final art/performance acceptance remain independently gated.

## Result / next action

Two actual earlier cabin assemblies are integrated at west(-26,9)/east(26,-17),
180-degree pair about(0,-4). E opens the nearest valid door. Both retain stairs,
black tiles, furniture and warm lamps; added recessed backing closes daylight
board seams. NPCs avoid footprints; no new indoor NPC pathfinding is claimed.

Ground now has multiscale wet soil, quieter gravel, ruts, localized wet roughness
and forest-edge transitions. Seven verified CC0 derivative GLBs provide scanned
trees and clustered grass, with official source files/licenses preserved and
public whitelist checks. 34640 grass placements and95 woody placements are an
implementation count, not proof of reference-quality ecological layering.

Three irregular wall-profile families, exposed masonry, broken posts, fallen
beams,8asymmetric rubble piles and556fragments replace the first simple ruins.
Visible fragment triangles and indexed walking support agree. Fable5.2 generated
a bounded visible-code chipped-slab contribution, not the entire art revision;
see fable-art-revision.json. Destruction is static staged art, not runtime physics.

Current six unit suites pass:19map checks,175terrain rays,62AI movement cases,
72wall checks,160closed-fragment cases,1480pile and5832fragment support samples;
maximum gap1.0037e-6m and support step0.2426m. Cabins:40checks,174exact-ray
comparisons,16unit traversals. Actual browser controls32/traversals40/cabins15
pass. Representative8map and14detail stills are actual offscreen WebGL; no desktop
interaction and no claim of continuous-motion visual acceptance.

Independent engineering: geometry/input integration PASS, runtime release BLOCKED.
Final-source 04:21 benchmark p95=18.3ms,p99=18.6ms,max53ms,two>50ms. One04:22
diagnostic profile also failed,max53.2ms,one>50ms. CPU wrappers and long-event-only
trace (>20ms events) do not establish cause; do not count nested trace records as
independent stalls. Do not rerun solely for a lucky pass or weaken thresholds.
Old04:00 passing performance is stale. Both failures remain in the repository.
The only later source edit removes a trailing empty line in house-logic.js;
unit/input/still evidence is rerun, but no new performance acceptance is claimed.

Final independent art review by Lovelace: REVISE for this bounded revision AND
for AAA/Delta Force parity. Reviewer viewed all8map and14art stills from04:18
against the three references and baseline. Confirmed cabin identity/diagonal
pair, reduced mound-cap appearance, reduced grass rows and improved tree shapes.
Remaining Major issues: bright cabin seams still visible in west gable/interior;
flat-cut ruin surfaces and continuous brick tops; bare slopes and thin understory;
hard polygonal puddle/soil boundaries; insufficient unified lighting hierarchy.
Backing code is not proof that visible seams are solved. These are representative
stills only; later whitespace and harness-lifecycle edits have no visual semantics
but were not independently recaptured/reviewed by the art reviewer.

The post-whitespace04:28cabin rerun failed east-stair support. Independent review
confirmed a test lifecycle race: west pause asynchronously releases pointer lock,
then the next reset resumes play before the late exit event. Await the existing
loseLock helper before next cabin reset; keep380ms hold,>0.1m support,<0.04m height
and paused-E assertions unchanged. Runtime is unchanged; failed evidence retained.
Fresh04:31cabins15 andcontrols32 plus04:32traversal40 pass. This correction
does not resolve or reclassify the earlier strict-performance failure.

AAA/Delta Force parity,
continuous-motion review and competitive balance are NOT accepted. Whole-map
exact mirror symmetry is not claimed: measured original spawn-to-crossing route
differences are5.433m(north),4.867m(center),0(south). Single-player only.

Checkpoint contents: source, licensed assets and all successful/failed
evidence, with private-vault transfer explicitly skipped because of pre-existing
unrelated dirty state. No UE/private portability assertion. Local preview:
http://127.0.0.1:5190/river/. Current qa/release.json explicitly records BLOCKED;
previous published acceptance is preserved separately, not reused for this build.
Do not overwrite the previous Pages release while
art/performance gates fail. Prior public source98e650e7aa2e96e60f9df7a51176d66d72f29cfc,
merge91924b389a170a15ffc7665446b56c363f7fcca3 remains the released version.

Next concrete work: identify remaining visible cabin seam light leaks; replace
thin planar ruin break surfaces with reference-led
volumetric layered masonry and irregular load-bearing collapse; improve forest
understory/ground-water transitions without hiding them with darkness; diagnose
the repeatable long-frame class with a full CPU/GPU timeline before optimization.
Then freeze, independently review current visuals and collect two consecutive
predeclared strict performance passes before normal protected-main publication.
