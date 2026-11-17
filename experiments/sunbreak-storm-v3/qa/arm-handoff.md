# SUNBREAK left-arm repair — frozen specialist handoff

Task: `sunbreak-house-roundtrip-arms-2026-11-17`, 2026-11-17.
Production ownership released to main. No further specialist production writes.

## Scope / production hashes

Only production changes: `weapon.js`, `weapon-provenance.json`.
All other specialist outputs are new `qa/arm-*` fixtures, scripts, reports and PNGs.
No source asset, parent gun transform, camera, world/index/server, shared document,
Git, publication, browser UI or other worker's file was changed.

- `weapon.js`: `f85489fad56913d74b90e541d6bbaea98e38c15621f761b34de328506dc44cbe`
- `weapon-provenance.json`: `96f686dabe1ec3754c0e1454c5f252af91017c134b2668eb9433a339205ab55c`
- Original weapon preserved exactly as `qa/arm-before-weapon.js`:
  `aecd0d2574a15725c026d17720d1ff68896aab1cdab91d92b3ff77ae8e358b93`.
- Original MP5 GLB still:
  `90f223cbd44a75463a09b5cefaa594cbc8a61276ce31ba0b0734c8735701e1da`.
  Both original texture hashes also match provenance.

## Physical correction

Removed the rearOffset vertex translation. The native held pose alone exposed
the source's open shoulder, so simply deleting the deformation was insufficient.
The left arm is turned 25 degrees about the measured wrist; its upper arm turns
15 degrees about the measured elbow. Axes come from actual joint positions,
not assumed bone Euler axes. Source hand/finger bone transforms remain held.
Pure hand/digit vertices and fingertip-influenced vertices retain original contact.
Mixed wrist skin retains its authored blend, avoiding a hard-pin seam.

A short garment closure completes the existing 24-edge shoulder opening to the
actual source shoulder joint: 25 new vertices / 72 triangles, length 0.145935
source units, end cross-section tapered to 0.86. No arm widening, stretched
forearm, replacement asset, or unreported source-file modification.
This is explicitly new procedural shoulder fabric, not claimed to be original
source topology. Source material/attribution retained.

## Exact verification commands / results

Run from `E:/codex_project/neon-cleaner-demo`:

```powershell
node --check experiments/sunbreak-storm-v3/weapon.js
node --check experiments/sunbreak-storm-v3/qa/arm-render.mjs
node --check experiments/sunbreak-storm-v3/qa/arm-verify.mjs
node experiments/sunbreak-storm-v3/qa/arm-render.mjs after
node experiments/sunbreak-storm-v3/qa/arm-verify.mjs
```

All exited 0 after report reconciliation. Syntax checks passed. Render report:
LEFT ARM engineering PASS, 15 engineering checks,
9 renderer-canvas samples, 1,815 numerical state evaluations over 16:9, wide
1760x775 and 4:3 framing. Verification report: PASS, 55 assertions.
No WebGL, runtime exception or console errors.

Primary report: `qa/arm-after-report.json`.
Hash-bound assertions: `qa/arm-verification.json`.
Original comparison: `qa/arm-before-report.json`.
Untouched-pose diagnostic: `qa/arm-native-report.json`.
Rejected hard-pin trial retained as `qa/arm-rejected-hard-pin-*`; it stretched
the mixed cuff seam and is explicitly REWORK, not approved evidence.
`qa/arm-joint-*` is exploratory/rejected diagnostic evidence, not final output.

Measured final results:

- 9,130 pure hand/digit vertices and tested fingertip vertices:
  maximum position difference 2.99049e-8 source units (Float32 bake precision).
- Original UV0 / UV1 maximum differences 2.97991e-8 / 2.98010e-8.
- Original segment lengths 0.415646 / 0.280160 source units preserved;
  maximum length error 2.19617e-8.
- 39,066 rigid-region edge observations: maximum relative length difference
  3.30872e-5 (0.00331%, including Float32 rounding).
- All original edges: ratio range 0.536643–1.417610, confined to articulated
  skin transitions rather than the former rear translation (before max 5.77515).
  This is not a claim of zero skin/cloth strain.
- Mixed hand/cuff skin maximum displacement 0.050709 source units. These are
  not the locked grip/fingertip vertices; the distinction is explicit in JSON.
- Left shoulder open edges 0; nonmanifold edges 0; invalid normals 0.
  New faces have nonzero geometry and UV area.
- Authoritative muzzle maximum error 8.88612e-16; uniform fit still 1.70.
  Parent transforms and input state unchanged by weapon.update.
- Same sampled draw-call count as baseline, 72 extra triangles. Software
  rendering is not an integrated hardware performance result.

## QA report reconciliation / actual topology

Final report schema is `sunbreak-arm-native-canvas-v2`. The earlier
`sweep.maxLeftVisibleBoundary: 7` and eight capped `sweep.failures` entries
projected the ORIGINAL source opening ring. They neither inspected repaired
edge adjacency nor tested pixel visibility/occlusion. That left ring is now a
sewn internal seam. The unchanged observations are retained as
`sweep.sourceRingDiagnostic.maxOriginalLeftRingVerticesInFrustum: 7` and
`examplesInFrustum` (eight examples). Sample diagnostics use the same explicit
source-ring terminology. Historical v1 before/native/rejected reports remain
historical diagnostics; they are not final repaired-surface verdicts.

New actual-surface inspection uses displayed positions and source skin weights,
not the old x-coordinate side cutoff:

- All 24 original left ring edges have exactly two adjacent faces: one original
  and one closure face, with opposite directed winding.
- All 120 closure edges have valid two-face adjacency and winding.
- Left component: 3,751 welded vertices / 11,247 edges / 7,498 faces,
  Euler characteristic 2, zero boundary edges.
- Zero nonmanifold edges or vertex links, inconsistent-winding edges,
  degenerate welded faces, duplicate faces or unexpected boundaries.
  Weld tolerance is 1e-5 source units; actual maximum merged-position spread
  is 0, so this tolerance is not hiding a small closure crack.
- `sweep.actualSurface`: zero open left edges and zero actual left-boundary
  vertices in the frustum. `sweep.failures: []` now means no real topology or
  actual-left-opening failures, not absence of diagnostic source-ring points.
- Read-only negative controls virtually remove or reverse one added face.
  They respectively produce three open left edges or three winding defects,
  and both fail the unchanged zero-defect criteria. No production geometry was
  mutated or rendered for these virtual incidence tests.

Important retained source limitation: the RIGHT shoulder still has its original
24 open edges, with source positions unchanged. Up to four of its boundary
vertices enter the tested frustum; exposure/occlusion is not established by
that measurement. This is disclosed in `sweep.unchangedRightOpening`, not
misrepresented as a globally closed/watertight arm mesh or hole-free art pass.
Independent art review should retain this visibility limitation.

Only `qa/arm-*` scripts/reports/notes and regenerated samples changed during this
reconciliation. Both frozen production hashes above were rechecked exactly.
All specialist file ownership is released to main; no further writes planned.

## Samples / bounded writer art screen

Actual native WebGL canvas images, not desktop/window screenshots:

| State | Before | After |
| --- | --- | --- |
| Idle | `qa/arm-before-idle.png` | `qa/arm-after-idle.png` |
| ADS | `qa/arm-before-ads.png` | `qa/arm-after-ads.png` |
| Fire | `qa/arm-before-fire.png` | `qa/arm-after-fire.png` |
| Reload midpoint | `qa/arm-before-reload-mid.png` | `qa/arm-after-reload-mid.png` |

Additional PNGs cover ADS-fire, early/late reload, wide and narrow idle.
All nine final samples are hash-bound in the report.

Liveops art-precheck influenced the correction: prioritize the long-arm
silhouette/anatomical read before surface polish; reject the visible native
shoulder opening and the hard-pin wrist seam. Bounded writer verdict: pass,
medium confidence, for the repaired silhouette in the inspected stills.
Sameness: no redesign requested, source identity retained. Structure: shortened
screen-space forearm, held grip retained, no bone-length scaling. Stylization:
no new cartoon/proportion treatment. Impact: weapon remains focal, less cloth
occlusion. Detail priority: original cloth faceting/atlas finish remains a minor
limitation; no claim of premium reauthored cloth. Independent art QA is pending
main, not supplied by this writer screen.

## Integration / limitations

No hook or parent/camera change needed. Keep current FOV52 gcam and overlay
gscene, gun parent formulas and world weapon.update call. Existing weapon.info()
now exposes sleeve axes/angles, source/posed bounds and joint lengths, garment
counts, contact precision, and muzzleFitError for main's captures.

Main reports actual native-game checks23 / house47 / tactical24 PASS with the
frozen production weapon. This specialist did not rerun or independently certify
those integrated checks. Zeno's independent sample review remains external to
this report. Main still owns final actual-game idle/ADS/fire/reload acceptance,
continuous 1080p pacing, independent verdict and publication. These stills are isolated
asset samples, NOT continuous visual review, gameplay validation, hardware
benchmark, motion capture or a full hand-driven reload. Magazine/charging-handle
cosmetics and baseline root reload/recoil are intentionally unchanged.
