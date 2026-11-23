# Riverfall | material-specific impact art, 2026-11-23

Task `river-impact-art-20261123`. Source branch `codex/character-continuity-pipeline`.
Baseline `4a57007be907a587f8c68b54972ac81e8a9b874b`. Gate: scoped visual/demo,
not UE cinematic acceptance. Current state: local QA complete, publication next.

## Scope and owners

The three player references identified gold stripes on wood, a pale geometric
badge on masonry, and a small needle-like splash on water. One writer integrated
the Gateway Fable planner/gate, procedural shader producers and shadow revision.
Independent Fable QA reviewed coordinator observations, source and metrics, not
the images directly. All six sanitized Gateway receipts (not upstream billing
verification) are in the evidence. The only runtime file changed was
`experiments/sunbreak-river-v4/combat-feedback.js`. Earlier demos, combat logic,
map layout, muzzle and mud behavior were out of scope.

## Result and verification

Wood: short offset split, interrupted dull exposed edge, tapered fibers.
Stone: asymmetric dark pocket with discontinuous chipped mineral edge; no
broad white halo. River and standing water: anchored translucent crown layers,
separate jets/drops and the existing ripples. Analytic sprite effects, not
destructive geometry or a fluid solve. Wood can look quite subtle in deep
shade; standing water can still show the two sides of the crown.

`experiments/sunbreak-river-v4/qa/evidence/impact-art-20261123/` holds the paired
native crops, context frames, camera/event/pixel records, six suite logs and
renderer counters. Identical casts and 1280x800 daylight camera; advance
real world FX at 1/120s, independent of AI/tracer time. Five real accepted
shots resolved as timber, brick, river, standing water, fieldstone. At 0.12s
the paired FX-on/off visible area (max RGB delta >=12) was 199 -> 1153 px on
the river and 218 -> 1246 px on the puddle. At 0.50s wood was 426 -> 27 px,
brick 769 -> 93 and fieldstone 1637 -> 190. No residual at 1.02s in any
sample; no browser errors/failed resources. Separate native `renderer.info`
stress of 250 mixed events: before/after 2 calls, 400 triangles, both 0 after
expiry. No full-game frame-rate or continuous-motion claim.

Gatekeeper: PASS subject to constraints. Scoped QA: **CONDITIONAL PASS** for
player art review. The shader's emitted jet codes have fractional part
0.12–0.24; the branch separates them from crowns at 0.27, in the unused gap
before 0.30, so no generated jet is misclassified. Six scoped suites:
`timber-mud-fx-checks`, `combat-feedback-checks`, `reference-house-checks`,
`village-checks --stdout-only`, `assist-reference-checks`, and
`map-checks --polish --stdout-only`. The separate historical map mode expects
an exact old arena weapon file; it still fails that pre-existing identity
assertion. No thresholds/tests changed.

Unrelated dirty UE private vault preserved. Unchanged web snapshot checked
separately: 12 GLBs / 12,862,004 bytes; no new private dependencies or transfer.

Next: publish only the river demo, verify the anonymous Pages build, then have
the player judge wood visibility and the water silhouette in motion.
