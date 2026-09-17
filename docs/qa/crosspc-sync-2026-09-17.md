# Cross-PC synchronization QA — 2026-09-17

## Verified

- Public cinematic checkpoint `12dd722` uploaded to origin;109 Git LFS objects,
  approximately143MB, acknowledged by the server.
- Private vault repository privacy verified through GitHub API. Snapshot
  `d85fce7ece4b428a4cc43cc1c5ccabbd55c4deedf67196f9aa56f576c8763357` contains745
  files/778,348,323 bytes. Remote commit is pinned in the public lock. Local restore
  preflight and all745 file checksums pass; original resources remain unchanged.
-8 isolated reporting tests pass: all remote branches, branch-only worklogs,
  SHA/event/task dedup, conflicting events, no unpublished localHEAD evidence,
  fetch/prune failure behavior and inclusive timezone boundaries.
-15 isolated checkpoint/restore/lease tests pass: default push of clean ahead and
  dirty work, rejected push and failed commit return nonzero, dirty task branch
  stays selected, exclusive leases/scopes, correct metadata filename, safe paths,
  checksum corruption/conflict preflight, copied-byte verification, Windows long
  paths and UNC normalization. No production remote is touched by these tests.
- Python compilation and PowerShell parsing pass. Native Git/UE failures are
  checked explicitly; success also requires remote ancestry / validation markers.

## Defects caught and fixed during validation

Windows long snapshot paths exceeded ordinary CopyFile paths; extended paths now
cover checksum/copy/restore, with exclusive destination creation. Git CRLF checkout
could alter manifest byte hashes; manifests useLF attributes and canonical LF
verification. Windows text-mode subprocess input produced `claims.json\r`; binary
Git stdin plus a pre-push roundtrip now validates the actual tree filename. The
initial registry was repaired with a normal fast-forward preserving its lease.

An existing old Kelly mesh could skip a newer snapshot. Startup now always checks
the full pinned set when a lock is present; differing local assets stop the restore
without overwriting. Full asset verification is distinct from artistic acceptance.

## Fresh-computer simulation

A fresh clone from the actual public origin and a private restore from the
acknowledged vault are in progress. Results will be appended before this task is
marked complete. Do not interpret local-cache verification as a completed remote
download test. No original raw360-frame PNG duplicates are required by the stored
video/log evidence; selected source video and all report-linked artifacts are kept.

## Remaining project limitations

Cinematic QA is still REWORK/AI BLOCKED. Missing original Kelly texture/groom
dependencies were not found by this backup and are still missing. Same-account
GitHub authentication is required for the private vault on each machine; UE5.8.1
and platform build prerequisites must be installed locally. Offline/unpushed work
on a computer cannot be inferred by reporting; it must upload at its next checkpoint.
