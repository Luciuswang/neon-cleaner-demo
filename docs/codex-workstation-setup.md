# Codex Workstation Setup

Use this guide to make another PC behave like the current Neon Cleaner Codex
workspace.

## What Syncs Through GitHub

These project facts sync through this repository:

- Source code and UE project files.
- Git LFS assets committed to the repo.
- Project rules in `AGENTS.md`.
- Handoff and reporting docs.
- Producer / QA workflow docs.
- Start and finish sync scripts.

Every PC should start Neon Cleaner by running:

```powershell
.\sync_project_start.ps1
```

## What Does Not Automatically Sync

These are local to each computer or Codex app install:

- `C:\Users\<you>\.codex\skills\`
- `C:\Users\<you>\.codex\config.toml`
- Codex sessions / chat history.
- Local automations created on one computer.
- Runtime subagents shown in the Codex sidebar.
- Epic/Fab Marketplace content such as
  `ue/NeonCleanerUE/Content/ParagonPhase/`.

Do not copy these sensitive or machine-specific files between PCs:

- `.codex\auth.json`
- `.codex\logs_*.sqlite`
- `.codex\sessions\`
- `.codex\archived_sessions\`
- `.codex\state_*.sqlite`
- `.codex\memories_*.sqlite`
- `.codex\.sandbox-secrets\`
- `.codex\cache\`

## Skills To Install On Each PC

The current custom skills on this PC are:

- `liveops-art-precheck`
- `neon-video-prompter`
- `qiuzhi-skill-creator`
- `sulphur2-comfyui-video`

System skills and plugin-provided skills are installed by Codex / plugins and
may vary by app version.

Recommended setup:

1. Install or copy only the custom skill folders into:

```text
C:\Users\<you>\.codex\skills\
```

2. Restart Codex.
3. Start this project and check that the skills appear in the session context.

If a skill is project-specific, prefer documenting it in this repo or installing
it from a trusted GitHub source. Avoid syncing the whole `.codex` directory.

## Subagents

The sidebar subagents are not project files. They are runtime helpers available
inside the Codex app/session. Their names and availability can differ between
machines or sessions.

For Neon Cleaner, the portable part is the workflow:

```text
Producer Agent -> QA Director Agent -> Fix Pass -> QA Sign-off -> Next Step
```

That workflow is stored in:

```text
docs/agent-production-workflow.md
```

When continuing on another PC, tell Codex:

```text
开始 Neon Cleaner 项目，按 AGENTS.md、docs/handoff.md 和 docs/agent-production-workflow.md 继续。使用 Producer / QA 双 agent 工作流。
```

If persistent named agents are required across all PCs, create them as Workspace
Agents instead of relying on runtime subagents.

## Automations

Automations can be local to the Codex app installation. For recurring reports,
the safe pattern is:

1. Keep the report rule in `docs/biweekly-reporting.md`.
2. Configure the automation prompt to run `.\sync_project_start.ps1`.
3. Generate reports from GitHub commits and repo-local handoff docs.

This prevents one PC from sending an empty report just because its local Codex
thread did not do the work.

## Minimal New-PC Checklist

1. Install Codex and sign in.
2. Install Git, Git LFS, and Unreal Engine 5.8.
3. Clone the repo and check out `codex/character-continuity-pipeline`.
4. Run `git lfs pull`.
5. Install custom skills listed above.
6. Add `Paragon: Phase` to the UE project from Epic/Fab Library.
7. Run:

```powershell
.\sync_project_start.ps1 -ValidateUE
```

8. Start Codex from the repo and say:

```text
开始 Neon Cleaner 项目
```
