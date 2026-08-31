# Neon Cleaner Multi-Agent Production System

This is the lightweight, repo-portable multi-agent layer for Neon Cleaner. It
borrows the useful governance ideas from [Edict](https://github.com/cft0808/edict)
without requiring OpenClaw, Redis, PostgreSQL, a dashboard, or a permanently
running agent service.

The project repository remains the source of truth across PCs. Runtime agents
are temporary workers; the task packet, evidence, QA verdict, handoff note, and
Git commit are the durable record.

## What We Borrow

| Edict idea | Neon Cleaner implementation |
| --- | --- |
| Triage and planning before execution | Every non-trivial slice starts with a task packet and acceptance criteria. |
| Reviewer veto before dispatch | A Gatekeeper checks scope, dependencies, write set, risk, and proof plan before UE changes begin. |
| Department-style specialization | Use bounded Planner, UE Engineering, Visual QA, Asset/License, and Docs/Release roles only when useful. |
| Legal task state transitions | Use the state machine below; a task cannot jump from an idea to `DONE`. |
| Parallel dispatch | Parallelize independent read-only inspections; use one writer per path for implementation. |
| Audit and replay | Record commands, changed files, proof artifacts, verdicts, blockers, and commit IDs. Do not record private chain-of-thought. |
| Cost and human-approval metadata | Set a worker/time budget and mark external side effects before dispatch. |

## What We Do Not Borrow

- Do not keep twelve agents active for every task. Use zero extra agents for a
  micro-fix, one to two reviewers for a normal slice, and two to four bounded
  specialists for a large or high-risk slice.
- Do not introduce a Redis/Postgres/EventBus/dashboard stack until the local
  task packet and Git evidence have proven insufficient.
- Do not copy API keys, Codex sessions, Epic tokens, or agent private data into
  the repository, Baidu Netdisk, or shared agent workspaces.
- Do not let a role metaphor replace an acceptance test. A task is complete only
  when its evidence and QA verdict are present.
- Do not let automatic retries repeat an external download, upload, purchase,
  or push. Those actions require explicit human approval and an idempotent
  retry plan.

## State Machine

```text
INTAKE -> PLANNED -> REVIEW -> READY -> EXECUTING -> QA -> DONE
              ^         |                  |          |
              |         +-> REWORK         +-> BLOCKED +-> REWORK
              |                                      |
              +--------------------------------------+

Any state may become CANCELLED when the owner records why.
```

State rules:

- `INTAKE`: objective is captured, but scope and proof are not yet approved.
- `PLANNED`: task packet contains scope, out-of-scope items, dependencies,
  acceptance criteria, write set, risks, and verification commands.
- `REVIEW`: Gatekeeper checks the packet before any implementation or external
  side effect.
- `READY`: Gatekeeper returns `PASS`; work may be dispatched.
- `EXECUTING`: bounded workers operate within the declared write set.
- `QA`: automated and visual checks are run against the same acceptance list.
- `DONE`: QA verdict is `PASS` or an explicitly documented `CONDITIONAL PASS`
  allowed by the relevant quality gate; evidence and commit are recorded.
- `REWORK`: the packet is revised rather than silently expanding the task.
- `BLOCKED`: a dependency, toolchain, asset, license, or human decision is
  missing. Stop repeated attempts and record the unblock condition.

`CONDITIONAL PASS` never clears a project rule that says `BLOCKED`, including
the current Gate 3 rider-pose requirement for AI-video continuity.

## Roles And Permissions

### Orchestrator / Producer

The main Agent owns the task packet, final integration, user-facing report,
and commit. It may write only the declared implementation and documentation
paths. It resolves conflicting specialist findings.

### Planner

Read-only by default. Produces a small plan, dependencies, acceptance tests,
rollback path, estimated effort, and a list of possible parallel inspections.

### Gatekeeper / Reviewer

Read-only and independent from the implementer. It may return `PASS`, `REWORK`,
or `BLOCKED`. It must reject vague scope, missing evidence, unsafe write sets,
unreviewed Marketplace/license implications, and plans that bypass a quality
gate.

### Specialist workers

- **UE Engineering:** C++, Blueprint, Python automation, map and runtime
  validation. Writes only its assigned paths.
- **Visual / Gameplay QA:** inspects captures, camera continuity, rider pose,
  input feel, HUD readability, and gameplay clarity. It does not edit the
  implementation while reviewing it.
- **Asset / License / Sync:** checks Epic/Fab restore paths, Git LFS, Baidu
  vault manifests, and cross-PC reproducibility. External transfers still need
  human approval.
- **Docs / Release:** checks handoff, sprint status, changed-file summaries,
  and reproducibility. The Orchestrator owns final edits to shared status docs.

### Final QA

Final QA is the existing QA Director gate. It must use the relevant automated
check plus visual inspection where the result is visual. It signs off only on
the declared slice; it does not expand the scope during acceptance.

## Dispatch Rules For Unreal Engine

Safe to run in parallel when the inputs are fixed and the workers are read-only:

- inspect C++/Python validation coverage;
- review a UE proof frame from different visual criteria;
- check asset/license/sync implications;
- review the task packet and handoff completeness.

Must be serialized behind one writer:

- edits to the same C++ or Python file;
- edits to `NeonCleanerUE.uproject` or project settings;
- edits to the same `.umap`, `.uasset`, Control Rig, IK Rig, or animation asset;
- Unreal Editor operations that save into the same project;
- final changes to `docs/handoff.md`, sprint status, or the active QA report.

Every dispatch must name `allowed_paths` and `read_only: true/false`. If two
workers need the same path, the Orchestrator splits the work into review first,
then one implementation pass.

## Human Approval Boundaries

The Orchestrator must pause at `REVIEW` or `BLOCKED` for:

- Epic/Fab installation or Marketplace asset restoration;
- Baidu Netdisk download, upload, or archive replacement;
- paid services, purchases, or external API calls with cost;
- publishing, emailing, or pushing a milestone when not already authorized;
- any operation whose license or redistribution scope is uncertain.

The repository may contain the procedure and a checksum/manifest, but never
credentials or third-party Marketplace content.

## Evidence Contract

Every task that reaches `QA` records:

1. task ID and current state;
2. files changed and files intentionally untouched;
3. exact validation commands and their results;
4. proof image, video, log, or output path when applicable;
5. QA verdict and the criteria that remain conditional;
6. blocker, rollback, or next action;
7. final Git commit after the slice is coherent.

Keep the record to action summaries and reproducible evidence. Do not store
hidden reasoning, secrets, or raw model transcripts in project files.

## Adaptive Team Size

| Slice size | Required flow |
| --- | --- |
| Micro-fix: one file, clear test, no visual or external risk | Orchestrator/Producer -> self-check -> commit. |
| Normal slice: one feature or one quality fix | Planner -> Gatekeeper -> Producer/one Specialist -> QA Director. |
| Large/high-risk slice: UE + visual + asset/sync concerns | Planner -> Gatekeeper -> parallel read-only specialists -> one Producer writer -> QA Director -> handoff. |

Stop spawning workers when their findings are duplicating each other. Two
independent reviewers with the same evidence are more useful than a permanent
department fan-out.

## Cross-PC Continuity

At the start of a session, run `sync_project_start.ps1` and read this file plus
`docs/agent-task-template.md`. At the end, update the task packet or handoff,
then run `sync_project_finish.ps1` so the next PC can resume from a commit
rather than from a chat window.
