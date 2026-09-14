# Task Packet: Kelly Low Session Recovery

- State: `DONE` (startup/handoff fix; private asset recovery remains blocked)
- Owner: `Orchestrator / Producer`
- Created: `2026-09-14`
- Target branch: `codex/character-continuity-pipeline`
- Quality gate: `Gate 5 recovery; Gate 3 remains blocked locally`
- Worker budget: `1 read-only Gatekeeper / QA reviewer`
- Human approval required: `source location needed for private asset recovery`

## Objective

Make the session startup and handoff describe the textured low-poly Kelly
baseline at commit `5019f8b` and report failed Git synchronization accurately.

## Scope

- Check KellyLowSource/asda.uasset and name the low-poly migration script.
- Stop on failed branch detection, checkout, status, fetch, pull, or LFS pull.
- Inspect local recovery dependencies and record the current blocker.
- Update current handoff and sprint entries without rewriting historical QA.

## Out Of Scope

- Rider implementation, UE binary changes, AI generation, external transfers.
- Replacing private Kelly with the older Phase character.

## Dependencies And Risks

- UE 5.8 is installed, but KellyLowSource and default D:/kelly-UE are absent.
- The first sandboxed startup returned success despite FETCH_HEAD permission
  errors. The elevated startup then synchronized successfully.
- Private content must remain ignored by Git.

## Acceptance Criteria

- [x] Startup matches the mesh path used by the current C++ implementation.
- [x] Failed Git synchronization cannot reach a success-looking final state.
- [x] Handoff states the restore command and separates historical proof from
      validation on this PC.
- [x] PowerShell syntax and isolated Git-failure checks pass.
- [x] Independent review finds no blocking issue.

## Write Set

- `allowed_paths`: sync_project_start.ps1, docs/handoff-kelly-2026-09-07.md,
  docs/handoff-kelly-low-2026-09-14.md, docs/sprint-2026-08-24.md, this packet.
- `read_only_paths`: all UE code/assets, historical reports, private source.
- `single_writer`: main Orchestrator only.

## Parallel Read-Only Checks

- Gatekeeper / QA: inspect plan, then review final startup behavior and docs.

## Verification

PowerShell parser, isolated mocked Git failures, actual startup synchronization,
and `git diff --check`. No Gate 3 execution while required private mesh is absent.

## Review Decision

- Gatekeeper: `PASS` (independent read-only reviewer)
- Reason: matches current mesh, preserves private-content boundaries, and
  separates historical evidence from the missing local dependency.
- Plan adjustment: docs/handoff.md contains mixed UTF-8/GBK bytes, so current
  recovery notes use a new UTF-8 handoff linked by startup, the prior Kelly
  handoff, and the sprint. The historical file is preserved byte-for-byte.

## Result

- State: `DONE` for startup/handoff correction.
- Changed files: the five files declared in Write Set.
- Commands and results:
  - PowerShell Parser.ParseFile on sync_project_start.ps1: PASS.
  - Isolated mock-git invocation of sync_project_start.ps1: 12 cases PASS
    (branch, checkout, status, clean/dirty fetch, pull, LFS pull, final status,
    final log failures; clean/dirty success; missing-mesh ValidateUE).
  - Actual .\sync_project_start.ps1 with Git write/network access: PASS;
    dirty worktree fetched without pulling, LFS pull succeeded, low-poly mesh
    absence was reported with the correct migration command.
  - git diff --check: PASS.
- Evidence: startup output identifies 5019f8b and missing KellyLowSource;
  current restore steps are in docs/handoff-kelly-low-2026-09-14.md.
- QA verdict: independent read-only reviewer PASS for this bounded fix.
- Remaining risks: local UE/Gate 3 and AI-video continuity remain BLOCKED;
  no new UE run or visual acceptance was performed in this session.
- Commit: pending user decision at session finish.
- Next action: locate the user's private low-poly UE source and migrate it,
  then rerun Gate 3 before rider implementation.
