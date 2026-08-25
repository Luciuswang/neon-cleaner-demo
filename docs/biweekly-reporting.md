# Biweekly Reporting Rule

Neon Cleaner reports must be generated from project facts in GitHub, not from a
single Codex thread or one computer's local chat memory.

## Source Of Truth

Before writing a report, the reporting job must sync the project:

```powershell
.\sync_project_start.ps1
```

Then use these sources:

- `git log --since="14 days ago" --oneline --decorate`
- `git log --since="14 days ago" --stat`
- `docs/handoff.md`
- `docs/sprint-2026-08-24.md`
- `docs/gate3-playable-motorcycle-chase.md`
- `docs/agent-production-workflow.md`

Do not claim "no work was done" unless the synced GitHub branch and handoff docs
both show no relevant changes in the reporting period.

## Required Report Sections

1. Executive summary.
2. Completed work.
3. Key commits.
4. Validation / QA evidence.
5. Current blockers and risks.
6. Next two-week plan.

## Current Branch

Use:

```text
codex/character-continuity-pipeline
```

## Local-Only Asset Reminder

`ue/NeonCleanerUE/Content/ParagonPhase/` is Epic/Fab Marketplace content and is
not synced through GitHub. Its absence on one PC must be reported as a local
setup issue, not as missing project work.
