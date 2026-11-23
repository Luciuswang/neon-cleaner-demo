# Riverfall | meadow banks, rock shelves and forested ridges

Task `river-floodplain-art-20261123`, 2026-11-23. Source branch
`codex/character-continuity-pipeline`, baseline `af606c896b3c249d7a748d706c9d54019ce21586`.
State: local final QA passed within scope; Pages publication follows.

Reference analysis prioritized dry straw/olive ground cover with deliberate
breaks, interlocking low rock shelves, lit crowns with openings, and receding
forested ridges around an open valley. The original settlements, crossing
positions, actor play, damage and navigation remain in place. This is a
directional art pass, not a claim of matching a commercial screenshot.

## Production

Gateway `claude-fable-5-2` planner, gatekeeper, disjoint producers, revisions
and independent reviewer. Only sanitized receipts saved; the output-limit
failure was discarded. No credit fallback. Four runtime files: vegetation,
riverbank detail, distant landscape and world integration. No new downloaded
assets, no reference pixels in the game, no changes to previous demos.

* 16 seeded ribbon drifts, 4,779 blades; 3,600 crossed cards use an original
  in-memory grass texture across 1,200 roots. Extra height is below 0.46 m.
  Sparse red flecks; dense olive near water, straw further out. Existing real
  trees retain wind and receive an additional upper/lower crown lighting grade.
* Eight groups of low eroded slabs, 63 pieces including toe debris, outside
  the combat area. Separate from original instanced riverbed pebbles.
* Five asymmetric, procedurally modeled pinnate palms at the two outlets.
  Forested ridges retain every original terrain vertex and face and append
  clustered canopy geometry. Existing `look=previous` retains bare mountains.

## QA

`experiments/sunbreak-river-v4/qa/evidence/floodplain-20261123/`: six matched
1280x800 native WebGL views, drawable counters, geometry proof, ten-suite
summary, and independent Gateway verdict. `paired.jpg` is resized only. No
page errors or failed resources, 15 LOS probes identical (both blocked and
clear), identical gameplay map metadata. The legacy ridge still has 79,360
triangles; forested mode has 99,160 at the same 12 beauty draws. Added art
uses five base draws, 18 submissions in the measured full multipass frame.
Three native warm synchronous fixed-camera samples stayed within the slice's
+3 ms median and +6 ms p95 thresholds; not a play-session or device FPS claim.
QA: PASS for directional environment art only; independent reviewer assessed
coordinator evidence, not the images firsthand. Still more open than the
reference; grass clump transitions, distant tree variety, canopy shadowing and
rapid-motion alpha stability are not fully matched or certified.

Unrelated dirty UE vault left alone; the pinned web snapshot was verified:
12 GLBs / 12,862,004 bytes; none in the public overlay. Next: publish and
check anonymous build bytes; player reviews the two outlets and meadow in motion.
