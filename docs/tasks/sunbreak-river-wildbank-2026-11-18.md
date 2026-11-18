# Task Packet: sunbreak-river-wildbank-2026-11-18

- State: IMPLEMENTED / source-only WIP CONDITIONAL PASS / release BLOCKED
- Owner: root integrator; branch codex/character-continuity-pipeline
- Created: 2026-11-18; baseline e9c05a8
- Worker budget: one foliage producer, independent engineering and art reviewers
- User authorization: scoped downloads, browser map edits and source checkpoint;
  no purchases or restricted Marketplace redistribution.

## Objective

Address annotated image 826c1e89: natural mixed wild grass instead of pale wiry
tufts, continuous water through both earthen fords, wet river margin grading
outward into dry soil. Preserve central wooden bridge and usable crossings.

## Scope / write set

- Root owns map-layout.js, river-water.js, world.js, integration/QA/packaging
  under experiments/sunbreak-river-v4 and this task/handoff/worklog.
- Foliage producer owns vegetation.js, assets/wild-grass/**, wild-grass-assets.json,
  tools/prepare-wild-grass.mjs, qa/vegetation-clumps.mjs only.
- Reviewers are read-only; no simultaneous GPU captures. Existing shared v1-v3,
  weapon/actors/combat and house layouts are read-only.

## Dependencies / risks

Start sync fetched source; private-vault unfinished changes block restore.
Preserve those changes. This public browser-only slice has no private dependency;
skip private transfer with disclosure, do not claim UE portability. Prior art
REVISE, strict performance BLOCKED and continuous motion UNVERIFIED are retained.

## Acceptance / verification plan

1. Source/license/hash provenance for any new runtime asset; use redistributable
   CC0 rather than unrestricted assumptions about Fab/UE packs.
2. Both earth fords submerged and a connected channel visible in actual renders;
   CPU and GLSL depth agree, rendered terrain agrees with support/rays, routes
   remain traversable. Update obsolete dry-ford assertions, not tolerances.
3. Irregular bank moisture controls color and roughness, with visually dry outer
   ground; no full-map wet coating. Inspect matching bank/wide/close frames.
4. Grass no longer reads pale wire bushes; varied leafy species/scale and open
   clump structure, bounded triangle/draw budgets and clear gameplay routes.
5. Run relevant CPU suites; serial native-headless map/art/afterrain, traversal,
   cabins/controls/weather, water samples and declared 30s sunny+storm benchmarks.
   Preserve failures, unchanged strict frame thresholds; no lucky retry gate.
6. Independent engineering and art verdicts against frozen source-bound evidence;
   source WIP upload may be conditional, Pages remains blocked unless gates pass.

## Review decision

Gatekeeper Descartes: PASS TO IMPLEMENT. Lower actual support and GPU depth,
retain bridge and original slope limits, bind all new asset bytes, preserve
clear routes and budgets. Freeze then serial sunny plus two storm samples;
past strict performance/temporal failures remain independent of this permission.

## Out of scope

UE migration, AAA parity, continuous-video acceptance, multiplayer, new combat,
public Pages release, changes to earlier demos or private vault.

## Result

Implementation and frozen runtime QA complete. Rollback by reverting this
slice only. Source assets: ambientCG Foliage001/006 CC0 atlas downloads, original
curved blade tufts (not a downloaded UE5 pack). Four medium/tall variants replace
the pale seed-stem sources; existing low Bermuda, tree transforms and routes stay.

## Final current-build checkpoint

- Runtime revision: wildbank-mixed-posture-r3-2026-11-18. Canonical evidence is
  `experiments/sunbreak-river-v4/qa/release.json`; previous reference-water QA is
  archived rather than overwritten without history.
- Twelve CPU suites PASS. Nine current-bound browser phases PASS: wildbank5,
  afterrain9, map2, art2, weather4, cabins17, controls32, traversal54 and water
  samples2. All182 runtime identities match; no stale binding exceptions.
- Descartes independently verified current functional/test hashes, terrain
  agreement, asset provenance/preparation and package bytes: engineering
  CONDITIONAL PASS for source-only WIP. Expanded staged-byte audit must pass
  before upload; upload acknowledgement is separate from this QA verdict.
- Expanded staged audit PASS:245 working/index byte identities, including182
  runtime bindings, current rendered frames/sidecars/reports, retained failures,
  unit-test sources, summaries, preparation script and LFS object sizes. Scoped
  staged set431 files, no unrelated edits; whitespace check PASS. Normal finish
  script appends the handoff and immutable event before source/LFS upload.
- Lovelace independently reopened all four final11:48 target stills: the three
  annotated static corrections PASS. Earlier11:36 nine-view review is separate;
  final afterrain images were not independently reopened. Whole-map/reference
  art remains REVISE; repeated close-up leaf fans are Minor, pale shore wedge,
  sediment relief and village/mountain fidelity remain larger follow-up work.
- Prescribed1080p RTX5070 combat samples each retain10s contiguous warmup and30s
  measurement. Sunny p95/p99=16.8/16.9ms, max1173.1ms,3 frames>50ms. Storm1
  p95/p99=18.3/18.6ms, max52.6ms,1 frame>50ms; storm2 max53.6ms,4 frames>50ms.
  All three FAIL the unchanged max50ms/zero-over50 gate. The1.17-second sunny
  hitch is unresolved, cause unknown; no retry-until-pass or performance waiver.
- Six timed live-rendered frames do not establish uninterrupted motion quality.
  Continuous motion UNVERIFIED; previous capture timeouts and this slice's
  traversal/cabin failures remain retained and labeled with their actual limits.
- Public overlay packaging preflight:78 files,118421742bytes. No Pages update.
  Local playable preview: http://127.0.0.1:5190/river/ . Earlier demos, combat,
  weapon/NPC animation, buildings and tree transforms preserved.
- Source-only WIP checkpoint; existing unrelated private-vault edits preserved
  and private transfer skipped. No full UE/private portability or AAA claim.
- Next concrete action: diagnose retained long frames before public release;
  later address pale shore reflection/sediment depth and wider reference fidelity.
  Do not repeat completed grass production or substitute numeric PASS for art.

## Retained intermediate findings / corrections

- First dry-ford regression hit an exact floating-point .58 identity difference;
  reformulated the blend to preserve the original deep-channel .58 value.
- Descartes found 3.805cm rendered/support discrepancy missed by sparse probes.
  Increased terrain grid from400 to520 segments (0.5m cells, +220800 triangles),
  retaining the3cm bound. Dense5cm probes over complete +/-4m ford transitions
  plus both reviewer regressions now max2.4436cm; no threshold relaxation.
- Gravel overlay previously sampled a different grid from the base terrain.
  Aligned0.5m cells/diagonals; actual double raycasts verify8mm separation through
  slopes. This removes geometric intersection, not a claim that all art seams pass.
- First new continuous-contact traversal failed at the UNCHANGED deep channel
  z=0, after all modified ford checks passed. Existing gravity permits downhill
  airtime there. Retain failure evidence; new fords keep3cm sampled contact,
  deep channel checks no penetration plus original grounded endpoints. No player
  physics edit or weakened terrain/support limit.
- Early images11:07 and11:09 show old grass and are intermediate only, not final
  evidence. Initial art still REVISE; source freeze and final review pending.
- First new-grass GPU pass11:16/11:17 was rejected by root and Lovelace: lime vs
  blue-green islands, broad paper-like ribbons and abrupt root bundles. Producer
  revised palette normalization, blade widths/arching/height variety and restrained
  root shading; these rejected images remain preserved. Do not treat a successful
  CPU20/20 result as grass-art acceptance.
- Olive-arched r2 (11:24 evidence) passed all9 browser phases, including54 traversal,
  32controls and15cabin checks. Lovelace independently inspected9 full-resolution
  stills: ford continuity PASS, wet/dry PASS, grass REVISE for repeated upright
  fans, overall reference REVISE. Proceeding to one bounded silhouette/height and
  coherent mixed-growth pass; palette/terrain preserved. No performance trials
  run on rejected grass revisions; final frozen runs pending.
- r3 differs in posture/height/mixing only; accepted palette retained, no new
  roots or enlarged clearance footprints. Grass triangles1,186,320; full foliage
  inventory30,250,068/112 draws.23CPU foliage checks and deterministic rebuild pass.
- r3 cabin11:38 failed east close: selected=null, near=true, visible=false,
  toggles1. Exact pre-close position was not recorded, so specific cause is not
  proven. Harness now uses actual S movement to measured porch z3.8 and asserts
  selected door before E rather than a fixed650ms retreat. Door runtime unchanged;
  corrected17-check run11:41 PASS. Failure retained, all harness-bound phases
  regenerated; no claim that the original failed check passed.
- Gatekeeper required explicit inside-door-plane entry and measured retreat
  completion/timeout/support checks, not just selected-door state. Added those,
  with exception-safe key release. Current controls32, traversal54, weather and
  water samples pass; recapturing earlier helper-bound phases before performance.
- Lovelace inspected all9 r3 stills at11:36: all three annotated static corrections
  PASS; overall reference/AAA remains REVISE. Remaining within-slice flat-leaf/fan
  repetition is Minor. Pale water-edge wedge and sediment relief remain larger
  follow-up art work, not scope expansion for this checkpoint.
- New asset licensing: two ambientCG CC0 leaf atlases, four original curved-blade
  GLBs;35 manifest file identities, public whitelist5 files, runtime payload under
  3MB. No UE/Fab pack or unlicensed extraction used. Public overlay preflight78
  files118421742bytes; no publication. The exact upstream license HTML alone has
  an archive whitespace-lint exception; original hash preserved.
