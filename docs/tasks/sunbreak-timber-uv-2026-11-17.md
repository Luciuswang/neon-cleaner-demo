# Task Packet: sunbreak-timber-uv-2026-11-17

- State: DONE (implementation and scoped QA)
- Owner/single writer: main Producer
- Created: 2026-11-17
- Branch: codex/character-continuity-pipeline
- Worker budget: one bounded read-only reviewer
- Human approval required: no; normal checkpoint upload already authorized

## Objective and scope

Correct scanned wood grain on v3 horizontal cabin wall courses, gables and
corner laps to follow each timber's length. Preserve vertical door grain.
No geometry, lighting, collision, interaction, combat or v1/v2 changes.

## Dependencies and risks

The actual weathered_brown_planks scan has grain along U, not V. All three
PBR maps must retain a shared UV mapping. Keep end-cap UVs two-dimensional.
Start fetched origin and found no source changes; private restoration stopped
on pre-existing private-vault edits. Preserve those unrelated edits; this
public, already-present web slice needs no private assets.

## Write set

- Producer only: experiments/sunbreak-storm-v3/timber-house.js and new
  qa/timber-uv-* tests, reports and actual canvas evidence.
- Producer only: this packet, new immutable docs/worklog event.
- docs/handoff.md: append only through finish script; preserve old encoding.
- Read-only: v1/v2, UE/private assets, all prior QA reports and user screenshot.
- Reviewer allowed_paths: above runtime/test/evidence and task packet, read_only=true.

## Plan and acceptance

1. Add opt-in X/Z grain projection to the existing box helper; keep its default
   mapping unchanged for the door, posts and unrelated objects.
2. Apply opt-in projection only to horizontal wall courses/gables/corner laps.
3. Check the actual rounded geometry UV directions, non-degenerate end caps,
   unchanged default mapping, shared PBR UV channel and exact baseline combat.
4. Re-run house logic and browser integration without rewriting historical QA.
5. Review current actual WebGL canvas views of interior/door and exterior.
6. Build exact-byte static package, record scoped verdict, checkpoint upload.

## Review and result

- Gatekeeper: Planck PASS TO IMPLEMENT; retain default door UVs, shared PBR
  mapping and two-dimensional end caps.
- QA verdict: PASS for this material-direction correction only. Planck independently
  reviewed before/current out, inside, angle and front actual WebGL canvas frames
  at 1920x1080 plus source/metadata; no new Major/Blocker.
- Fixed: explicit X projection for front/back courses/laps, Z for side/gable
  timbers/laps. Existing default door/fitting UVs retained byte-for-byte.
- Automated: 31/31 UV geometry checks, 28/28 house logic, 47/47 actual-browser
  synthetic house integration, exact combat comparison and mutation self-tests;
  static package exact-runtime-byte check PASS. Page error/warning log empty
  during house fixture check. v1/v2 diff against baseline empty.
- Evidence/report: experiments/sunbreak-storm-v3/qa/timber-uv-report.json and
  qa/timber-uv-evidence/ (four current frames, pre-fix comparison, metadata and
  browser fixture report). Independent art verdict in qa/timber-uv-art-review.json.
- Commands:
  `node experiments/sunbreak-storm-v3/qa/timber-uv-verify.mjs`
  and, after browser captures/tests,
  `node experiments/sunbreak-storm-v3/qa/timber-uv-verify.mjs --collect`.
  Verification reuses the existing house unit suite with a new output filename,
  preserving all previous dated QA/report bytes.
- Browser normal http://127.0.0.1:5188/ restored; temporary viewport override reset.
- Remaining Minor: existing texture repetition; no unrelated art polish added.
- Old performance/art conclusions remain historical, not current-build passes.
- No UE5/Lumen/Nanite or cinematic/AI-video acceptance claim.
- Checkpoint: containing commit; finish script must verify normal origin push/LFS.
  Private asset transfer intentionally skipped because of the preserved unrelated
  dirty private vault; this is not a full UE/private-assets portability claim.
- Next: user refreshes third demo and compares the corrected cabin.
