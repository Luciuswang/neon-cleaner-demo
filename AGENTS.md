# Codex Project Entry: Neon Cleaner

When the user says to start or continue the Neon Cleaner project, first treat
this repository as the source of truth. Do not rely on prior chat memory alone.

## Start Of Session

1. Run:

```powershell
.\sync_project_start.ps1
```

2. Read these files before planning or editing:

```text
docs/handoff.md
docs/sprint-2026-08-24.md
docs/agent-production-workflow.md
source/reference/linxia/README.md
```

3. Continue from branch:

```text
codex/character-continuity-pipeline
```

4. If the start script reports local uncommitted changes, inspect them before
   pulling or editing. Never overwrite another PC's work.

## Current Production Rule

Use the two-agent gate:

```text
Producer Agent -> QA Director Agent -> Fix Pass -> QA Sign-off -> Next Step
```

No major slice moves forward without a QA verdict: `PASS`,
`CONDITIONAL PASS`, or `BLOCKED`.

## UE Asset Rule

`ue/NeonCleanerUE/Content/ParagonPhase/` is local Epic/Fab Marketplace content
and must not be committed to this public GitHub repository. Restore it from the
user's Epic/Fab library on each PC.

## End Of Session

Before ending a work session, update the relevant handoff/sprint docs, then run
one of:

```powershell
.\sync_project_finish.ps1
.\sync_project_finish.ps1 -CommitMessage "short commit message" -Push
.\sync_project_finish.ps1 -Note "what changed / what is next" -CommitMessage "short commit message" -Push
```

If `sync_project_finish.ps1` says the repo is dirty and no commit message was
provided, summarize the exact pending files to the user and ask whether to
commit now.
