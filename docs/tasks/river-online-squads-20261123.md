# Riverfall — online squads (river-online-squads-20261123)

Request: real browser players, private friend invitations, public quick match,
clearly labeled AI replacements. Separate opt-in entry on the existing river
map; no changes to old demo directories. Host-authoritative casual elimination,
four seats a side, one life per round, first to five. Death does not reset on
takeover or leave. No bomb objective, economy, accounts, rank, host migration,
jump or interactive cabin doors in this mode. Earlier solo modes are unchanged.

## Scope and gates

Scoped task lease on the river overlay plus the task/sprint/handoff docs.
Distinct Fable Gateway producer calls for simulation, PeerJS transport, view,
integration, tests and revisions. Planner and independent pre-production gate
approved opt-in isolation, bounded traffic, IP notice, explicit AI, protocol
version, connection failure UX and separate local/public tests. No credentials
or paid host provisioned. PeerJS upstream MIT notice accompanies the bundle.

QA evidence: `experiments/sunbreak-river-v4/qa/squads-qa.json` (protocol,
same-host isolated browser contexts, gameplay and controls), and
`experiments/sunbreak-river-v4/qa/squads-fable-receipts.json` (requested and
returned model, result and Gateway-reported usage/cost; not a separate upstream
billing verification). Web dependencies: pinned private snapshot verified by
content hashes, 12 GLBs/12,862,004 bytes; none included in public overlay.
Unrelated dirty UE vault left intact; no claim of restoring that vault.

## Release result — conditional PASS for an experimental friends beta

PR #15 merged normally as `9443d4d277b866d58c8876fd40b23265c18bea0a`.
Anonymous Pages served the pinned manifest and six matching entry/runtime/notice
files for source `4481321ae367493da3422c8f457d049ca027c830`. The independent
review's remaining authority and Pages gates both ran: legitimate player shots
produced 100→75→50→25→0 HP, no friendly damage, no firing after death, first to
five concluded 5:0. On the published HTTPS page, two independent contexts used
the actual in-game invite UI, loaded both 3D scenes and both eight-seat
scoreboards with zero page errors. A separate transport run on the same public
site matched movement, 2 humans + 6 bots, first-round 1:0 at simulation
sequence 993, then 1 + 7 on disconnect. See `qa/squads-pages.json` in the
river overlay. Eight-seat capacity and deterministic quick matching were tested
on the local signaling service; public quick rooms were not occupied for QA.
Next practical test: friends on different physical devices / restrictive NATs.
