# Task Packet: sunbreak-river-surface-atmosphere-2026-11-19

- State: IMPLEMENTED; scoped static art PASS / functional PASS; release BLOCKED
- Owner: root integrator; branch codex/character-continuity-pipeline
- Baseline: ef60b6816d96580d1463a17073e34af4b73aa72a
- Worker budget: two bounded producers and independent engineering/art reviewers.
- Authorization: scoped browser art changes, permitted free downloads and source checkpoint. No purchases or Pages release.

## Objective

Replace uniform mud read with plausible compacted village paths, foundation soil
and weeds, riverbank mud and less disturbed ground. Correct broken masonry
materials, grounded ambient occlusion and restrained height-dependent valley haze.
Reference: user's cc152b27 screenshot, 2026-11-19.

## Scope / write set

- Root: world.js, ground-surface.js, source/packaging/QA and this task/handoff.
- Atmosphere producer: height-fog.js and qa/height-fog-checks.mjs only.
- Masonry producer: village.js, ruins.js, masonry-materials.js and
  qa/masonry-materials-checks.mjs only. Geometry/support/collision must remain exact.
- Art and engineering reviewers: read-only. No concurrent GPU runs.
- Earlier demos/shared dependencies, weapons, actors, player and layout read-only.

## Dependencies / risks

Start sync fetched all origin branches, current branch clean/up to date. Private
restore still blocked by pre-existing unfinished vault changes; preserve them.
Public browser work has no private dependency; source-only finish skips private
transfer and makes no UE portability claim. Existing strict performance BLOCKED
(sunny1173.1ms hitch) and continuous motion UNVERIFIED remain independent gates.

## Research

Located 2026-11-18 Daily Game/AI Art Briefing section5 in the user's daily-news
task. Public primary source: https://oddpotatodev.itch.io/godot-cheap-ground-fog .
Author says mesh/shader approximation, not real volumetric fog; Godot4.8beta3
Forward+, WebGL compatibility demo thinner/less soft; CC0 project. Author's
release date November14; 80.lv coverage November17, not a newly invented
November18 algorithm. We adapt the lightweight principle, not claim direct
Godot integration or proven speedup. Do not copy private mail/chat content.

## Acceptance / verification

1. Ground paths clearly different in albedo, normal and roughness; material
   zones follow actual doors/crossings/traffic, with irregular transitions.
   Preserve bank moisture and under-foundation original texture.
2. Foundation weeds remain low/outside door approaches and colliders. Terrain
   heights and navigation stay exact; prior crossings and house entry pass.
3. Broken masonry faces, cores and chips have coherent world-scale PBR rather
   than whole-brick tiling on every small cut face; geometry unchanged.
4. AO-on/off comparison demonstrates grounded contacts without black halos,
   alpha-card occlusion, shadow cache corruption or globally crushed lighting.
5. Height haze has near-clear/mid/far and low/high separation; buildings, water,
   instanced foliage all coherent, weapon/HUD unaffected, no opaque sheets.
6. Actual native-headless WebGL renders only, no desktop capture. Frozen current
   hashes; CPU suites and browser input/cabins/traversal/weather, matched art
   views. One sunny+two storm30s benchmarks after10s contiguous warmup. Preserve
   all frames/failures; thresholds unchanged, no lucky rerun until pass.
7. Independent art/engineering verdict. Source WIP may be conditional; no AAA,
   UE5 parity, continuous-video acceptance or public-release promotion.

## Review decision

Descartes: PASS TO IMPLEMENT. Preserve geometry/navigation, physically scaled
AO thresholds and current ADS projection, existing shader-hook composition,
cutout exclusions and shadow guards. New modules/assets bound to evidence;
matched A/B plus current regressions required, historical blockers retained.

## Result

Three PBR soil layers, 543 low foundation weeds, physically scaled SSAO and
original analytic height haze integrated. Two new CC0 scan sets total5.25MB.
Masonry geometry/support/RNG hashes remain exact; zero additional masonry draws.
Initial beige cores and subsequent circular aggregate were independently rejected
and reworked. Final04:28 ten-image review: all five requested static corrections
PASS, including masonry. Global AAA remains REVISE. Minor close aggregate relief,
repeated top-edge spalling and tidy paths remain; no full-map or motion approval.

Engineering review caught and corrected tangent normal branch omission, litter
noise leaking into protected bank/foundation, and fake contact from an elevated
lintel. Regressions now test emitted shader expression including boundary masks.
Intermediate harness failures, GLSL reserved-word compile failure, false-positive
ADS test and old inline-shader assertion are retained in qa/surface-review.json
and release developmentEvidence. Corrected ADS actually changes72deg to~56deg,
with current matching projection. Legacy moisture test now executes the emitted
shader after module extraction; original3cm terrain threshold is unchanged.

Final verification:15 CPU suites PASS;10 current native-headless browser phases,
including controls32/cabins17/traversal54;51 rendered PNGs with current sidecars
and194 exact runtime bindings. Offline decoded AO/fog pairs differ; opaque-gun
region remains pixel-identical across fog toggles. Package88files/123715521bytes
verified; shared dependencies and earlier demos untouched. Independent final
engineering verdict CONDITIONAL PASS for source-only WIP, conditional on staged
byte audit and preserving first failed unit archive. Upload acknowledgement is
separate and verified by the finish script, never inferred from this verdict.
Final staged-byte audit PASS:352 pinned entries, including194runtime bindings,
current reviewed PNG/sidecars, unit/pixel/reviewer reports and retained failures.

One sunny and two storm samples retained, each10s contiguous warmup then30s
actual1920x1080 gameplay on NVIDIA RTX5070/D3D11. Sunny p95/p99~16.8ms,max50ms,
0frames>50:PASS. Storms p95~16.8ms,p99~16.8/16.9ms,max66.7ms,2/3frames>50:FAIL.
Cause unknown; no lucky retries, trimmed frames or threshold changes. Strict
performance remains BLOCKED. Full continuous motion UNVERIFIED. Pages unchanged.

Research found the requested November18 briefing item: Godot Cheap Ground Fog,
author release November14 and coverage November17. This browser implementation
is original analytic height haze, not a Godot plugin port, interaction trails,
true volumetric lighting or a demonstrated speedup. Gun/HUD excluded; no indoor
fog occlusion. Primary URL above and public credits updated.

Rollback only this scoped slice. Next: verify source checkpoint, then investigate
retained storm hitches and obtain uninterrupted motion evidence before release
promotion; subsequent art polish can soften close aggregate and add local path
wear without rebuilding combat layout. Private vault remains untouched and
blocked by pre-existing dirty state; browser checkpoint skips private transfer
and makes no whole-UE/private portability claim.
