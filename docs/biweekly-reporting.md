# Biweekly Reporting Rule

## Cross-PC mandate — 2026-09-17

Reports aggregate published work from **every origin branch**, including work
that other computers pushed but have not integrated into the canonical branch.
Local HEAD, one conversation, and one machine's handoff file are insufficient.
The user has authorized automatic session commits/pushes; reporting does not
require another approval. A failed push must remain explicitly unpublished.

Create a reproducible remote-only evidence dossier:

```powershell
python -B tools/sync/collect_biweekly.py --since 2026-09-03 --until 2026-09-16
```

The default window is the current day plus the preceding 13 calendar days in
`Asia/Shanghai`. `--since` and `--until` accept inclusive calendar dates or ISO
timestamps with explicit offsets. `--timezone` changes date boundaries;
`--output-dir` changes the default ignored `.local/reports` destination.
When only `--until` is supplied, the default 14-day window ends on that date.

The collector:

- Fetches all `origin` heads with an explicit wildcard refspec and pruning,
  including when this checkout was cloned with `--single-branch`.
- Stops on fetch failure. It never substitutes stale cached refs or local HEAD
  and reports them as a successful all-machine synchronization.
- Freezes each remote branch SHA for the dossier, deduplicates commits by SHA,
  and labels ancestry into `codex/character-continuity-pipeline` as integrated,
  unintegrated, or unknown if that branch is absent.
- Reads `docs/worklog/*.json` from each remote tree, including branch-only
  notes. Identical event records are deduplicated across branches. Different
  payloads with the same `event_id` are retained and flagged as disagreements.
- Groups event updates by stable `task_id`, retaining distinct commits and
  evidence rather than counting a task once per computer. Cherry-picked commits
  have distinct SHAs and remain visible under the corresponding task.
- Records missing provenance explicitly. Git authors are not computer IDs;
  unpublished/offline work is unknown, not evidence of no work.

Worklogs should be immutable event records with `event_id`, `task_id`,
`timestamp_utc` (ISO 8601 with offset), `machine_id`, `status`, `summary`, and
optional `commit` or `commit_shas`. `recorded_at`, `timestamp`, and `created_at`
are supported timestamp aliases. Store no credentials, tokens, or raw machine
environment dumps. Invalid or undated records appear under incomplete
provenance and must not be silently interpreted as completed work.

Use the generated JSON and Markdown together. Commit timestamps use **committer
time**; worklogs use their explicit record time. Document reporting cutoffs and
the frozen branch heads. Do not collapse unintegrated experiments, rejected
visual work, and accepted milestones into one completed-work claim.

Verification uses disposable local bare-origin fixtures:

```powershell
python -B tools/sync/test_collect_biweekly.py
```

This command neither schedules reports nor sends them. Existing delivery
authorization and automation configuration remain separate from collection.

Neon Cleaner reports must be generated from project facts in GitHub, not from a
single Codex thread or one computer's local chat memory.

## Source Of Truth

Before writing a report, the reporting job must collect the remote dossier:

```powershell
python -B tools/sync/collect_biweekly.py
```

Then use these sources:

- The dossier's complete remote branch snapshot and deduplicated commit list.
- The dossier's cross-branch worklog events, task groups and disagreements.
- Relevant remote-tree QA/handoff documents at the reported branch heads.
- `docs/handoff.md`
- `docs/sprint-2026-08-24.md`
- `docs/gate3-playable-motorcycle-chase.md`
- `docs/agent-production-workflow.md`

Do not claim "no work was done" from an empty current-branch log. If no published
evidence matches the window, say that explicitly and preserve the limitation
that unpushed/offline work cannot be observed.

## Required Report Sections

1. Executive summary.
2. Completed work.
3. Key commits.
4. Validation / QA evidence.
5. Current blockers and risks.
6. Next two-week plan.

## Canonical integration branch

Use this branch to classify integration status, not to limit report scope:

```text
codex/character-continuity-pipeline
```

## Local-Only Asset Reminder

`ParagonPhase`, `KellySource`, `KellyLowSource`, and `CinematicBike` are private
or licensed local dependencies, not public GitHub payloads. Their absence on
one PC is a local restoration issue, not proof that project work is missing.
Use source manifests and published QA records to describe their state.
