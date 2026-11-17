# Task Packet: SUNBREAK river village map

- Task: sunbreak-river-map-2026-11-17
- State: LOCAL QA CONDITIONAL PASS; PUBLICATION PENDING
- Owner: Codex integrator, single runtime writer; Fable 5.2 requested producer
- Baseline: bb30122fefdb748a048e2e2c7dccd5dc5e9f43c9
- Branch: codex/character-continuity-pipeline
- Gate: new browser FPS map; AAA/Delta Force parity is an aspiration, not certified
- Worker budget: one Fable producer call at a time, two independent read-only reviewers
- Authority: autonomous new-map production, existing Gateway credit use, normal configured GitHub publication

## Objective

Create a separate playable fourth-version map: rainy Vietnamese-inspired mountain
village split by a shallow stony river, approximately symmetric playable banks,
partly collapsed vernacular houses, wet mud, weeds, dense layered forest. Reuse
v4 weapon/arms/reload and NPC art/animation. Preserve all earlier demo URLs/assets.

## Plan

1. Resolve exact requested claude-fable-5-2 through existing CLI/Gateway; record
   returned model usage and errors without credentials or hidden transcripts.
2. Build an isolated experiments/sunbreak-river-v4 overlay. Pinned public assets
   remain shared with v3/v4. Authored map logic owns traversal, floor, cover and
   shot proxies together; layouts are paired across the central river.
3. Use real PBR source textures with redistribution permission where available,
   instanced vegetation/rocks, modeled ruins, flowing water/reflection/rain rings,
   physically scaled material tiling, environmental lighting and restrained post.
4. Current-build offscreen actual WebGL canvas views, collision/path/symmetry and
   held-fire/reload tests; independent art and engineering verdicts. Measure actual
   1080p gameplay pacing for >=30s, retaining failures. No desktop interaction.
5. Commit/source checkpoint, scoped new /sunbreak/river/ publication through normal
   protected-main PR, anonymous byte/input validation. Never overwrite v4.

## Scope and limits

This changes the map, not the gun damage/rate or animation assets. Structural
symmetry is testable; competitive balance needs human/multiplayer playtesting.
No current match server exists: CS-like fairness layout does not imply real 4v4.
No UE conversion, purchase, email or SeaTalk action is included.

## Dependencies and risks

Start fetched all remote branches; baseline is current and worktree clean.
Private restore stopped on pre-existing unfinished vault changes. Preserve them;
this public browser slice needs no private UE assets and must not claim full UE
portability. No missing local private resource is being recreated.
Initial installed CLI 2.1.252 probe failed with explicit version-too-old error
(requires >=2.1.290), not exhausted credits. Isolated npm CLI 2.1.326 is available;
exact-model authenticated verification pending. No global auth settings changed.

## Write set

- Main only: experiments/sunbreak-river-v4/**, this packet, immutable
  docs/worklog/sunbreak-river-map-2026-11-17.json, finish-appended handoff note.
- Read-only: all earlier experiments, public shared assets, user originals,
  UE/private assets. Independent reviewers have no write paths.
- Remote task lease acquired/verified before writing. Fable output is a candidate
  returned without tools; integrator applies reviewed changes via apply_patch.

## Acceptance

- [x] Fable model identity verified, generated contribution accurately recorded.
- [x] Central river, wet mud, layered vegetation and Vietnamese-inspired ruins.
- [x] Equal paired spawn-to-crossing distances and collision geometry; connected
      routes on both banks; riverbed floor and bullet cover match visible meshes.
- [x] Existing NPC/weapon assets and full-auto/reload behavior retained.
- [x] Actual rendered multiview and runtime tests with explicit independent verdict.
- [ ] Scoped publication, earlier versions preserved, anonymous live verification.

## Review decision

Planck: PASS TO IMPLEMENT. Required one geometry contract, actual both-direction
crossing tests, mirrored walkable route lengths, shot occlusion, original animation
hashes, source-bound canvas views and >=30s1080p combat/audio pacing. Thresholds
remain p95/p99<=33.3ms,max<=50ms,zero>50ms; retain failures.
The entire shallow river is wadeable, with three raised easy crossings. No swimming.
Exact model probe succeeded using isolated CLI2.1.326: returned READY, modelUsage
contains only claude-fable-5-2, CLI-reported cost0.068676USD (not independent billing).
Tool-free Fable architecture generation is running with a6USD cap; no global
account/auth settings were changed. Main integrates shared data/terrain/vegetation.

## Production evidence and corrections

Exact requested model succeeded: claude-fable-5-2 via isolated CLI2.1.326 and
existing Gateway. Final complete visible-text generation7227bytes, CLI-reported
cost0.4723296USD (not independently verified billing). Original candidate saved
at source/fable-village.js; integration fixes are explicit in fable-production.json.
Two initial long calls exceeded output-token caps; compact extraction initially
retained a tail/empty result. Those outputs were rejected, not applied. No quota
exhaustion was established and no account configuration or credentials changed.

New scene uses verified CC0 Poly Haven mud/gravel/brick surfaces and scanned
tree/fern/grass geometry. Whole-leaf derivatives replace fragmentary automatic
simplification. All six houses and76collision walls are paired; original player,
weapon, reload, NPC art/animation, firing and audio source files remain identical.
Current architecture includes2496modeled tiles, complete/half/ruined roofs,
broken masonry, a12m timber bridge, two gravel fords and an out-of-play water tank.
The entire shallow river remains wadeable; bridge58cm auto-step is intentional.

Independent engineering identified start connector loss, short corner cuts,
thin-cover omission, invalid doorway graph edges and Float32/material-side terrain
ray issues. Corrected with explicit regressions. Current tests include18CPU map
groups,62actual AI-update route cases, rendered-geometry ray comparison,76exact
architectural wall checks,40actual-browser traversal checks and32input/reload
checks; final release collector must bind reruns to final source hashes.

Offscreen actual WebGL multi-view images are archived, not desktop screenshots.
Art reviewer first returned REVISE for canal-like water, noisy surfaces and cloned
silhouettes. River/ford outline, depth mask, material contrast, ruined edges,
fallen beams and water-tank landmark were revised.13:21 eight-view rereview:
CONDITIONAL PASS for web-prototype art, no continuous-motion or AAA certification.

Performance remains separately gated. Early terrain triangle scans caused long
frames; exact grid DDA replaced them without removing ground shot occlusion.
Later samples have normal18ms frame pacing but isolated176–318ms stalls. Causes
are not established; storms are not proven responsible. Failures remain archived.
Per-frame rain/splash temporary arrays removed; profiler and final strict pair
pending. No threshold has been lowered or failed sample omitted.

## Final local gate

Source-bound collector CONDITIONAL PASS. CPU18, AI62, exact terrain175 rays,
76architectural wall proxies, browser32controls/40traversals, eight1080p views.
Final two declared1080p30scombat+rain+audio samples: p95 18.3/18.4ms,
p99 18.5/18.5ms, maxima18.7/18.8ms, zero>50ms;232player shots each and55/54
NPC audio shots. Planck independently recalculated raw frames and source bindings:
bounded runtime PASS. Zeno art CONDITIONAL PASS. Earlier176–318ms failures remain
unexplained; the allocation optimization is not proven to have cured them.
No continuous-motion, human balance, real4v4, AAA or UE acceptance.

## Publication preflight

Source/runtime checkpoint76116eae is uploaded with2LFS objects. Independent
publication review required pinning the exact prepared PR head/base and the entire
manifest, not trusting a live manifest to provide its own expected file list.
Both checks added with2positive/10negative regression cases. No runtime or asset
bytes changed; final local QA source bindings remain valid. Publication pending.

## Next action

Publish only the new /sunbreak/river/ subtree through a normal protected-main PR;
verify anonymous
bytes and actual public input. Private vault remains untouched and blocked by its
pre-existing dirty state; this public-only slice uses -SkipPrivateAssets and makes
no full UE/private-asset portability claim.
