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

Public smoke and remaining limitations are recorded after the ordinary Pages PR.
