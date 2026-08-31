# Task Packet: G3-RIDER-POSE Strict Visual QA

- State: `BLOCKED`
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
- UE 5.8 C++ toolchain must be available for a full build; this machine now has
  a verified Visual Studio/MSVC/Windows SDK/.NET toolchain.
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

- Gatekeeper: `BLOCKED`
- Reason: the local UE 5.8 toolchain and compiled module are restored, but the
  local ParagonPhase content is still missing. No new implementation should
  start until the Phase asset is restored.

## Result

- State: `BLOCKED`
- Changed files: `ue/Run-Gate3QualityCheck.ps1`,
  `ue/Setup-LinxiaRigAssets.ps1`, and this QA/task documentation update.
- Commands and results: the full UE editor build passed. Then
  `Run-Gate3QualityCheck.ps1 -SkipBuild -FullVisualQA` reached the Python map
  validator and stopped on the missing `Phase_GDC` mesh / `Phase_AnimBlueprint`.
  The script-path-with-spaces issue is fixed and verified.
- Evidence: `docs/qa/gate3-quality-report-2026-08-31.md` and the existing
  `source/reference/linxia/ue-captures/linxia_motorcycle_gate3_quality_2026-08-27_123649.png`
- QA verdict: `ENGINEERING: BLOCKED`; `VISUAL: CONDITIONAL`; `CONTINUITY: BLOCKED`
- Remaining risks: seated contact and AI-video continuity remain unresolved
- Commit: pending
- Next action: restore ParagonPhase from Epic/Fab, then rerun the full Gate 3
  check before considering any pose implementation.
