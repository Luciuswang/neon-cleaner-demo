# Riverfall 4v4: diagonal starts and opening movement

- Task/lease: `river-squads-opening-20261124`.
- Source branch: `codex/character-continuity-pipeline`; public baseline: PR 15.
- Scope: online simulation and its QA. Preserve solo, geometry, collision, art, controls, networking, and match rules. One writer per source file.
- Process: Gateway planner → independent design gate → separate simulation and test producers → measured regression checks → independent evidence review. Route: `claude-fable-5-2`.

## Player-visible acceptance

1. All eight seats use walkable positions at diagonally opposite map ends. All sixteen enemy seat pairings should be obstructed by existing scenery at the start, from either direction.
2. AI visibly takes different paths during the opening; quantify actual motion and sustained overlap, not just a wider static spawn formation. Leave human-controlled movement alone.
3. Players can still create/join a room; round rules and solo entry regressions remain intact.

## Baseline

On the shipped host + seven bots, sampled at 10 Hz for the first eight seconds, 166 of 523 live same-team bot pair-samples were closer than 0.8 m. The worst pair stayed that close for 7.8 seconds. Both old team starts used the same end of the river.

## Verification

Runtime rules and movement: `node experiments/sunbreak-river-v4/qa/squads-rules.mjs` and `node experiments/sunbreak-river-v4/qa/squads-opening.mjs`. Native game sight check, local capacity and public room consensus are tested separately. Automated measures do not replace a player's judgment of motion.

## Implementation and measured result

The host now places eight distinct seats across two diagonal clusters; four opening routes per side have distinct first and second destinations. AI-only local steering separates nearby teammates, with a short seat-dependent start offset, bounded speed and small per-round variation. A mid-round human disconnect skips the opening route. No new network fields, map meshes or solo assets.

The first candidate exposed two targets in building footprints. It was discarded. The selected walkable route set passes the same thresholds without relaxing them. In the first-round host + seven AI comparison, 0/720 live same-team pair samples were closer than 0.8 m; even the least-travelled AI ended 8.68 m from its start after eight seconds. Fixed-seed regressions cover three actual rounds each with 0, 1, 2 and 4 humans and check a separate replay. The simulation has no user-selectable seed.

All 16 opposing seat combinations were occluded in both directions: 0/864 modeled-wall rays and 0/512 native game line-of-sight probes. Both teams' mean grid distances to the middle crossing differ by 1.875 m; symmetry is close, not exact. Reported movement applies to the opening, not every situation later in a round. No player study or cross-device WAN test.

QA Director: `CONDITIONAL PASS` for the opening beta, conditional on network and release checks. Detailed measurements and sanitized Gateway receipts in `qa/squads-opening-{qa,fable}.json` within the river experiment. The first full simulation model call exceeded its single-response limit and was discarded; narrower Fable calls produced the integrated code. The pinned 12-model web dependency snapshot was verified separately; the unrelated dirty UE vault was not changed.
