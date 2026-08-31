# Cross-PC Project Sync

Use this page to continue Neon Cleaner from any of the user's three PCs.

## One Source Of Truth

GitHub is the project source of truth:

```text
https://github.com/Luciuswang/neon-cleaner-demo.git
```

Use this branch for current UE / Lin Xia work:

```text
codex/character-continuity-pipeline
```

Codex chat history and local workspaces may differ between PCs. Codex is not a
single shared live workspace just because the same account is signed in. The
project state lives in GitHub and this repo, especially:

```text
AGENTS.md
docs/handoff.md
docs/sprint-2026-08-24.md
docs/agent-production-workflow.md
docs/quality-control.md
docs/multi-agent-production-system.md
docs/agent-task-template.md
docs/tasks/gate3-rider-pose-strict-qa.md
```

## First Setup On A New PC

1. Install Git and Git LFS.
2. Install Unreal Engine 5.8.
3. Clone the repo:

```powershell
mkdir E:\codex_project
cd E:\codex_project
git clone https://github.com/Luciuswang/neon-cleaner-demo.git
cd neon-cleaner-demo
git checkout codex/character-continuity-pipeline
git lfs pull
```

4. Register the UE project with Epic Launcher/Fab (safe to rerun):

```powershell
.\ue\Register-EpicProjectForFab.ps1
```

Then, in Epic/Fab Library, add `Paragon: Phase` to:

```text
ue/NeonCleanerUE/NeonCleanerUE.uproject
```

`Paragon: Phase` is licensed for Unreal Engine project use but its Fab listing
disallows AI usage. Do not upload it to AI image/video generation services.

5. Run:

```powershell
.\sync_project_start.ps1 -ValidateUE
```

## Every Time You Start Work

From the repo root:

```powershell
.\sync_project_start.ps1
```

Then tell Codex:

```text
开始 Neon Cleaner 项目，按 AGENTS.md 和 docs/handoff.md 继续。
```

The start script will:

- confirm the repo and branch
- fetch latest GitHub state
- pull if the working tree is clean
- pull Git LFS objects
- check UE 5.8 and the UE project
- check whether local `ParagonPhase` assets are present
- print the handoff files Codex should read

## Every Time You Finish Work

If Codex changed the project, end with:

```powershell
.\sync_project_finish.ps1 -Note "short handoff note" -CommitMessage "short commit message" -Push
```

The finish script will:

- optionally append a timestamped note to `docs/handoff.md`
- run `git diff --check`
- stage and commit changed files when a commit message is provided
- push the current branch when `-Push` is set
- print the final branch and commit

## Important UE Asset Note

This folder is intentionally ignored and local-only:

```text
ue/NeonCleanerUE/Content/ParagonPhase/
```

It contains Epic/Fab Marketplace assets and must be restored from the user's
Epic/Fab library on each PC instead of being uploaded to the public GitHub repo.

For a private cross-PC backup/transport option, see:

```text
docs/asset-vault-baidu.md
```

Baidu Netdisk may hold private, versioned asset archives, but the live UE
project should not be placed inside a bidirectional sync folder.

## Current Project Shortcut

When the user says any of:

```text
开始 Neon Cleaner
开始 Neon Cleaner 项目
开始霓虹清道夫
开始这个项目
继续这个项目
```

Codex should:

1. find this repo
2. run `.\sync_project_start.ps1`
3. read `AGENTS.md` and the handoff files
4. continue from the latest pushed branch state

## Reports

Recurring progress reports must follow `docs/biweekly-reporting.md`. They should
pull GitHub, read repo-local handoff docs, and summarize commits from the
reporting window instead of relying on one computer's Codex chat history.

## Codex Workstation Environment

To make another PC's Codex environment match this one, follow:

```text
docs/codex-workstation-setup.md
```

Do not copy the whole `.codex` directory between machines because it contains
tokens, logs, local sessions, caches, and machine-specific state.
