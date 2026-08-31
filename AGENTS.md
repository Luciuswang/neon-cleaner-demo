# Codex Project Entry: Neon Cleaner

When the user says to start or continue the Neon Cleaner project, first treat
this repository as the source of truth. Do not rely on prior chat memory alone.
If the user says "开始 Neon Cleaner", "开始 Neon Cleaner 项目",
"开始霓虹清道夫", "开始这个项目", or "继续这个项目" while this repo is the
active project, run `.\sync_project_start.ps1` automatically before planning or
editing.

Codex conversations and local PC workspaces are not a single always-on shared
memory. Treat GitHub plus these repo-local handoff files as the cross-PC source
of truth.

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
docs/quality-control.md
docs/qa/gate3-quality-report-2026-08-27.md
docs/qa/gate3-quality-report-2026-08-31.md
docs/qa/linxia-rig-assets-2026-08-28.md
docs/rider-animation-source-plan-2026-08-28.md
docs/multi-agent-production-system.md
docs/agent-task-template.md
docs/tasks/gate3-rider-pose-strict-qa.md
source/reference/linxia/README.md
```

3. Continue from branch:

```text
codex/character-continuity-pipeline
```

4. If the start script reports local uncommitted changes, inspect them before
   pulling or editing. Never overwrite another PC's work.

## Current Production Rule

Use the adaptive multi-agent loop, while keeping the existing QA gate:

```text
INTAKE -> PLAN -> REVIEW/VETO -> DISPATCH -> EXECUTE -> QA -> DONE
                                      |                  |
                                      +-> REWORK/BLOCKED <-+
```

For a micro-fix, Producer + self-check is enough. For a normal slice, use
Planner -> Gatekeeper -> Producer -> QA Director. For a large slice, parallelize
independent read-only reviews, then use one writer for each UE/code path and
one Orchestrator for final integration. No major slice moves forward without a
QA verdict: `PASS`, `CONDITIONAL PASS`, or `BLOCKED`.

Read `docs/multi-agent-production-system.md` and copy
`docs/agent-task-template.md` for any slice that needs multiple workers,
multiple evidence types, or an external side effect. Never let two Agents
write the same `.uproject`, `.umap`, `.uasset`, C++ file, or active status doc
at the same time.

Read `docs/quality-control.md` before quality-sensitive work. When touching
Gate 3 motorcycle chase behavior, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1
```

Treat automated script `PASS` and visual/art `PASS` as separate things. The
current rider pose remains `CONDITIONAL`; do not use it as final AI-video
continuity until the seated riding animation or IK pass is complete.

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

## Reporting Rule

Biweekly or progress reports must be generated from GitHub plus repo-local
handoff docs, not from a single Codex chat history. Follow
`docs/biweekly-reporting.md` and sync the repo before reporting.
