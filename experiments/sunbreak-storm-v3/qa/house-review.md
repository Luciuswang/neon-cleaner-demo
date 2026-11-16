# Timber-house checkpoint — 2026-11-16

Verdict: **CONDITIONAL PASS for this bounded architectural slice**.
Current evidence is in `house-release-report.json` / `house-evidence/`.
Pre-house `release-report.json` and its failures remain historical, not replaced.

## What was changed

Only former MERCADO12 becomes a reference-led timber cabin with actual room,
ceiling, furniture, two warm interior lamps, two porch lamps and a hinged door.
The target's old movement proxy is removed and its bullet/LOS root is replaced
by the visible architecture. Other17 movement bounds and six spawns remain.
Its local cover, LOS and traversal intentionally change; never claim otherwise.

Actual player floor support, gravity, ground-state and upward headroom are
tested through the same vertical solver used by play. Door authorization reads
current game state at input time, recomputes proximity/LOS, checks UI/repeat
and guards the swept player volume. Door/body bounds stop the moving leaf
before intersection. Ground-height original enemies cannot climb the new stair.

## Current integrator checks

- 28 deterministic house fixtures;47 actual-browser synthetic house fixtures.
- 38 synthetic weather fixtures;12 weather-audio lifecycle unit fixtures.
- Exact whole combat module after explicit target-local/render/audio exceptions,
  with mutation self-tests; v1/v2 pinned hashes unchanged.
- Initialization global RNG0 added; first rendered frame8 calls = baseline8.
- Five actual1920x1080 WebGL canvas images, source-hash bound and inspected.
- Exact-byte static runtime build, including separate v1/v2 comparison routes.
- Current1080p scripted combat/audio sample:30.014s,1706 raw frames,
  P95=18.2ms, P99=18.3ms, max=18.8ms, zero frames>50ms.
  Recorded-gun context running,221 player and73 enemy shots, zero audio errors;
  synthetic thunder exercised once. Unchanged thresholds pass for this sample.

These fixtures are not a full human playthrough. The original full18-proxy
runtime suite is not claimed for the intentionally changed world. The earlier
background-throttled performance/smoke failures are not deleted or relabeled;
the new measurement is a different current-source, bounded sample.

## Independent limited review

Planck read the allowed seven source files and independently viewed all five
actual frames against the reference. CONDITIONAL PASS, no new P0/P1 found.
The reference's log courses, lap corners, sheet roof, pale trim, porch and stair
language read clearly; pale foundation partly occluded. Interior and opening
are legible. Grain repetition/direction, pale highlights and blocky furniture
remain minor polish items. Full photorealism/UE5 parity is not accepted.

The reviewer separately probed off-stair ground-state/jumps at1/60 and.05,
including120-step outdoor-baseline equivalence. They did not independently run
the latest47 browser fixtures or inspect the later performance result; do not
attribute integrator checks to independent review.

## Scope / continuity

This is Three/WebGL, not Unreal/Lumen/Nanite/hardware ray tracing. Other houses
remain decorative parallax rooms. Gun audio remains CC0 AR15/M4, not MP5.
The user's photo/watermark is not in the deliverable. Unseen cabin parts are
authored interpretation. No new paid/private UE assets or account data.

Public browser code/assets only; dirty ignored private vault remains preserved.
No new private snapshot or UE portability claim. Prior Sites provider invariant
prevented hosted deployment; GitHub save is not a public playable-site claim.
