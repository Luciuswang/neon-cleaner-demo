# Task Packet: G3-RIDER-POSE Strict Visual QA

- State: `INTAKE`
- Owner: `Orchestrator / Producer`
- Created: `2026-08-31`
- Target branch: `codex/character-continuity-pipeline`
- Quality gate: `Gate 3`
- Worker budget: `2` read-only reviewers / one UE writer if needed
- Human approval required: `no` for local review; `yes` before AI-video regeneration

## Objective

Clear the Gate 3 rider pose for playable and AI-to-UE continuity without
changing Lin Xia's identity source or introducing another blind C++ pose hack.

## Scope

- Review the current generated ride animation, Phase IK Rig, and Control Rig.
- Capture and inspect default, side, and rear rider views.
- Make one bounded UE animation/rig improvement only if the evidence identifies
  a concrete contact or balance defect.
- Run the strict Gate 3 quality check and record the result.

## Out Of Scope

- AI-video regeneration before strict visual QA passes.
- Replacing the Phase identity source or Marketplace asset.
- Final motorcycle rig, combat, city dressing, or unrelated HUD changes.
- More blind C++ hand/foot target tuning after the rejected IK attempts.

## Dependencies And Risks

- Local `ParagonPhase` Marketplace content must be restored from Epic/Fab.
- UE 5.8 C++ toolchain must be available for a full build; `-SkipBuild` is
  allowed only when the current build is unchanged and that exception is noted.
- `.uasset`, `.umap`, `.uproject`, rig, animation, and shared status files need
  one writer at a time.
- AI-video continuity remains `BLOCKED` until the strict visual verdict is
  `PASS`.

## Acceptance Criteria

- [ ] The rider reads as Lin Xia / Phase in all required views.
- [ ] Hips, torso, hands, feet, bars, pegs, and seat relate believably.
- [ ] Motorcycle wheels remain grounded and the rider reads as balanced.
- [ ] Automated build/validation/smoke checks pass, or the skipped check is
      explicitly justified.
- [ ] `FullVisualQA` produces default, side, and rear proof frames.
- [ ] `StrictRiderPoseGate` receives an explicit `PASS`, `CONDITIONAL`, or
      `REJECT` decision from visual QA.

## Write Set

- `allowed_paths`: assigned rider animation/rig scripts, assigned rider C++
  files, and generated `Content/LinxiaRig` assets only if the UE writer needs
  to change them.
- `read_only_paths`: `docs/quality-control.md`, `docs/qa/`, current proof
  captures, and the existing Gate 3 implementation.
- `single_writer`: one UE writer and one UE process; Orchestrator owns the
  final handoff/QA report update.

## Parallel Read-Only Checks

- **Technical QA:** confirm build, validation, possession, HUD, and capture
  script coverage.
- **Visual QA:** inspect default/side/rear frames for rider contact, balance,
  silhouette, and identity continuity.
- **Asset/Sync QA:** confirm the local Phase restore requirement and that no
  Marketplace content enters the public repo.

## Verification

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1 `
  -FullVisualQA `
  -StrictRiderPoseGate `
  -RiderPoseVerdict <PASS|CONDITIONAL|REJECT>
```

Expected proof: default, side, and rear frames under ignored `Saved/Quality`,
plus a repo QA note when the slice is complete.

## Review Decision

- Gatekeeper: `PENDING`
- Reason: the task is ready for a fresh multi-view review, but no new
  implementation should start until the evidence shows a specific defect.

## Result

- State: `INTAKE`
- Changed files: none yet
- Commands and results: pending
- Evidence: pending
- QA verdict: pending
- Remaining risks: seated contact and AI-video continuity remain unresolved
- Commit: pending
- Next action: run the parallel read-only checks, then either close as a
  review-only result or dispatch one bounded UE writer fix.
