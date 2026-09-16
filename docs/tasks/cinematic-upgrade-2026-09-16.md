# Cinematic elevated-highway upgrade — 2026-09-16

- State: REWORK; integration checkpoint implemented and engineering verified, final cinematic/AI-video acceptance remains BLOCKED.
- Owner: root integrator; branch codex/character-continuity-pipeline; baseline 602e15d.
- User authorizes autonomous resource acquisition/downloads and production. No repeated download permission needed. Do not infer authorization to buy arbitrary assets or publish restricted content.
- Scope: real elevated highway, source-backed PBR surfaces/assets, natural Kelly steering/contact, believable enemy vehicles, stricter Producer and independent QA requirements.
- Planner/Gatekeeper: independent quality_gatekeeper, PASS TO IMPLEMENT (2026-09-16), not art acceptance.
- Worker budget: three bounded specialists; no competing UE writers/processes.

## Write ownership

- root: environment Python, import scripts, enemy code, QA tooling, project documentation, serialized UE build/import/capture and integration.
- rider_producer: LinxiaMotorcyclePawn.cpp/.h and new Capture-NeonRiderMotion.ps1 only. No concurrent UE invocation.
- asset_scout: read-only inventory and verified source research.
- quality_gatekeeper: independent initial plan/final evidence review; bounded evidence-verifier/test implementation, separately validated by root.
- Preserve pre-existing user edit ue/Register-EpicProjectForFab.ps1.

## Acceptance / evidence

Engineering, elevated environment, asset/material quality, rider anatomy/contact, enemy vehicle scale, temporal/performance, and AI continuity receive SEPARATE verdicts.
No missing evidence, skipped capture, numeric IK endpoint check or successful compile can grant visual PASS.
Required views: gameplay; bridge side/wide with deck, piers and lower terrain; rider front/side/rear plus palm closeups; enemies three-quarter/side; >=10s left-neutral-right-return motion.
Record asset dimensions, license/source/checksum, engine/build, render settings, artifact hashes, measured performance and independent review reasons. AI generation waits for accepted UE reference pack.

## Implementation sequence

1. Capture original game, audit existing false-pass paths and asset sources.
2. Keep gameplay road at Z=-5cm; lower city/water by 1800cm and construct load-bearing bridge geometry. Import verified PBR source textures and suitable meshes.
3. Improve deterministic steering and genuine grip-driven contact in disjoint pawn implementation.
4. Compile, regenerate map with one UE process, validate, capture same-build evidence and independently reject/rework defects.
5. Update handoff with actual results, limitations and reproducible next actions. Rollback by reverting only this slice's tracked files; retain external downloads in source cache.

## Initial evidence

Original runtime capture: ue/NeonCleanerUE/Saved/Quality/cinematic-before.png.
Existing environment is ground-level waterfront. Enemy chassis/cabin are Engine cubes. Kelly uses private textured low-poly /Game/KellyLowSource/asda.asda; no visual PASS for final cinematics.

## Checkpoint result

See `docs/qa/cinematic-upgrade-2026-09-16.md` and evidence JSON. Actual elevated
structure/PBR and authored cars are now active; grips/pose/steering improved.
Current build, full Gate3 engineering and all three encounter outcomes pass.
Independent reviewer vetoes cinematic completion because environment/hero assets
remain visibly provisional, natural wrist/finger contact fails closeup review,
and imported bike wheels/fork are not animated. High-bike 4K candidate is private
and inactive pending rig/LODs/fit. High Kelly production images/groom dependencies
are absent; geometry-only replacement is not accepted.

No final AI video generation or public publishing occurred. User's download and
production authorization remains in force for subsequent rework. Preserve the
unrelated Fab registration edit; no safety/approval hold is being imposed.
