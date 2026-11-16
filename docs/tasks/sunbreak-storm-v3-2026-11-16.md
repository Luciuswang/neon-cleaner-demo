# Task Packet: SUNBREAK storm v3

- Task ID: sunbreak-storm-v3-2026-11-16
- Created: 2026-11-16
- State: PLAYABLE CHECKPOINT / QA REWORK (not final UE5-photorealistic acceptance)
- Owner: main integrator; single site/source writer.
- Branch: codex/character-continuity-pipeline
- Baseline: a89c758 recorded-audio v2, earliest original remains immutable.
- Worker budget: two bounded read-only specialists (asset research, Gatekeeper/QA).
- Authority: requested autonomous third version; routine checkpoint publishing authorized.

## Objective

Create a separate playable storm-night rendering variant of SUNBREAK with
realistic wet ground, moving storm clouds, rain, lightning, warm lit interiors,
vegetation, a detailed compact SMG viewmodel and restrained post processing,
without changing the combat layout, inputs, AI, damage or timing.

## Scope and engine truth

The existing deliverable is a browser FPS. This slice extends its WebGL/PBR
rendering toward the requested UE5 visual direction; it is NOT an Unreal
Engine executable, Lumen, Nanite or hardware ray tracing. Do not label it so.
Actual UE migration would be a separate implementation, not a visual checkbox.
No claim of AAA/photorealistic parity until independent rendered-frame review.

## Plan

1. Clone the existing public browser runtime and licensed assets into an
   isolated v3 directory. Never edit either v1 or v2.
2. Preserve the inline game module byte-for-byte apart from exact documented
   render-only bootstrap/import changes. Retain all eighteen original proxies,
   six spawn sites, RNG behavior and original weapon/muzzle anchors.
3. Improve source-backed surfaces, rainy sky, animated water ripples/reflections,
   practical/interior lighting, lightning and peripheral plants with bounded
   rendering cost. Add a compact SMG viewmodel without changing fire semantics.
4. Obtain only clearly redistributable assets; record license/source/hash and
   distinguish authored geometry, generated artwork and actual game renders.
5. Run static/mutation checks and source-bound browser regression, weather,
   capture and real-combat performance diagnostics. Inspect rendered views;
   automated green checks do not establish hyperrealism.
6. Independent QA returns an explicit bounded verdict. Preserve evidence and
   limitations; save/upload checkpoint. Attempt owner-private Sites publishing
   after validation if supported, without publishing unrelated repository data.

## Write set

- Main only: `experiments/sunbreak-storm-v3/`, this task packet,
  `docs/worklog/sunbreak-storm-v3-2026-11-16.json`.
- Shared handoff: append using finish script only; do not transcode existing bytes.
- Read-only: `experiments/sunbreak-fable52/`, `experiments/sunbreak-realistic-v2/`,
  all UE sources/assets/maps, `.local/private-vault/`.
- Read-only specialists return findings only, no Sites calls or source edits.

## Acceptance criteria

- [x] Separate v3 URL, earlier versions still byte-identical.
- [x] Exact original gameplay comparator and mutation tests pass.
- [ ] Final foreground proxy/runtime regression; earlier 217-check pass exists
  in session history, but latest background wall-time smoke fails and blocks
  its dependent runtime verdict. Do not present earlier results as final PASS.
- [x] Rain visible at default start; moving clouds and restrained lightning.
- [x] Ground shows source-backed material microdetail and masked reflections,
  not a uniformly mirrored floor. Rain rings and wet/dry breakup are visible.
- [x] House windows reveal warm interior depth/lights; exterior light pools
  respond on actual materials. No new navigable buildings/cover.
- [x] Licensed MP5, textured arms, reduced framing and measured original muzzle
  anchor. Baked held pose with original continuous sleeve fabric fitted offscreen;
  wrists/grip unchanged, not a fully authored arm/reload animation.
- [x] Grass/vegetation avoid blocking combat lanes and sightlines.
- [x] Optional post/flash-reduction controls, readable menus and input lifecycle.
- [x] Local asset failures surfaced; no required credentials or external APIs.
- [ ] Final foreground >=30s actual-combat performance acceptance;
  report all measured frames/hitches, do not hide failures.
- [x] Independent engineering/art findings and exact known limits recorded.

## Dependencies and known risks

Sync start fetched all origin branches/LFS and preserved the current clean
branch. Pinned UE private restore again stopped on pre-existing local vault
changes. Do not modify that vault or recreate its assets. This isolated browser
slice uses only public local assets and has no dependency on the UE snapshot;
finish with the documented isolated `-SkipPrivateAssets` option, no UE-portability
claim. True SMG production meshes may be license/download constrained; do not
silently substitute a screenshot or unlicensed commercial model.

## Review decision

- Gatekeeper: PASS TO IMPLEMENT, independent reviewer Planck. Preserve exact
  gameplay exceptions and 18 proxies; match storm environment/weapon lighting,
  test lifecycle and bind every new module/manifest to current evidence.
- Final engineering: REWORK until current foreground regression/performance pass.
  No acceptance threshold was lowered. Latest report is the source of truth.
- Art: final representative hero frame receives CONDITIONAL PASS for WIP only;
  original sleeve join/cutoff resolved with continuous source fabric. Not
  approved as UE5/AAA photorealism or continuous motion. Buildings,
  repeated windows and simple character/held-pose arm animation remain
  below that target even though storm materials and weapon are substantially
  improved. See `experiments/sunbreak-storm-v3/qa/review.md`.
- Local playable URL: http://127.0.0.1:5188/ . v1 `/original/`, v2 `/v2/`.
- Production source is isolated in `experiments/sunbreak-storm-v3/`; v1/v2 pinned
  hashes are checked by `qa/verify-release.mjs`. Static output build succeeds.
- Refreshed final static views, startup0/8-vs-baseline8 and storm38/38 bind to
  the final sleeve-fit build. Earlier lightning triptych predates this fit and
  remains explicitly stale; the verifier must continue reporting that failure.
- Public asset provenance: CC0 Poly Haven PBR/HDR + recorded firearm audio;
  CC-BY Rotuma MP5, credited arms/rig and DanlyVostok tactical soldier.
  Local r160 dependencies and full Three/Meshopt MIT licenses are included.
- Added visual initialization consumes zero global RNG draws. First-frame
  draws equal original baseline8. This uses a documented, separately hashed
  presentation dependency graph, not a production global RNG swap.
- The later 1fps browser-background condition causes wall-time smoke fixtures
  to finish before original game-time reload/look/AI steps. Preserve failures;
  a foreground browser session is needed for final acceptance. Time-separated
  lightning captures are not a full continuous/normal-speed video review.
- Frozen-build benchmark at 2026-11-16T11:51:39.102Z:30135ms,30frames,
  P95=1016.4ms, max=1016.7ms,30frames>50ms; running recorded player28/enemy21
  shots and thunder1. Source-bound FAIL, not a performance approval.
- Owner-private Sites creation returned terminal `project_invariant_error`
  ("Sites backfill is in progress in this destination"). No site ID returned,
  no hosted deployment claimed; do not retry with random slugs.
- Next concrete action: open the normal v3 preview in an active foreground
  browser, rerun unchanged `/test`, `/storm-test` and the 30s1080p recorded-audio
  combat benchmark. Then address the remaining art findings; a genuine Unreal
  Engine migration is a separately scoped implementation.
