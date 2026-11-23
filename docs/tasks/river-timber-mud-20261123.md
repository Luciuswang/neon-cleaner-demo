# Riverfall / timber, mud tracks and surface impacts

- Task: `river-timber-mud-20261123`; branch: `codex/character-continuity-pipeline`
- Scope: the fourth, browser-based river demo only. One integrator, disjoint Fable producer slices and independent Fable gate/review.
- Review: **CONDITIONAL PASS**, scoped demo. A sampled camera pass is not continuous-motion or strict performance certification.
- Baseline: `b6d8f821068cfce8594243ebaed7af1f1cae8ac8`.

## Result

Two intact huts now have less contrasting weathered timber and revised corner
terminations; the old look remains available. The 211 collision meshes (world
matrices and geometry), 14 village draws and 92,894 triangles match baseline.
The terrain shader draws variable-depth, alternating boot impressions, partial
strikes, and limited water in deep wet prints. These are authored trails, not
dynamically accumulated player footsteps.

The accepted-shot VFX use a short muzzle flash and distinct river/puddle,
earth, timber and masonry feedback. The bounded impact pool holds the surface
traces for 1 second of simulation time with a late fade. Broad puddle interiors
use a shared CPU/GPU basin field. Marginal wet areas still respond as mud.
Controls, hit resolution, damage, AI, map layout and older demos were not edited.

## QA and next action

`experiments/sunbreak-river-v4/qa/evidence/timber-mud-20261123/` holds native
WebGL captures, SHA-256 bindings, before/after collision signatures, exact
test outputs and Gateway model/usage receipts. No private binaries were added.
All six suites passed, including 10 new impact/lifetime checks and 21 house
checks. Actual accepted shots were captured on river water, standing water,
mud, wood and masonry. The final ripple contrast revision was retested and
recaptured after the independent review. No browser error or failed request in
that local public-equivalent run. Remaining limitations include dark backlit
walls and no continuous all-camera shimmer, per-footprint reflection, AAA or
frame-time certification.

Unrelated dirty UE vault preserved. Independently checked the unchanged web
snapshot: 12 GLBs / 12,862,004 bytes; no new private dependency. Do not claim
a new UE/private transfer. Next: verify the public Riverfall release.
