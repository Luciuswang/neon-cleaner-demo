# Task Packet: river-afterrain-light-understory-2026-11-20

- State: bounded implementation DONE; source and sampled art PASS; strict release BLOCKED
- Owner: root Planner / integrator
- Branch: codex/character-continuity-pipeline
- Baseline: 8647a8fcdfaf9fcd199e4b0495628b894fd64aef
- Worker budget: independent Gatekeeper/QA, one understory writer, one QA-harness writer
- Human approval: user requests stronger reference-led sunlight, reflective puddles/wet rims and green forest floor.

## Objective and scope

Improve after-rain sunlight contrast, separated dry/wet ground with visible
irregular puddles, and continuous green understory beneath the existing trees.
Preserve combat layout, terrain/support geometry, doors, guns, NPCs and old demos.
Keep an explicit `?look=previous` route for the pre-change lighting/vegetation;
`?materials=legacy` remains the material comparison.

Root owns lighting/environment alignment, terrain shader/wetness integration and
bounded local reflection solution. Understory writer owns a new standalone
forest-floor.js module and tests only, using existing permitted foliage resources
or generated geometry. No new asset downloads, paid calls or Fable claim.

## Dependencies and risks

All-origin startup fetch is current. Canonical UE private restore is blocked by
pre-existing dirty vault; preserve it. Unchanged browser resources use verified
snapshot cc1f9345cfb74e06e3b26f4ba9446bd7b5cf2407. This is public code/evidence only,
not whole-project portability. Previous strict frame-pacing failures, timed legacy
traversal failure and seven historical CRLF evidence mismatches remain recorded.
Avoid global mirror ground, lifted puddle decals, regular grass rows, black shadows,
incoherent HDR/key light and excessive new render passes/draws.

## Acceptance and verification

1. Independent Gatekeeper before implementation.
2. Forest coverage is broad and irregular, with explicit path/foundation/river
   exclusions and spatially coherent low greenery, not just isolated tufts.
3. Puddles show sky/light or nearby scene reflection with wet rims; slopes are not
   mirrors. Report reflection approximation and cost honestly.
4. Native-headless actual 1920x1080 WebGL same-view previous/current captures:
   village lane, grazing puddle, forest slope, cabin edge, river-wide, storm.
   Locked desktop: no window focus, desktop screenshots or native UI actions.
5. CPU shader/placement checks and unchanged gameplay/cabin/traversal/weather
   regressions; final strict 10s warmup +30s combat samples for sun and storm.
   p95/p99<=33.3ms, max<=50ms, zero>50ms unchanged. Serialize all GPU work.
6. Independent sampled art and engineering decisions; stills do not prove continuous
   motion or AAA/UE parity. Keep failures; no retry-until-pass.
7. Source-bound QA, immutable worklog and verified Git/LFS checkpoint. No Pages
   deployment or third-party communication included in this task.

## Write set

- Root: world.js, procedural-ground.js, new afterrain modules as needed, QA reports,
  .gitattributes, this packet, sprint/handoff/worklog.
- Understory worker: forest-floor.js and qa/forest-floor-checks.mjs only.
- QA worker: qa/afterrain-look.mjs and qa/afterrain-look-checks.mjs only.
- Independent reviewer: read-only. All GPU jobs scheduled by root.
- Read-only: map-layout.js, gameplay/index, gun/NPC/door modules, old demos,
  historical evidence, private vault, user reference files.

## Review decision

Gatekeeper Chandrasekhar: PASS TO IMPLEMENT, final QA pending. Preserve exact
previous-look branch and independent material toggle. Extra forest budget <=180k
triangles, <=8 draws, no new shadow casters. Puddle reflection budget: one 768x432
RGBA half-float target, no MSAA; y=0 plane only on flat y=0 terrain, never reused
river-plane reflection. Selective layer excludes terrain/water/heavy grass to
prevent recursive rendering. Preserve sunny plus two storm strict samples.

## Result / next action

Implemented default after-rain look, with explicit `look=previous` restoring old
lighting, terrain shading and vegetation. Stronger warm solar key and reduced
sky fill use an in-memory, horizon-preserving HDR remap to a measured25.93deg sun.
Unchanged flat y=0 terrain carries procedural retained puddles and wetter rims;
river/hills/foundations are excluded from the planar-puddle mask. No collisions,
terrain supports, doors, player/AI logic, weapon/NPC animation or earlier demos
were changed.

Forest floor adds code-generated5600tufts/168000triangles/8draws/zero shadow
casters, continuous spatial green cover, retinted generated litter detail,
irregular earthen openings and near-grove density.60eligible existing tree roots
have cover; river/path exclusions remain.71reflection-only canopy cards reuse
the existing four-view source-tree atlas (142triangles, no new texture).
One768x432half-float ground reflection uses actual buildings/actors, with canopy
impostors and no ground grass. A sampled view fell from15M reflection triangles
to398115 after this correction. Main-view trees are unchanged. This is selective
planar rendering, not ray tracing or UE output.

Art precheck prioritized broad light/material separation over more asset detail.
Independent preliminary REWORK found lawn-like understory, silver wet rims and
dark facades. Rework preserves litter RGB structure and matching normals, narrows
and roughens wet rims, and restores modest diffuse fill without exposure lift.

CPU27/27 suites passed on the preliminary runtime in
`qa/evidence/afterrain-units-2026-11-20T04-34-23-817Z/report.json` (under the demo),
with source and historical-report before/after identity passing. An earlier new
wrapper omitted `--stdout-only` and regenerated six old summary files: exact
generated outputs were retained, original bytes restored and verified, wrapper
corrected and a historical-identity guard added. Failed initial collector retained.
A second full14capture run passed image/network/source/pair checks but failed its
whole-directory history audit due solely to added sibling unit evidence files
(zero existing keys changed). Final acceptance collector must run serialized;
do not promote either overall FAIL report. Functional/strict performance pending.

Independent review of all14 preliminary stills accepted the warm sunlight and
broad green understory, but returned sampled-art REWORK for pale pond outlines.
The first regression schedule was explicitly stopped for this art correction;
its completed passing phases remain archived with an aborted.json, not promoted
to final acceptance. The correction attenuates partial-coverage direct specular
and bounds the duplicate HDR solar lobe on wet soil only; planar water still
retains independent scene reflection/Fresnel. Recollect and source-bind final QA.

Final candidate runtimeSHA256:
`894ec9dfb0dc9cecd8470e270390f5fc5dd922ce98d0d48b85cce839a559be07`.
Current27/27CPU suites PASS, including161after-rain ground contracts and145
collector checks. Sources and historical summaries remain unchanged in
`qa/evidence/afterrain-units-2026-11-20T04-49-51-331Z/report.json`.
Targeted final-rim preview retained at
`qa/evidence/afterrain-look-2026-11-20T04-48-40-035Z-YbX6GI`.
That two-view run is PARTIAL, not full visual acceptance.

Final frozen-build regression schedule completed with sources and historical
summaries unchanged:
`qa/evidence/afterrain-regressions-2026-11-20T04-50-47-134Z/report.json`.
Current5/5phases PASS (combat32, cabins17, traversal54, weather4, fallback2);
previous+legacy3/3phases PASS (combat32, cabins17, traversal54). This passing
current timed traversal does not rewrite or waive the historical failed sample.
Strict1080p10s-warmup/30s-combat performance remains FAIL in all3samples:

| Sample | p95 ms | p99 ms | max ms | Frames >50ms |
| --- | ---: | ---: | ---: | ---: |
| Sunny | 35.9 | 36.8 | 71.8 | 10 |
| Storm A | 35.9 | 36.7 | 71.3 | 8 |
| Storm B | 35.9 | 39.3 | 88.3 | 12 |

No retry-for-PASS or relaxed threshold. Renderer: native1920x1080 NVIDIA RTX5070
Direct3D11; sample durations30007.9/30005.8/30003.8ms. Final independent review
closed the bounded pond-rim REWORK for runtime894ec9d: remaining thin pale edges
are Minor, not a blocker for this scoped look checkpoint.

Final full14capture/7pair visual-engineering PASS:
`qa/evidence/afterrain-look-2026-11-20T05-02-55-902Z-jcaWIC/report.json`.
All current runtime/protected-source/history checks PASS. Independent reviewer
Chandrasekhar actually inspected all14final PNGs, verified image/state hashes and
source bindings, and returned source PASS / sampled art PASS / release BLOCKED.
Canonical independent record: `qa/afterrain-look-review-2026-11-20.json`. Compatibility2image
collector checksPass, correctly PARTIAL, at
`qa/evidence/afterrain-look-2026-11-20T05-00-45-041Z-Kh8zwF/report.json`.

The final checkpoint collector compared decoded RGB against the prior migration:
ground-lane, river-hero AND river-wide all match exactly (zero changed pixels).
Earlier preliminary river-wide mismatch remains in its archived evidence. Three
matching views do not establish universal pixel identity. Historical strict
performance, legacy timed traversal and seven evidence newline failures remain
inherited, not waived.

Canonical checkpoint: `qa/afterrain-release.json`. Next: diagnose strict frame
pacing in isolated CPU/GPU samples without altering combat/layout, retain the
historical failures, then independently review continuous movement/reflection
stability. No Pages publication or full-project private-vault portability is
included. The finish script verifies Git/LFS upload; do not infer successful
upload from this pre-commit task packet alone.

Post-staging scope audit caught a report-name collision with the2026-11-18
`qa/afterrain-review.json`. Restored that historical file exactly from baseline
(raw Git diff empty), moved the new independent review to the dated path above,
and regenerated the canonical manifest binding. First manifest is retained as
superseded under `qa/evidence/afterrain-checkpoint-audit-2026-11-20/` with the
explanation. No runtime, image or historical evidence bytes remain changed.
