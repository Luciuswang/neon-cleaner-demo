# Task Packet: procedural-material-lab-2026-11-19

- State: `REWORK`
- Owner: root producer / integrator
- Created: 2026-11-19
- Target branch: `codex/character-continuity-pipeline`
- Quality gate: isolated browser material study; cinematic acceptance remains separate
- Worker budget: 2 workers / 90-minute implementation and evidence slice
- Human approval required: no

## Objective

Deliver a separate, inspectable procedural-material study matching the user's
container/concrete reference before migrating any technique into Riverfall.
No claim of AAA game completion from a material study.

## Scope

- Reuse the actual MIT-licensed wquguru material study, retain attribution and
  unchanged reference bytes, pin Three.js locally.
- Add a clearly labeled derived study: controlled wetness, moving water detail,
  lighting presets, material diagnostics, same-camera reference comparison.
- No runtime external image, model, HDR, or font dependencies.
- Actual native-headless WebGL evidence, controls checks, network audit, and
  30-second real-time 1920x1080 performance samples after contiguous warmup.

## Out Of Scope

- No changes to existing demos, game rules, private UE assets, or public Pages.
- Do not redistribute supplied Saltline HTML: its license is unverified.
- No assertion that Fable was called; implementation uses this coding session.
- Riverfall integration deferred until independent reference-quality approval.

## Dependencies And Risks

- Reference: https://github.com/wquguru/fable52-fps-repro (MIT).
- WebGL/native GPU required; renderer fallback must be disclosed.
- Existing dirty private-vault blocks full project startup sync. Leave untouched;
  use public-only checkpoint with SkipPrivateAssets, not full UE portability.
- Planar reflection clipping, wetness transitions, shader compile, stale PMREM,
  and excessive microcontrast require inspection. Sampled stills do not prove
  continuous temporal quality.

## Acceptance Criteria

- [x] Reference and derived views load from local files with zero external requests.
- [x] Same-camera A/B, wetness, lighting, diagnostics, orbit and reset work.
- [x] Independent actual-image review of material/structure/focal hierarchy (sampled).
- [x] Shader/runtime errors absent; source hashes and raw evidence retained.
- [ ] 30-second 1080p realtime p95/p99 <=33.3ms, max <=50ms, zero >50ms.
- [x] Temporal verdict explicitly distinguishes sampled review and continuous review.
- [x] Existing demo bytes unchanged and MIT notices preserved.

## Write Set

- allowed_paths: `experiments/procedural-material-lab/`, this task packet,
  `docs/handoff.md` (ASCII append by finish script), `docs/sprint-2026-08-24.md`,
  `docs/worklog/` (new immutable event only, unique filename from finish script)
- read_only_paths: existing demos, supplied HTML, reference research folder
- single_writer: root runtime/UI/docs; QA sidecar owns qa/browser.mjs and
  qa/validate.mjs only. Gatekeeper and subsequent visual reviewer read-only.
- Remote lease acquired before implementation.

## Parallel Read-Only Checks

- Gatekeeper: scope, attribution, measurable gates and likely shader risks.
- QA Director: evidence-backed art and engineering verdict after render.

## Verification

Commands (from repo root):

```powershell
node experiments/procedural-material-lab/serve.mjs
node experiments/procedural-material-lab/qa/browser.mjs --phase=visual
node experiments/procedural-material-lab/qa/browser.mjs --phase=performance
node experiments/procedural-material-lab/qa/validate.mjs
```

Native-headless Chrome with isolated cold profile, cache disabled, external HTTP
blocked and all requests audited. Outputs: timestamped `qa/evidence/` directories.
Reports use `offscreen-cinematic-v1` plus `scope: browser-material-study` and a
browser-specific validator: NOT the UE validator and no invented UE provenance.
Record browser version, actual GPU/backend, source hashes, camera/settings,
actual render dimensions, PNG hashes and errors. Native GPU gate is required.
Performance: 10-second contiguous warmup, then 30 seconds of raw realtime rAF
intervals at 1920x1080, no frame export during measurement. Report p50/p95/p99,
max and counts above 50ms, preserving failures. Temporal image sampling is not
continuous acceptance. Inspect dry/mid/wet, all lighting presets and grazing views.
Same-camera comparison holds exposure/time fixed. Exact upstream bytes and
revision/hash pins retained; offline baseline differs only in import URL.

Rollback: all runtime changes live only in the new lab directory; preserve older
demos byte-for-byte. No migration without independent approval. Stage only the
lab, task, sprint, handoff and new worklog. Inspect that no unrelated pending paths
exist, then finish with `-SkipPrivateAssets -Note ...`; the finish script appends
handoff and the immutable event before staging. Its `-StagedOnly` option cannot
stage that newly appended handoff note, so use the inspected clean-scope default
staging path. This does not repair/verify the existing private-vault state.

## Review Decision

- Gatekeeper: PASS on second review. Evidence contract distinguishes browser
  capture from UE, binds source/settings, and retains failures.
- Source review: REWORK addressed (PMREM invalidation, positive native detection,
  recoverable input queue, actual low-angle light, capture-time binding).
- State history: INTAKE -> PLANNED -> REVIEW -> REWORK -> REVIEW -> READY ->
  EXECUTING -> QA -> REWORK.

## Result

- State: REWORK; usable isolated material demonstration delivered, not production migration.
- Changed files: new `experiments/procedural-material-lab/`, this packet, sprint,
  handoff and immutable checkpoint event. All prior demos remain unchanged.
- Commands: syntax checks and source/license checks pass. Browser visual matrix
  records 95 captures, actual controls, offline reference and source identity.
  Final source manifest: `9a3293f8f08c1def0b8a9f379025a84e38da85c53708874fad4531a6b19df0f3`.
- Evidence: `experiments/procedural-material-lab/qa/release.json` and linked runs.
- QA verdict: CONDITIONAL PASS for showing the material study. Strict migration /
  AAA acceptance BLOCKED. No thresholds relaxed, no gameplay changes.
- Final integrity validator: visual 216 checks, performance 26 checks; only strict
  pixel-repeat and frame-time gates fail (plus their aggregate status checks).
- Pixel-repeat: 28 pixels differ by one 8-bit channel step after all state changes;
  immediate repeats and reference-mode state cycles are exactly identical.
- Performance: native RTX5070/D3D11, 1920x1080, 10s warmup +30.0112s measurement,
  1689 raw intervals. p50/p95/p99 17.6/18.3/18.5ms; max166.3ms, two >50ms.
- Static art: reference-level sampled pass; inherited background repetition,
  exaggerated zinc/wood/tire patterning and diagnostic specular clipping remain.
  Independent final-build binding is recorded in `qa/review.json`.
- Continuous motion UNVERIFIED; representative fixed-time frames are not a movie review.
- Upload: normal public source + generated PNG evidence via scoped Git LFS;
  no private UE content. Existing dirty private vault remains unchanged.
- Next action: separately profile the two hitches and isolate the 28-pixel
  state-cycle discrepancy, then rerun unchanged gates before Riverfall integration.
