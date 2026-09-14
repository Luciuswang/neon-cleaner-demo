# Task Packet: Playable Kelly Film Chase

- State: `QA / CONDITIONAL PASS`
- Owner: `Orchestrator / Producer`
- Created: `2026-09-14`
- Target branch: `codex/character-continuity-pipeline`
- Quality gate: `Gates 3, 4, 5`
- Worker budget: `3 specialists plus main integrator; one UE process`
- Human approval required: user authorized local private-source restoration,
  playable combat, environment art, and video transitions. No publication or
  paid external generation is implied.

## Objective

Deliver a locally playable Kelly motorcycle combat chase with a finished
environment pass and reliable film-to-gameplay-to-film transitions.

## Scope

1. Restore the textured Kelly dependency closure from source/kelly-UE and
   establish a fresh engineering and multi-view visual baseline.
2. Extend the existing chase with enemies, attack/avoidance, damage, objectives,
   outcomes, restart, readable HUD, and a complete playable encounter.
3. Dress the existing route with coherent wet-night industrial-city art,
   lighting, landmarks, road detail, effects, and clear collision boundaries.
4. Integrate the existing MediaPlayer bridge with possession, preload, input
   return, outcome selection, and matched transition cameras/occlusion.
5. Verify build, asset validation, playable smoke, media failures/restart,
   outcome branches, and UE-rendered visual evidence.

## Out Of Scope

- Publishing, purchases, private asset upload, unrelated web refactors.
- Claiming strict art acceptance from script checks alone.
- Generating identity-dependent AI clips before rider/reference QA passes.

## Dependencies And Risks

- source/kelly-UE is user supplied and must remain private and unchanged.
- Existing cinematics may not match the current Kelly identity/camera. Inspect
  available clips; use matched locally rendered transition footage when needed.
- Full production art acceptance depends on the supplied asset quality and
  visual QA. Record unresolved defects rather than calling them final.
- Preserve all earlier session changes.

## Acceptance Criteria

- [x] Kelly mesh/materials/textures restored and validated.
- [x] Keyboard/mouse driving, combat, damage, success/failure, restart work.
- [x] Route has distinct readable encounters, believable road/scene dressing,
      balanced lighting, grounded vehicles, and clear targets.
- [x] Intro yields control; results enter the appropriate outro; no frozen
      input, permanent black frame, or dependency on missing video files.
- [x] Rider and transition cameras inspected using fresh rendered evidence.
- [x] C++ build and Gate 3 pass; complete-loop smoke covers all outcomes.
- [ ] Independent engineering and visual QA verdicts recorded.

## Write Set

- Main: task/handoff/sprint, .gitignore, local migration execution, final
  integration and serialized UE generation/build/capture.
- Gameplay writer (after review): LinxiaMotorcyclePawn.*, chase GameMode/Hud.*,
  new combat actor files as needed. No bridge or scene generator writes.
- Bridge writer (after review): NeonCinematicBridgeSubsystem/Widget.* and
  bounded transition tooling. Agree gameplay interface before editing.
- Scene writer (after review): create_linxia_motorcycle_chase_level.py and
  dedicated environment scripts/assets. No running UE or saving binary assets
  concurrently; main runs generation after review.

## Verification

Run-Gate3QualityCheck.ps1 -FullVisualQA -RiderPoseVerdict CONDITIONAL,
complete-loop runtime smoke, media fallback/error checks, and visual inspection.
StrictRiderPoseGate PASS only after actual multi-view acceptance.

## Review Decision

- Gatekeeper: `PASS` after independent re-review of the concrete contract.
- GameMode alone owns Preparing -> Intro -> Playing -> Outro -> Results.
  Outcomes are None/Clean/Damaged/Lost. Bridge only presents a requested film
  and reports request ID + completion reason. Restart invalidates pending IDs.
- Shared definitions: NeonChaseTypes.h (main writes before dispatch).
- Bridge contract: PlayFilm(APlayerController*, ENeonChaseFilm, uint32),
  CancelFilm(), IsFilmActive(), native OnFilmFinished(uint32, FName).
  GameMode subscribes; no bridge-owned combat transitions or map auto-start.
- Route: straight X=-2000..110000 cm, center Y=0, road width 1200 cm,
  drivable center +/-480 cm. Three zones at X=18000,45000,75000, finish X=100000.
  Encounter target 60-90 seconds; deadline 95 seconds; max 6 active enemies.
  Damage/death and timer failure; catch/disable convoy for Clean/Damaged result.
- Pawn collision root and swept motion; obstacles explicitly tagged, no damage
  from decorative meshes. Freeze inputs, combat, motion, timers in film/results.
- Bridge must handle missing/open-failed/stalled media with bounded fallback,
  exactly-once completion, restart/teardown cancellation and aspect fit.
- Rendered continuity evidence must include moving intro/game/outro boundaries,
  stable camera/pose/exposure, decoded-frame readiness, and audio behavior.
- Gameplay writer allowed_paths: LinxiaMotorcyclePawn.*, LinxiaMotorcycleHud.*,
  LinxiaMotorcycleChaseGameMode.*, NeonChaseEnemy.* under Source/NeonCleanerUE.
- Bridge writer allowed_paths: NeonCinematicBridgeSubsystem.*,
  NeonCinematicBridgeWidget.* under Source/NeonCleanerUE; ue/scripts media
  capture tooling named neon_film_*. No pawn/GameMode writes.
- Scene writer allowed_paths: ue/scripts/create_linxia_motorcycle_chase_level.py,
  ue/scripts/neon_environment_*. No running UE or saving assets.
- Main owns build/verification wrappers and all binary generation. Baseline
  capture/build precedes edits; save a local ignored baseline map copy before
  regeneration. Rollback is file-specific restoration from that local snapshot
  or known Git baseline, preserving earlier user/session modifications.
- Evidence: .local/ build/migration logs and ignored Saved/Quality/ captures;
  final QA and run steps in handoff. Stages: restore/build/capture -> implement
  code/scripts -> integrate/build -> generate map -> smoke/render -> QA/rework.

## Result

- State: `QA / CONDITIONAL PASS`
- Restore: textured low-poly Kelly migration and dependency validation `PASS`;
  original source snapshots matched. Log: `.local/kelly-migration.log`.
- Engineering: C++ build, scene generation/validation, three gameplay outcomes,
  four film renders, Missing/Corrupt/Stall media recovery, and final gameplay
  capture all `PASS` through `ue/Run-NeonChaseQualityCheck.ps1`.
- Gate 3: `PASS`; rider pose remains `CONDITIONAL` under the existing strict
  visual policy.
- Environment: 366 actors, 12069 instances, 54 local lights. The current proof
  shows Kelly pursuing three readable enemy vehicles at night with wet-road
  reflections, rain, combat HUD, headlight, and underglow.
- Film transition review: all four MP4s decode, contain no gameplay HUD, and
  preserve the follow-camera endpoint used by the bridge.
- Media recovery: Missing -> `Missing`, Corrupt -> `OpenFailed`, Stall ->
  `FirstFrameTimeout`; each reports exactly one `completion=1`.
- Local visual verdict: `CONDITIONAL PASS`. The current generated scene is a
  coherent playable art pass, not an independent final-art sign-off.
- Independent QA: `PENDING`. Both assigned reviewers failed before review due
  to the account sub-agent usage limit.
- Evidence:
  `ue/NeonCleanerUE/Saved/Quality/neon-chase-final.png`,
  `ue/NeonCleanerUE/Saved/Quality/linxia_motorcycle_gate3_quality_2026-09-14_133615.png`,
  and `ue/NeonCleanerUE/Saved/Quality/film-record-*.log`.
