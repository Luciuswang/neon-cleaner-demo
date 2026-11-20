# Task Packet: river-stone-cover-reference-2026-11-20

- State: bounded cover replacement DONE; scoped source/art/functional PASS; strict release BLOCKED
- Owner: root Planner / single Producer
- Created: 2026-11-20
- Branch: codex/character-continuity-pipeline
- Baseline: f53de8504c71aa550f5af8b6431df180eef53c7e
- Worker budget: one independent read-only Gatekeeper / QA
- Human approval required: no; user requests reference-led stone cover replacement

## Objective / scope

Replace the tile-like river cover appearance with irregular weathered fieldstone
matching the supplied first screenshot: varied stone sizes, chipped edges,
mineral colour variation, dark recessed joints and damp weathering. All six
existing cover visuals, including outer covers, use the same coherent finish.
Preserve authoritative layout/movement boxes, dimensions, doors/NPCs/guns and
earlier demos. Shot/LOS surfaces now follow the actual local reference mesh;
weapon cadence/damage remain unchanged. No new downloads or paid generation.

## Dependencies / risks

Startup fetched all origin branches; baseline is current. Pre-existing dirty UE
private vault blocks canonical whole-project restoration. Preserve it. Browser
dependencies unchanged from verified snapshot
cc1f9345cfb74e06e3b26f4ba9446bd7b5cf2407. Reference wall is local-only scanned
dressing; do not redistribute its unverified private mesh/textures. Reuse it
locally, with original procedural geometry/materials as the distributable fallback.

The procedural fallback retains its12mm inward cosmetic shell,3cm tested oblique
hit separation and zero outward protrusion. The reviewed local mesh pivot uses
the same real triangles for rendering and shots; it retains the3cm hit alignment
gate and the original movement envelope, instead of waiving collision accuracy.
Current strict frame-pacing and continuous-motion release blockers are inherited.

## Acceptance / verification

- Independent Gatekeeper approves before production; independent sampled art QA.
- No flat uniform polygon-tile read at near and gameplay distance in sunlight.
- Original stone-cover CPU suite remains unchanged and passes for the fallback:
  exact collider
  fingerprint, unrelated geometry, closed shell, 12mm recess, <=3cm tested first
  hit offset, projected impact marks, <=40k added triangles and <=3 beauty draws.
- Native headless actual WebGL canvas captures at 1920x1080: front, oblique end,
  opposite bank, wide river, storm. No desktop screenshot/focus/input.
- Source-bound evidence and functional combat/traversal/weather checks. Run one
  unchanged strict sunny benchmark and retain its result; no retry-for-PASS.
- Separate scoped art verdict from full AAA/UE release and continuous motion.
- Immutable worklog, actual task status, Git/LFS checkpoint with documented
  SkipPrivateAssets for unchanged browser dependencies. No Pages deployment.

## Write set

Root only: stone-cover.js; fieldstone-surface.js; scan-cover.js; world.js;
village.js; downloaded-dressing.js; tools/package.mjs; qa/scan-cover-checks.mjs;
qa/fieldstone-package-2026-11-20.json;
qa/fieldstone-reference.mjs; qa/fieldstone-review-2026-11-20.json; new unique
qa/evidence output; demo .gitattributes; this packet; sprint/handoff/worklog.
Read-only: all original QA suites/evidence, all other runtime and earlier demos,
private assets/vault and supplied screenshots. Reviewer has no writes/GPU jobs.
The packaging amendment is local build/import-closure validation only, never
an authorization to deploy a public page or upload private model binaries.

## Review decision

Gatekeeper Ramanujan: PASS TO IMPLEMENT. Keep exactly two beauty batches (the
unchanged regression's actual draw delta); preserve correct narrow-cell winding,
per-stone response, projected hits and shader/fog composition. The 12mm shell
cannot reproduce the reference's deep scanned silhouette exactly; record that
limitation rather than widening collision/acceptance tolerances.

## Result / next action

### Reviewed local reference pivot

The bounded procedural v6 is retained as the public/missing-pack fallback, not
claimed as an exact deep-rock reference match. Root self-review found it still
too veneer-like. The actual reference assets mossy-wall-a/b are already in the
unchanged verified private pack. Gatekeeper Ramanujan approved direct local reuse
with exact rendered-geometry shot/LOS raycasts and atomic reversible activation.
Movement boxes and layout stay unchanged; shot/LOS geometry intentionally changes
to match visible rock edges and holes. The <=3cm actual hit/visible-surface gate
is NOT relaxed. The12mm cosmetic ceiling remains on procedural fallback only;
it no longer needs to constrain the real mesh because rays use that same mesh.

Expanded single-writer claim verified for scan-cover.js, downloaded-dressing.js,
village.js, world.js and qa/scan-cover-checks.mjs. The old protected-source list
is narrowed ONLY for those explicit integration writes; historical CPU suites
remain unmodified. No model/image binaries are uploaded publicly. Browser pack
bytes and pinned snapshot remain unchanged. Independent actual-GLB ray tests,
same-build native captures and runtime hit/LOS smoke are mandatory for this pivot.

Implementation uses a deterministic 3D volume of rubble cells sliced onto the
five exposed cover faces. Shared stone IDs and colour/UV/roughness parameters
continue around corners. All six covers remain inside their exact original
collision boxes with a continuous opaque shell and cosmetic hit projection.
Original mineral albedo/normal/ORM are baked once at512square, no image download
or private scan redistribution. Main normal relief is shading, not displacement.

Pre-change six-view native capture:
`qa/evidence/fieldstone-visual-2026-11-20T08-29-28-569Z-vVOzy6`.
First candidate (v4) engineering PASS but root/independent sampled art REWORK:
`qa/evidence/fieldstone-visual-2026-11-20T08-34-37-581Z-5c7V9m`.
Regular rounded courses, wide mortar, pale stones and artificial closed crack
contours were rejected. Second (v5) capture removes these but still has separate
per-face patterns:
`qa/evidence/fieldstone-visual-2026-11-20T08-38-20-654Z-yzskwB`.
v6 uses shared volume cells, narrows the straight mortar rim16mm->2mm and
retains the existing12mm relief ceiling. Initial v6 CPU failure is retained in
`qa/evidence/fieldstone-units-2026-11-20T08-41-42-437Z-UrzDlu`:
tangential cell slices collapsed bevel triangles. Tiny slivers now remain
opaque mortar; no tolerance or historical test was changed. Unchanged original
stone suite rerun passed559426checks, six covers/two draws/28206triangles,
7956normal rays,23868oblique rays and7956projected marks. Final archived suite,
native visual, functional/performance and independent verdict pending.

## Final checkpoint result

The procedural veneer was not promoted as reference parity. Local default now
directly reuses the user's two already-pinned reference wall meshes: four river
covers use mossy-wall-a, two outer covers use mossy-wall-b. Opposing covers use
equivalent geometry with paired180degree orientation, the original size and
position. Two beauty draws,26942triangles. No asset bytes changed/downloaded.
Original broad movement AABBs remain; shot/LOS rays now hit exact rendered scan
triangles. Missing/off/private-unavailable falls back atomically to procedural v6.

Independent review identified a P2 render-instance identity issue in the first
scan adapter. Corrected by sharing unbaked render geometry and exact instance
transform; intersections return the actual render object/instanceId/coverWallId.
Final actual-GLB checks:6732rays,5983hits,749misses,maximum gap0.00000217m,
zero normal difference, correct object/instance identity and fallback restoration.
All7finalCPU suites plus procedural bake/cross-face checks PASS. Original
fallback suite remains unmodified and passes559426checks.

Final frozen runtime SHA256:
`2870796d5ca710e3c63abd3d253e5701e4121ce3ae798171bfba0011dd02a77d`.
Final six-view native1080p capture/source/history PASS:
`qa/evidence/fieldstone-visual-2026-11-20T09-06-23-009Z-JSsiyS`.
Independent Ramanujan inspected all6actual current PNGs, verified source/state/
pixel bindings and returned scoped art PASS/source PASS. Minor limits: shadow
detail compression and chunky outer-cover proportions. Stills do not prove motion.

Final5functional phases PASS:combat32,traversal54,weather4,polish/actual impacts14,
imported-fallback2. Native actual-game LOS12/12PASS, independently seeded from
actual GLB body-hit/silhouette-miss rays on all6covers. Final units, LOS and
regressions have unchanged source/history checks. Strict sunny10s warmup/30.004s
sample FAIL at native1920x1080 RTX5070: p95=35.9ms,p99=36.6ms,max88.7ms,
10frames>50ms. No retry-for-PASS or threshold changes. FullAAA/motion/performance
release remains BLOCKED; no causal performance-regression claim is inferred.

Local public-package build PASS:102files/123856559bytes,66relative imports and
103shared dependency identities checked; all12privateGLBs excluded. Fixed both
new mandatory modules and inherited missing procedural/after-rain module entries,
including the MIT notice. This is NOT a Pages deployment or public runtime boot
claim. The same scanned-wall appearance remains local-only until licensing is
verified. Private-vault dirty state is untouched; normal Git/LFS checkpoint uses
SkipPrivateAssets only because pinned browser dependencies are unchanged.

Canonical evidence/independent findings:
`experiments/sunbreak-river-v4/qa/fieldstone-review-2026-11-20.json`.
Next: profile inherited frame pacing separately; verify scan redistribution
permission before publishing this same appearance. Upload verification is the
finish script's responsibility, not implied by this pre-commit note.
