# Task Packet: river-procedural-migration-2026-11-19

- State: DONE (bounded playable migration); overall strict release BLOCKED
- Owner: root integrator / Planner / Producer
- Branch: codex/character-continuity-pipeline
- Baseline: 84d7e0ac2fc5f3be11bc44980842e3ea2be26c0e
- Worker budget: 3 bounded workers (generator, QA harness, independent Gatekeeper/QA)
- Human approval: user explicitly accepts lab appearance and requests Riverfall migration.

## Objective and scope

Migrate the accepted material lab's code-generated, correlated albedo/roughness/
normal approach into the existing playable valley. Preserve geometry, colliders,
AI, guns, animations, doors, river crossings and previous demo sources. Keep a
reload-based `?materials=legacy` comparison. Default becomes procedural migration.

Implement deterministic baked soil/path/litter, mineral stone, plaster, wood and
weathered metal surfaces; metre-scale zoned wetness with filtered animated puddle
normals. Retain coherent existing sun/HDR, AO and height fog. Keep river geometry
and flow timing, improving filtered rain surface response only if needed.
No new geometry budget or per-frame texture generation. Bakes occur once at boot.

## Out of scope and risks

No full-game asset-free claim: foliage, NPCs, gun, sky and optional local scans
remain existing resources. No new third-party downloads or private assets. MIT
lab-derived utilities retain attribution. No verified Fable execution this slice.
No UE edits, model relayout, multiplayer, Pages deployment or cinematic acceptance.

Startup/all-origin fetch verified current branch. Existing dirty canonical UE
private vault is preserved; pinned browser-import snapshot remains unchanged.
Lab's 28 one-level pixel differences and 2 >50ms intervals remain historical FAIL,
not silently waived. User approval authorizes migration, not technical gate PASS.

## Write set

- Root: river world.js, new procedural-ground.js, ground-surface.js if necessary,
  masonry-materials.js, river-water.js, riverbank-detail.js, index.html/credits,
  integration tests/reports and this task/handoff/sprint/worklog.
- Generator worker: new procedural-materials.js and its procedural-materials-checks.mjs only.
- QA worker: new qa/migration.mjs, qa/migration-checks.mjs and generated migration
  evidence only. Root serializes all GPU runs; existing harness remains reusable.
- Independent reviewer: read-only; no source edits. Root owns shared status files.
- Read-only: procedural-material-lab, original game/previous demos, map-layout,
  NPC/weapon/interaction modules, user original assets and private vault.

## Plan / acceptance

1. Independent Gatekeeper reviews this packet before implementation.
2. Procedural generators share physical scale and deterministic height-derived
   material channels, sRGB color versus linear data, mipmaps and anisotropy.
3. Integrate without changing collider/layout and keep legacy route; visibly
   separate dry traffic, damp bank and shallow puddles rather than uniform gloss.
4. Source-bound native-headless 1080p captures: same-view A/B, ground/stone/plaster/
   timber/river, sun and rain. No desktop screenshots or focus/click workflow.
5. Run CPU suites plus controls/cabins/traversal/weather and current procedural
   assertions. Benchmark separately: 10s declared warmup then 30s realtime combat,
   p95/p99 <=33.3ms, max<=50ms, zero>50ms; retain all failures unchanged.
6. Independent current-build sampled art and engineering decisions. Still images
   do not clear continuous temporal review. Save/upload exact bounded checkpoint.

## Verification / rollback

`node experiments/sunbreak-river-v4/qa/migration.mjs` (new scoped collector),
existing qa/browser.mjs phases, qa/run-polish-units.mjs and new unit checks.
Restore legacy appearance with `?materials=legacy` without modifying gameplay.
Revert only migration source changes if needed; never remove historical evidence.

## Review decision / result

Gatekeeper Godel (01a1f3f2-bd1d-7242-9834-76bd613eeb01): PASS TO IMPLEMENT.
Explicit surface whitelist, legacy branch fidelity, independent bake RNG, fixed
river reflection/geometry, no extra post/reflection passes. Record bake/memory
cost. One sunny and two storm benchmark samples, unchanged strict thresholds.
Implemented all eight deterministic procedural material families with correlated
albedo/height, OpenGL normals and ORM. Actual terrain uses unchanged traffic,
foundation and forest masks with dry/damp/basin wetness; no extra geometry,
reflection or post passes. Existing scene/sky/riverbed/foliage/model assets remain.
Legacy comparison and original gameplay/index source remain intact.
Allocation is not usage: the runtime binds mud, stone, metal, plaster and wood
through standard material slots, and path/litter through six custom terrain
samplers. Core/course/mortar/aggregate remain analytic shaders; the allocated
brick bake is not relabelled as an attached texture.

Root art precheck corrected overly uniform beaded grains and pale path albedo.
Initial independent REWORK identified divergent rain derivatives, flattened
exposed plaster normals and incomplete provenance. All three were corrected;
initial verdict and failed/superseded evidence are retained without alteration.

Current final visual report: `qa/evidence/migration-visual-2026-11-19T13-52-11-585Z-vUJROf/report.json`
(under experiments/sunbreak-river-v4): 24 actual native1080p WebGL captures,
16 matched pairs, network/material/source assertions PASS. No UI screenshots.
Source manifest `f7725eef59bea61c18b3109e31d39c05169729a322481d669a9f9d7ab3911868`.
Final CPU report: `qa/evidence/migration-units-2026-11-19T13-52-21-796Z-lQp5mp/report.json`:
24/24 suites PASS; 580 generator, 371 emitted-shader and 71 harness checks.
Raw preservation is still FAIL: seven inherited legacy-evidence CRLF-only byte
differences, out of1131 checked files. Original files were not normalized or
rewritten. Historical reports and sources remained unchanged during the run.

Independent final review: `qa/migration-review.json`: targeted source PASS,
sampled art CONDITIONAL PASS on eight selected current-build images, not all24.
Smooth masonry, simple timber, soft routes and repeated scene construction remain
full-scene limitations. Exposed-fracture normal fix is source-confirmed; the close
plaster crop does not isolate a fully exposed fracture. No continuous-motion PASS.

Pre-correction regression schedule:8/8functional PASS,3/3strict performance FAIL
(p95~35.8ms; max89.2/203.4/71.2ms). This evidence remains historical, not substituted
for the corrected build. Final corrected-build regression report:
`qa/evidence/migration-regressions-2026-11-19T13-54-38-393Z/report.json`.
Procedural functional5/5PASS. Legacy checks/cabins PASS, traversal FAIL at bridge
long-edge x0 direction+1: two-second movement ends z=-1.1015 rather than z>-1,
with grounded support and blocked=false. Failure artifact retained separately:
`qa/evidence/traversal-2026-11-19T13-59-48-598Z/traversal-failure-1.json`.
Do not infer a collision defect or a harness-only cause without further evidence.
Whole functional schedule is7/8, not PASS; no rerun-until-pass or threshold waiver.

Final strict1080p combat performance FAIL in all3prespecified samples:
sunny p95/p99/max35.8/36.4/71.3ms,7intervals>50ms;
storm-A35.9/39.3/159.3ms,13intervals>50ms;
storm-B35.8/36.6/339.1ms,11intervals>50ms.
Native RTX5070/D3D11,10s contiguous declared warmup then30s actual combat each;
all warmup and sample frame records retained. No source drift. These are not
FPS/AAA acceptance claims, and stills do not prove temporal stability.

## Checkpoint and next action

Local preview: `http://127.0.0.1:5190/river/`.
Legacy comparison: `http://127.0.0.1:5190/river/?materials=legacy`.
No Pages deployment. Not whole-game asset-free, no new Fable execution and no
AAA/UE/cinematic acceptance. Generated maps add approximately32MiB GPU including
mips and24MiB retained CPU pixels; bakes happen once, not each frame.

Checkpoint is public source/evidence only. No private resources changed; reuse
verified browser snapshot `cc1f9345cfb74e06e3b26f4ba9446bd7b5cf2407`. Existing dirty
UE private vault remains untouched; `-SkipPrivateAssets` does not establish full
project portability. Git/LFS acknowledgement must be verified before lease release.

Canonical checkpoint: `experiments/sunbreak-river-v4/qa/migration-release.json`.
Next: investigate frame-pacing hitches and timed legacy traversal separately from
art without changing gameplay/layout, resolve historical evidence newline
discrepancies through explicit provenance repair, and obtain continuous-motion
review before release. No further broad art redesign in this migration slice.
