# Neon Cleaner Agent Production Workflow

This project now uses a two-agent production loop:

```text
Producer Agent -> QA Director Agent -> Fix Pass -> QA Sign-off -> Next Step
```

The goal is speed with control. The Producer is allowed to build quickly, but
no milestone moves forward until the QA Director has checked the result against
the current quality gate.

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

## Standard Loop

Every production slice follows this order:

1. Define the slice and its quality gate.
2. Producer implements the smallest useful version.
3. Producer runs local validation and records results.
4. QA Director reviews the output against the quality gate.
5. Producer fixes all blocking issues.
6. QA Director signs off or sends the slice back.
7. Orchestrator updates docs and moves to the next slice.

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
