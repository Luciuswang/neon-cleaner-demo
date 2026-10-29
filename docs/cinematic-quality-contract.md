# Neon Cleaner cinematic production contract — updated 2026-10-29

This supersedes prototype concessions in older sprint, agent and QA documents.
Target: a convincing, playable UE5 elevated-highway chase whose actual rendered
frames become the identity, environment and camera authority for AI video.
The current build is not accepted as cinematic quality.

## Producer requirements

- Select the best suitable production assets within measured runtime budgets.
  Download/restore permitted resources autonomously under the user's 2026-09-16
  authorization. Document license, source URL, SHA256, units, import settings,
  material maps, LODs, collision, rig/animation and repeatable restoration.
- Hero Kelly identity must remain consistent. A different high-resolution person
  does not solve Kelly fidelity. Use detailed source/bakes and appropriate skin,
  eyes, hair and clothing materials. More polygons alone do not establish quality.
- Foreground vehicles must have modeled body panels, wheel arches, glazing,
  wheels/interior, correct dimensions and separate moving components. Engine cubes
  or stretched car silhouettes are blockers for final frames.
- Build an elevated expressway with believable deck thickness, beams, piers,
  barriers, joints, drainage, markings and traffic scale. Ground and harbor must
  be visibly below the deck. A distant bridge or an overhead crossing is insufficient.
- Use actual PBR color/normal/roughness/metal maps with correct color spaces and
  physical tiling; resolve UV stretch, texture blur, shading seams and faceting.
  Do not conceal inadequate geometry using darkness, fog, bloom or motion blur.
- Riding uses a supported seated base with measured real-bike grips and pegs,
  palm offsets/orientation and finger closure; stable pelvis and elbow/knee poles.
  Steering must show weight shift, progressive lean, damping and return, brake
  response and wheel/fork movement. Static pose or only rotating the whole rider
  is not finished animation. A wrist-to-target distance is only diagnostic data.
- Keep engineering smoke, visual art, temporal quality and video handoff separate.
  A producer cannot self-promote its work to cinematic PASS.

## Independent QA veto

QA uses the actual current build, views evidence at full resolution and describes
visible defects with artifact/frame reference and severity. Missing evidence is
UNVERIFIED/BLOCKED, never inferred PASS. Final output requires all seven domains:

| Domain | Required acceptance evidence |
| --- | --- |
| engineering | Current UE build, map/asset validation, Clean/Damaged/Lost gameplay smoke and input/collision proof |
| environment | Gameplay plus wide and bridge-side frame: deck, piers, lower roads/water, distant city; no flat ground-road read |
| assets | Kelly identity closeups, vehicle detail views, full PBR at neutral light and intended light; source/license/import manifests; no visible placeholder shapes |
| rider | Front/side/rear plus left/right palm and foot/seat contact closeups; no fingers dangling through bars, floating palms, stretched bones or knee inversion |
| vehicles | Measured length/width/height, wheel radius/ground clearance, consistent collision and animated rolling/steering; hero three-quarter and side views |
| temporal | At least 10s continuous neutral/left/right/return/brake footage at >=24fps; no pops/sliding/contact breaks/flicker/ghost trails. Separately profile >=30s gameplay at 1920x1080 or higher, report hardware/settings, p50/p95 frame ms, target p95<=33.3ms; fixed-timestep capture is not a benchmark |
| ai_handoff | Accepted HUD-free UE reference pack >=1920x1080, scene/character/asset identity, lens/FOV, camera transforms, exposure/white balance, motion direction, timing and first/last frame. Generated AI must preserve these after UE passes |

AI readiness requires approved UE references in all applicable domains. A future
AI output also needs its own continuity review; UE acceptance does not accept
unseen AI footage. CONDITIONAL PASS permits further implementation only.

## Evidence integrity

Use `tools/qa/verify_cinematic_evidence.py <report.json>` (schema 2). Every visual artifact
has its SHA256, view/type, and a reviewer decision. Bind the report to the canonical
runtime DLL/map plus the Content/Config/Source dependency fingerprint. PNGs must
decode at target resolution; videos must decode and match hashed UE frame timing
logs. Performance percentiles are derived from the raw real-time CSV. Each domain
must reference its own required evidence views, not arbitrary shared artifact IDs.
Every domain has concrete review notes and artifact IDs.
Record producer/reviewer separately; this is an audit trail, not a cryptographic
reviewer identity signature. Rebuilds/map edits invalidate that evidence pack.

Reports must explicitly set `build.dependency_hash_format`. The portable format
`neon-deps-v2-lf-source-config` hashes actual working files and normalizes only
CRLF to LF for recognized Source/Config text and the exact project descriptor.
Content, binaries and evidence remain byte-exact. Paths and per-file modes are
included in the versioned hash. Missing/unknown/mixed formats fail closed.
Historical `neon-deps-v1-raw` remains explicitly reproducible. A format migration
must retain the original fingerprint, review timestamp and verdicts, record the
reason/date and compare raw/normalized files plus unchanged binaries/artifacts;
it does not constitute a new review or promote artistic acceptance.

The tool fails closed when evidence is absent, changed, below target resolution,
unreviewed, skipped, or any domain is not PASS. Image existence, HUD colors,
bright pixels, a caller-supplied PASS or `contacts=PASS` cannot clear this contract.

## Current decision

CINEMATIC: REWORK. AI VIDEO: BLOCKED pending accepted UE reference pack.
Historic engineering PASS and prototype CONDITIONAL PASS do not override this.

## Locked-screen capture and stricter review — effective 2026-10-29

New reviews use schema 2 with `quality_profile: offscreen-cinematic-v1`.
Desktop screenshots, window grabs, screen recording and synthetic AI footage
cannot serve as UE evidence. Use the actual scene's SceneCapture2D render target,
with a fixed camera, recorded capture ID, engine log and decoded output. The user
may lock the desktop; production and verification must not require unlocking it.
Render-target post-processing, exposure and Lumen behavior must be checked in the
export itself; offscreen provenance does not establish visual equivalence or art
quality. Do not substitute UI pixels if the offscreen path fails.

The existing dated September reports retain historical interpretation, including
their REWORK/BLOCKED conclusions. The verifier recognizes `historical-v1` only
for review dates before 2026-10-29 (an omitted profile is supported for these
existing reports). New reviews cannot omit the profile or select the historical
one. Changing dates to bypass the gate is invalid review practice.

| Criterion | New acceptance requirement |
| --- | --- |
| Hand anatomy/contact | Inspect both palms, thumbs and all visible finger chains at full-resolution neutral and steering extremes. Zero visible finger crossing, inverted bends, floating palm, wrist kink or grip penetration. Measure skin-to-grip separation/penetration where possible; bone endpoint errors alone cannot clear this row. Record any unmeasurable contact as UNVERIFIED. |
| Mechanical motion | A continuous >=10s, >=24fps sequence must include neutral, left, right, return and brake. Visible wheel and fork geometry must move independently; confirm rolling direction, speed/radius relationship and steering direction from the actual mesh. Hidden proxy components or changing transforms of an invisible component do not count. |
| Environment | Wide, side and gameplay views must reveal deck thickness, piers and lower city. Zero visible placeholder foreground buildings; facades need readable structure, scale variation, windows with depth and plausible materials. Repeated blocks, added trim alone, black crush, bloom or fog concealment do not establish cinematic quality. |
| Materials | Neutral and intended-light diagnostics for Kelly skin/eyes/hair/clothing, motorcycle and enemy car. Zero missing maps, default checker materials, obvious UV stretch or accidental mirror/plastic response. Inspect at actual framing and full resolution; metadata and polycount are insufficient. |
| Temporal | Independent reviewer watches the full continuous sequence; still samples alone cannot clear continuity. Zero observed contact break, joint pop, wheel freeze, ghost trail, lighting flicker or disocclusion failure. Record timestamps and severity for each defect. |
| Real-time performance | Separate >=30s actual gameplay CSV at >=1920x1080; p95 and p99 <=33.3ms, max <=50ms, zero frames >50ms. Report p50/p95/p99/max and count >50ms, derived from every retained frame. Warm-up exclusions must be contiguous, declared before measurement and preserved in the original CSV; do not trim hitches. Fixed-step video FPS never substitutes for this run. |

For every new image/video evidence item, record `capture_method` as
`ue-scene-capture-render-target`, `capture_id`, and `capture_log` containing its
repository-relative `path` and exact `sha256`. The log must sit beside the output
and contain the runtime marker (ID and dimensions must match the artifact):

```text
[NeonOffscreenCapture] id=polish-2026-10-29-side method=SceneCapture2D width=1920 height=1080
[NeonOffscreenFrame] frame=0 t=0.000000
...
[NeonOffscreenCapture] Completed frames=360
```

Motion evidence uses that same log as `ue_frame_log`, requires uninterrupted
zero-based indices, correct simulation intervals and exact completed-frame count,
plus `full_continuous_review: true` only after the independent full review.
The existing `actions_reviewed` list remains mandatory. Fixed simulation time is
valid for motion comparison but must be described as such.

Performance evidence supplies a hashed `runtime_log` and the runtime must report
the effective real-time settings, for example:

```text
[NeonPerformance] realtime=1 fixedTimestep=0 width=1920 height=1080
```

Its report `performance` object must include `duration_seconds`, `p50_frame_ms`,
`p95_frame_ms`, `p99_frame_ms`, `max_frame_ms` and `hitches_over_50ms`; the verifier
checks these against the raw CSV. Runtime logs and manifest declarations are
audit evidence, not cryptographic attestation. A producer cannot clear its own
visual work merely by emitting markers or setting review flags. All existing
same-build hashes, independent domain decisions and missing-evidence vetoes apply.
