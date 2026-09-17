# Cross-PC project continuity

Standing user instruction, 2026-09-17: save and upload every completed checkpoint
automatically; do not ask repeatedly or narrate successful routine synchronization.
All computers contribute to one project history and one complete biweekly report.

## Authoritative stores

| Store | Contents |
| --- | --- |
| [Public project](https://github.com/Luciuswang/neon-cleaner-demo) | Code, scripts, public assets via Git LFS, task packets, worklogs, QA decisions and reports |
| [Private asset vault](https://github.com/Luciuswang/neon-cleaner-private-assets) | Immutable, checksummed private Kelly/bike assets, editable sources, selected evidence and exact checkpoint DLL |
| Epic/Fab account | Marketplace entitlement and restore; do not publish restricted assets into the public repository |

Canonical integration branch: `codex/character-continuity-pipeline`. Concurrent
tasks use separate `work/<task-id>/<workstation>` branches. Git is version control,
not live bidirectional editing of UE maps. Never sync the live project through a
consumer cloud folder. Share completed checkpoints and claim disjoint write paths.

## Start on another computer

Install Git, Git LFS, Python3.10+ and UE5.8.1 with its C++ build prerequisites.
Authenticate Git Credential Manager to the same GitHub account (private vault
access is required). Then:

```powershell
git clone --branch codex/character-continuity-pipeline https://github.com/Luciuswang/neon-cleaner-demo.git
cd neon-cleaner-demo
git lfs pull
.\sync_project_start.ps1 -RestorePrivateAssets
```

The private snapshot is pinned by `docs/sync/private-assets-lock.json`, not a
machine-specific drive letter. Restore verifies every checksum and preflights all
conflicts before copying; differing local files are never silently overwritten.
Private source projects restore under `.local/private-sources/`. Some original
Maya absolute texture references remain missing; consult the resource audit before
recreating work. Private vault access failure is a restore blocker, not a reason
to reconstruct the character again.

Restored DLL/modules are the exact UE5.8.1 checkpoint. They preserve historical
evidence identity, but do not promise compatibility with a different engine patch
or toolchain. Rebuild when necessary, then run current-build validation. Rebuilding
invalidates prior runtime evidence; it does not erase the recorded completed work.

The start script fetches every remote head, preserves current task branches and
dirty work, fast-forwards only clean branches, pulls LFS, and verifies/restores the
entire pinned private set whenever a lock exists. An existing but stale Kelly mesh
cannot silently skip verification. Differing local files stop restore for inspection;
exclusive file creation also prevents overwriting a file created by another session.
Use `-UEPath <engine-root>` or `NEON_UE_ROOT` when UE is installed elsewhere.

## Avoid duplicate and conflicting work

1. Read `AGENTS.md`, latest handoff, relevant `docs/tasks/`, `docs/worklog/` and
   remote branch changes. Keep the same task ID across PCs and retries.
2. Read/acquire the remote lease **before production writes**:

```powershell
python tools/sync/claim_task.py list
python tools/sync/claim_task.py acquire rider-grip-refit --scope ue/NeonCleanerUE/Source/NeonCleanerUE/LinxiaMotorcyclePawn.cpp --scope ue/NeonCleanerUE/Source/NeonCleanerUE/LinxiaMotorcyclePawn.h
```

3. Claims are kept on `coordination/task-claims`, not mixed into game sources.
   A normal fast-forward push atomically publishes the registry update. A racing
   claim loses and must reread; never bypass the rejection with force push.
   Task IDs and parent/child file scopes cannot overlap an active lease. Default
   lease is8hours, maximum24hours. Renew before expiry and immediately before
   resuming a suspended long task. Do not claim a task completed in its worklog.
4. Use separate branches/worktrees for concurrent tasks. Claim the entire content
   directory/map when a UE operation writes broad binary dependencies. Integration
   into the canonical branch is serialized and preserves remote commits.
5. On non-fast-forward push: fetch, inspect and integrate compatible text changes;
   preserve conflicting binaries on a uniquely named recovery branch and record
   REWORK/BLOCKED. No resets, force pushes or "last computer wins" overwrite.

## Finish every checkpoint

Update QA/handoff and append an immutable worklog event. Include task ID, UTC
timestamp, anonymized workstation ID, actual result, commit references, evidence,
known blockers and next action. Agent chat memory is not the handoff record.

```powershell
.\sync_project_finish.ps1 -CommitMessage "Describe the actual checkpoint"
python tools/sync/claim_task.py release rider-grip-refit
```

Finish verifies each Git command, publishes private snapshot first, stages/commits
reviewed work and pushes the current branch by default. It verifies the remote
contains the local commit; Git LFS's pre-push hook uploads binary objects. Failures
stop the script with nonzero exit. A clean but locally-ahead branch is still pushed.

`-StagedOnly` lets the integrator explicitly select files; unclassified leftover
changes stop completion. `-LocalOnly` requires an explicit offline request.
`-SkipPrivateAssets` is for isolated tests or a documented code-only checkpoint
with an already-verified resource lock; it cannot establish full asset portability.
No normal synchronization asks for repeated user approval.

## Private snapshot details

`python tools/sync/private_assets.py publish` snapshots the explicit allowlist,
verifies GitHub repository privacy, hashes/copied bytes, uploads through Git LFS,
then writes the public lock containing the acknowledged vault commit/snapshot.
No credentials are saved. Existing snapshots are immutable; private sources remain
excluded from public Git. Current snapshot includes active/inactive character/bike
content needed by the current evidence fingerprint, original editable Kelly/city
sources and current report-linked video/images/logs/performance CSV. Superseded
captures, caches, raw360-frame PNG duplicates and PDBs are omitted.

If a transfer is interrupted, inspect `.local/private-vault` before resuming;
never discard unknown local changes. New evidence views/private dependency roots
must be added to the allowlist when the production scope changes. A private lock
is not a cinematic acceptance certificate.

## Complete cross-PC biweekly reporting

Follow `docs/biweekly-reporting.md`. Fetch all origin branches, gather worklogs
from each remote tree, deduplicate commitSHA/event/taskID and separately list
unintegrated work, failed QA, blockers and local setup issues. Record cutoff and
frozen remote heads. Offline/unpushed work is unknown, never "no work happened".
Do not infer machine identity for old commits. Report generation does not send
messages or create a schedule; delivery requires its own existing authorization.
