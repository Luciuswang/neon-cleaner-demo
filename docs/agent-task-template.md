# Neon Cleaner Agent Task Packet Template

Copy this template into a task note when a slice is large enough to need
planning, review, or more than one Agent. Keep one packet per slice so another
PC can resume it without the original chat.

```markdown
# Task Packet: <short-id> <title>

- State: `INTAKE`
- Owner: `<orchestrator/producer>`
- Created: `<YYYY-MM-DD>`
- Target branch: `codex/character-continuity-pipeline`
- Quality gate: `<Gate 1/2/3/4/5 or none>`
- Worker budget: `<0-4 extra agents>` / `<time budget>`
- Human approval required: `no` / `yes — <why>`

## Objective

<One sentence describing the user-visible result.>

## Scope

- <included change>

## Out Of Scope

- <explicitly deferred work>

## Dependencies And Risks

- <toolchain, local asset, license, or prior gate dependency>

## Acceptance Criteria

- [ ] <observable criterion>
- [ ] <automated validation criterion>
- [ ] <visual criterion, if applicable>

## Write Set

- `allowed_paths`: `<files/folders the implementation worker may change>`
- `read_only_paths`: `<files/folders used for reference>`
- `single_writer`: `<one owner for shared UE or status files>`

## Parallel Read-Only Checks

- `<Agent/role>`: `<question>` -> `<expected evidence>`

## Verification

```powershell
<exact command>
```

Expected proof: `<log/image/video/path or “not visual”>`

## Review Decision

- Gatekeeper: `PENDING` / `PASS` / `REWORK` / `BLOCKED`
- Reason: `<short, concrete reason>`

## Result

- State: `QA` / `DONE` / `REWORK` / `BLOCKED`
- Changed files: `<list>`
- Commands and results: `<summary>`
- Evidence: `<paths>`
- QA verdict: `PASS` / `CONDITIONAL PASS` / `BLOCKED`
- Remaining risks: `<list>`
- Commit: `<hash>`
- Next action: `<one action>`
```

## Current Neon Cleaner Example

For the current Gate 3 rider-animation work, a valid packet would keep the
following boundaries:

- UE Engineering may edit the rider animation/rig scripts and assigned C++
  files, one writer at a time.
- Visual QA may inspect default/side/rear captures in parallel, but does not
  edit the rider implementation.
- Asset/License may verify whether the required Phase source is local and
  restorable, but does not upload Marketplace content to GitHub.
- The Orchestrator records the strict rider-pose verdict and updates the
  handoff only after the evidence is available.
