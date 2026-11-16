# Task Packet: SUNBREAK enterable timber house

- Task ID: sunbreak-timber-house-2026-11-16
- State: DONE for requested browser-building/save/report slice; minor art polish remains
- Owner: main integrator, sole implementation/release writer
- Created: 2026-11-16
- Branch: codex/character-continuity-pipeline
- Baseline: 02f7476, preserved storm-v3 checkpoint
- Quality gate: browser architectural interaction; not UE cinematic acceptance
- Worker budget: one bounded read-only Gatekeeper / independent QA reviewer
- User authority: replace specified building, open/enter, upload all three demos,
  send today's factual report to the connected account's own email

## Objective / scope

Replace only MERCADO12 at [12,-18], footprint8x8, with a reference-led timber
cabin: horizontal squared logs, interlocking corners, pale raised foundation,
steep sheet-metal gable roof, cream window trim, wooden veranda/rails/stairs.
Provide a proximity-operated hinged door, genuine lit interior and collision.
Retain other buildings, enemy spawns, crates, fire/damage/ammo/reload/AI rules.
Opening this one former solid intentionally changes its local traversal and
cover; do not claim the original18-proxy contract remains unchanged.

## Out of scope / dependencies

No UE migration, private assets, AI video, paid assets, weapon-rule changes,
snow/blue-sky replacement, copying the reference watermark or photo texture.
Use existing licensed scanned wood maps and authored geometry. Existing dirty
private vault is unrelated and preserved; start fetched all branches/LFS but
private restore stopped on that known conflict. Public browser slice is isolated.
Previous ~1FPS background performance failure remains unless current tests pass.
Prior Sites creation terminal backfill error remains; no speculative duplicate.

## Write set / ownership

- Main only: experiments/sunbreak-storm-v3/
- Main only: this packet; docs/reports/sunbreak-daily-2026-11-16.md;
  docs/worklog/ (including required automatically appended immutable events)
- Handoff append only through finish script; retain its historical encoding.
- Read-only: v1/v2, all UE/private files, supplied reference images.
- Reviewer: read_only=true, no source/docs edits, Sites or email actions.

## Acceptance / verification plan

- [x] Wood courses, corner laps, gable/sheet roof, pale plinth, cream windows,
  porch and stair geometry recognizably match the supplied structural reference.
- [x] Door closed blocks walking and bullets; open permits crossing; walls
  remain solid; closing cannot trap/intersect player; no remote/UI/paused trigger.
- [x] Stairs/deck/interior height and jump/exit work; rain excluded under roof.
- [x] Genuine interior contains floor/ceiling/walls and warm practical lighting.
- [x] Other17 baseline proxies and all original combat constants/functions
  unchanged except exact documented door/floor hooks; v1/v2 byte hashes pinned.
- [x] Current-source static/unit and explicit browser integration checks,
  actual canvas evidence plus independent bounded art/functional review.
- [x] Static build includes all runtime modules and preserved comparison pages.
- [x] Git/Git LFS push acknowledgement for all three demo directories.
- [x] Daily report sourced from all-origin current-day dossier and actual QA;
  email sent once to self after successful upload; no localhost-as-online claim.

## Review / result

- Gatekeeper: PASS TO IMPLEMENT after explicit local traversal/cover, player-only
  support, actor-aware collision, dual ray/movement and spawn-clearance contracts.
- Current implementation:195 horizontal log segments,88 lap ends,8 real glazed
  windows, plinth, sheet roof, veranda/stair, real lit/furnished room and door.
- Integrator QA:28 house units,47 browser house fixtures,38 weather fixtures,
  12 weather-audio units; exact baseline after documented local hooks and
  mutation self-tests; RNG init0 added, first frame8=baseline8.
- Current1080p actual scripted combat/audio:30.014s,1706 raw frames,
  P95=18.2ms/P99=18.3ms/max18.8ms/zero>50ms. Strict thresholds unchanged.
  This bounded current-source result passes; earlier failed measurements remain
  historical and do not certify or invalidate this separate measurement.
- Independent Planck review:CONDITIONAL PASS for building slice, no newP0/P1.
  Actual five representative frames compared to reference. Wood-grain direction/
  repetition, pale highlights, blocky furniture remain Minor. Not AAA/UE5 parity.
- Final slice QA:CONDITIONAL PASS, current report at
  experiments/sunbreak-storm-v3/qa/house-release-report.json.
- Actual verification is synthetic integration plus representative frames and
  one bounded combat sample, not a full human playthrough/continuous review.
- Production upload:verified cb7181359e24e47da2486cfb36c7c0464debf939 on
  origin/codex/character-continuity-pipeline, with normal LFS pre-push included.
  All three experiment directories present; no v1/v2 changes from02f7476.
- Daily evidence:all12 origin branches fetched at2026-11-16T12:46:10Z;
  16 unique today commits =5 production+11 coordination. Report prepared at
  docs/reports/sunbreak-daily-2026-11-16.md. Auxiliary undated worklogs disclosed.
- Report upload:verified c6d36bfee4aa659ceda34e1423e555e013482d67 on origin.
- Email:sent once to the connected account's self address on2026-11-16.
  Mail service returned message/thread identifiers and SENT+INBOX labels.
  Full HTML daily report includes all three GitHub paths, current evidence,
  reference implementation, historical failures and scope limitations.
  This confirms service send/self-inbox acknowledgement, not that the user read it.
  Account address and mail identifiers are intentionally not published here.
- Browser:temporary viewport reset, diagnostic tab closed, normal5188 page marked
  as deliverable; normal startup has no logged errors.
- Next:user audition/walkthrough and three-version comparison; optional minor
  grain/highlight/furniture polish. No unresolved upload/email dependency.
- Rollback: earlier storm version remains at02f7476; v1/v2 untouched.
