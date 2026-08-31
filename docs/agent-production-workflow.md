# Neon Cleaner Agent Production Workflow

This project uses an adaptive multi-agent production loop with a mandatory QA
gate:

```text
Intake -> Planner -> Gatekeeper -> bounded workers -> Producer -> QA Director
                                      ^                         |
                                      +-------- Rework ----------+
```

The goal is speed with control. Small changes may stay with one Producer, while
larger slices can use parallel read-only specialist reviews. UE implementation
and shared project files remain single-writer operations. No milestone moves
forward until the QA Director has checked the result against the current
quality gate.

The detailed state machine, task packet, role permissions, human-approval
boundaries, and cross-PC rules live in:

```text
docs/multi-agent-production-system.md
docs/agent-task-template.md
```

## Roles

### Producer Agent

Owns execution.

- Implements UE code, levels, cameras, prototype assets, scripts, and docs.
- Keeps each work slice small enough to test in the same turn.
- Verifies the result locally before asking for QA review.
- Does not silently change the identity source for Lin Xia.
- Does not reset the Paragon Phase mesh relative transform unless replacing the
  whole character pipeline.
- Commits only when the current slice is coherent and recoverable.

### QA Director Agent

Owns quality control.

- Reviews each slice before the next production step begins.
- Checks character continuity, input feel, camera match, visual tone, and repo
  recoverability.
- Reports concrete issues with severity and reproduction notes.
- Can block progression when a core acceptance gate fails.
- Does not implement fixes directly in the same pass unless explicitly assigned
  a bounded fix task.
- Returns one of three verdicts for every gate: `PASS`, `CONDITIONAL PASS`, or
  `BLOCKED`.
- Checks that production docs agree on the current UE map, source character,
  restore path, and next milestone before sign-off.

### Orchestrator

Owns sequencing.

- Breaks the week into small production slices.
- Runs or delegates Producer and QA work.
- Converts QA findings into fix tasks.
- Decides whether a slice is good enough for prototype progress.
- Keeps the GitHub branch complete enough for handoff.

### Planner And Gatekeeper

For any normal or large slice, the Planner and Gatekeeper run before the
Producer writes implementation files.

- Planner defines the objective, scope, out-of-scope items, dependencies,
  acceptance criteria, write set, verification command, and rollback path.
- Gatekeeper independently returns `PASS`, `REWORK`, or `BLOCKED`.
- The Gatekeeper rejects missing proof plans, unsafe concurrent writes, unclear
  Marketplace/license boundaries, and work that bypasses a quality gate.

### Specialist Reviewers

Use only the specialists needed by the slice. UE Engineering, Visual/Gameplay
QA, Asset/License/Sync, and Docs/Release may inspect different evidence in
parallel. Their findings go back to the Orchestrator; they do not silently
modify the same UE or status file.

## Standard Loop

Every normal or large production slice follows this order:

1. Capture the request in a task packet and define the quality gate.
2. Planner decomposes the smallest useful slice and declares the write set.
3. Gatekeeper reviews scope, risk, dependencies, and proof; vetoes if needed.
4. Orchestrator dispatches bounded specialists; parallel work is read-only
   unless each worker has a disjoint write set.
5. Producer implements one coherent change and records validation evidence.
6. QA Director reviews the output against the quality gate.
7. Producer fixes blocking issues; the packet returns to `REWORK` or `BLOCKED`
   instead of silently expanding.
8. QA Director signs off and the Orchestrator updates handoff/sprint docs.

Micro-fixes may use `Producer -> self-check -> QA evidence -> commit` when they
have no visual, license, external-side-effect, or shared-file risk.

QA verdict meanings:

- `PASS`: all blocking criteria are met; the next slice may begin.
- `CONDITIONAL PASS`: prototype work may continue, but listed issues must be
  fixed before external demo, GitHub handoff, or AI regeneration.
- `BLOCKED`: the next slice cannot begin until the listed blockers are fixed and
  re-reviewed.

## Quality Gates

### Gate 1: Playable Lin Xia Baseline

Required before building chase content.

- UE opens the startup preview map without manual repair.
- `PlayablePhaseCharacter` is possessed by Player 0.
- `WASD`, arrows, mouse look, and jump work.
- Camera direction and movement direction feel aligned.
- Run animations match movement direction; no sideways run or skating.
- Hair and face are readable enough under the preview light.
- The Paragon Phase source asset path is documented and not committed.

### Gate 2: Rider / Motorcycle Proxy

Required before generating new AI handoff video.

- Rear and rear-three-quarter camera angles read as Lin Xia on a motorcycle.
- Motorcycle scale is believable next to the rider.
- Wheels touch the ground; no hover-bike or toy-bike read.
- Black tactical silhouette with restrained magenta/cyan accents is visible.
- The proxy supports a gameplay camera without hiding the rider.
- UE reference captures exist before any AI video generation resumes:
  front/side/back, half-body, riding pose, handoff camera match, and motorcycle
  three-quarter views.

### Gate 3: Handoff Camera Match

Required before replacing or regenerating bridge movie clips.

- The final AI-video target frame can be recreated by a UE camera within one
  second of gameplay start.
- Motion direction is consistent across the cut.
- Rain/night color temperature, contrast, and lens energy are close enough that
  the cut feels intentional.
- A smoke, flare, splash, shadow, or occlusion beat exists to hide small mismatch.
- The cut avoids direct AI face close-up to UE face close-up comparison. Prefer
  rear, rear-three-quarter, rain splash, glare, vehicle occlusion, bridge shadow,
  or whip camera handoff.

### Gate 4: 30-60 Second Chase Prototype

Required before calling the week successful.

- Player can take control and drive immediately.
- The route has a clear forward path and at least three readable action beats.
- Obstacles are avoidable and do not block the whole lane.
- A convoy or target exists ahead so the player understands the pursuit.
- The scene reads as Neon Cleaner: post-war, wet, cold, damaged, restrained
  magenta signal accents.

### Gate 5: Handoff-Ready Repository

Required before pushing any end-of-day milestone.

- Working tree is clean except ignored local/cache files.
- UE binary assets are tracked by Git LFS where needed.
- Epic/Fab Marketplace assets are not redistributed in the public repository.
- `docs/handoff.md` says exactly how to restore and run the current milestone.
- A fresh clone can be brought back to the milestone with documented steps.

## Blocking Rules

These issues block progression:

- Character controls or animation direction are wrong.
- The visible character identity changes between AI and UE references.
- AI video generation starts before the UE reference pack passes QA.
- The motorcycle reads as floating, sliding, or badly scaled.
- The gameplay first frame cannot plausibly match the AI clip ending.
- Docs disagree about the current startup map, source character, or restore path.
- A milestone depends on local files that are neither committed nor documented.
- Public GitHub upload would include third-party Marketplace content.

These issues can be deferred for prototype speed:

- Final MetaHuman face fidelity.
- Final hair groom quality.
- Final motorcycle rig.
- Final city-scale environment art.
- Complex combat systems beyond simple chase readability.

## Daily Operating Rhythm

Use this rhythm during active project days:

```text
Morning: define the next slice and quality gate.
Midday: build the slice and run local verification.
Afternoon: QA review, fix blockers, capture proof.
End of day: update handoff docs and push a coherent version if useful.
```
