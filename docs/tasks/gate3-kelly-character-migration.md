# Task Packet: G3-KELLY-MIGRATION Replace Lin Xia Source Character

- State: `DONE`
- Owner: `Orchestrator / Producer`
- Created: `2026-09-07`
- Target branch: `codex/character-continuity-pipeline`
- Quality gate: `Gate 3`
- Worker budget: `1` independent QA reviewer / one UE writer
- Human approval required: `no` - the user explicitly selected the local Kelly asset

## Objective

Replace the missing Paragon Phase dependency with the existing UE 5.8 Kelly
character from `D:\kelly-UE`, preserving its mesh, skeleton, materials, and
available animation while keeping the playable motorcycle chase recoverable.

## Scope

- Inspect the Kelly skeletal mesh, skeleton, material, texture, physics, and
  animation dependencies in the source UE project.
- Copy the source project into a disposable staging project, then relocate only
  the character dependency closure under `/Game/KellySource` through UE
  Move/Rename operations, fix redirectors, save, and restore the relocated
  packages into NeonCleanerUE as local-only content.
- Switch the Lin Xia rider and validation scripts from Phase to Kelly.
- Keep this first slice focused on asset integrity and visible identity
  replacement. Kelly motorcycle IK/pose authoring is a separate follow-up.
- Capture default, side, and rear Gate 3 evidence and submit it to independent
  visual QA.
- Document the local restore source and cross-PC recovery procedure.

## Out Of Scope

- Uploading Kelly binary assets to the public GitHub repository.
- AI-video regeneration before the new identity and rider pose pass visual QA.
- Final environment art, combat, motorcycle physics, or unrelated HUD changes.
- Modifying the original `D:\kelly-UE` source project.
- Passing the strict rider-pose gate in the migration slice.

## Dependencies And Risks

- The local source project is
  `D:\kelly-UE\1. 正常版\kelly\我的项目\我的项目.uproject`.
- Kelly packages currently live at the source project's `/Game` root; copying
  them into a subfolder without UE relocation would break internal references.
- The required dependency closure is `rig`, `rig_Skeleton`,
  `rig_PhysicsAsset`, `rig_Anim`, and the 13 material packages referenced by
  `rig`. The map, HLOD, and World Partition External Actor packages are not
  migrated.
- Kelly uses names such as `Root_M`, `Spine1_M`, `Shoulder_L/R`,
  `Elbow_L/R`, `Wrist_L/R`, `Hip_L/R`, `Knee_L/R`, and `Ankle_L/R`.
  Existing Phase animation, IK Rig, Control Rig, and bone-name validation are
  incompatible and must not be reused as Kelly proof.
- Kelly redistribution rights are not established for this public repository,
  so all binary source packages remain local and ignored.
- Cross-PC recovery requires the documented local/Baidu asset-vault workflow.

## Acceptance Criteria

- [x] `/Game/KellySource/rig` loads as a skeletal mesh in NeonCleanerUE.
- [x] Kelly's skeleton, physics asset, material slots, and required
      dependencies load without missing references.
- [x] No relocated package dependency points back to `/Game/rig`,
      `/Game/rig_Skeleton`, `/Game/rig_PhysicsAsset`, `/Game/rig_Anim`, or any
      original root-level Kelly material path.
- [x] The visible Lin Xia rider uses Kelly rather than Phase in the chase.
- [x] Player 0 possession, movement, HUD, motorcycle alignment, and smoke checks
      still pass.
- [x] Default, side, and rear captures clearly show the Kelly identity.
- [x] Hips, torso, hands, feet, bars, pegs, seat, and wheel contact receive an
      explicit independent QA verdict.
- [x] No Kelly `.uasset`, source DCC file, or texture is staged for public Git.
- [x] Restore and verification commands are documented for another PC.
- [x] This slice records `RIDER POSE: CONDITIONAL`; strict pose approval remains
      blocked until a Kelly-specific animation/IK slice passes.

## Write Set

- `allowed_paths`:
  - `.gitignore`
  - `ue/scripts/*kelly*.py`
  - `ue/*Kelly*.ps1`
  - `ue/NeonCleanerUE/Content/KellySource/` (local-only, ignored)
  - `ue/NeonCleanerUE/Source/NeonCleanerUE/LinxiaMotorcyclePawn.*`
  - `ue/NeonCleanerUE/Source/NeonCleanerUE/PlayablePhaseCharacter.*`
    (legacy class name may remain temporarily, but Phase asset loads must stop)
  - `ue/NeonCleanerUE/Content/Python/init_unreal.py`
  - `ue/NeonCleanerUE/Config/DefaultEngine.ini`
  - Gate 3 validation, setup, smoke, capture, and Kelly migration scripts
  - `sync_project_start.ps1`
  - `AGENTS.md`
  - this task packet, QA report, and `docs/handoff.md`
- `read_only_paths`:
  - `D:\kelly-UE`
  - existing Gate 3 proof, Phase rig scripts, and rejected IK notes
- `single_writer`: the main Producer owns all UE/package and shared-doc writes

## Source Safety

- Never launch UE, Python inspection, resave, rename, or redirector cleanup
  against the original `D:\kelly-UE` project.
- Copy the source `.uproject`, `Config`, and `Content` into a unique disposable
  staging directory first.
- `inspect_kelly_source.py` requires `KELLY_INSPECT_OUTPUT` to be an explicit
  absolute JSON path. Run it only against the staging project; it has no
  fallback that writes into a project's `Saved` directory.
- Before and after staging, compare the original source file count, byte count,
  and latest-write timestamp. Any change blocks migration.

## Parallel Read-Only Checks

- **QA Director**: review this packet, inspect generated evidence, and reject
  missing identity/contact/material proof.

## Verification

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1 `
  -FullVisualQA `
  -RiderPoseVerdict CONDITIONAL
```

Expected proof: default, side, and rear PNGs under
`ue/NeonCleanerUE/Saved/Quality`, plus a QA report.

## Review Decision

- Gatekeeper: `CONDITIONAL PASS`
- Reason: Kelly migration and engineering checks pass. A generated
  Kelly-specific riding AnimSequence establishes a seated gameplay silhouette
  without bone stretching. Independent QA keeps strict hand/foot contact
  blocked until dedicated IK or Control Rig work.

## Result

- State: `DONE`
- Changed files: Kelly migration/inspection/style/ride-animation scripts,
  runtime character bindings, preview/map validation, smoke test, Gate 3
  quality script, cross-PC restore entrypoint, and QA documentation
- Commands and results:
  - UE 5.8 editor build: `PASS`
  - Kelly migration validation: `PASS`
  - Gate 3 map validation: `PASS`
  - possession/movement/HUD/smoke test: `PASS`
  - full multi-view Gate 3 check: `PASS`
- Evidence:
  - `source/reference/linxia/ue-captures/linxia_kelly_preview_2026-09-07.png`
  - `ue/NeonCleanerUE/Saved/Quality/linxia_motorcycle_gate3_quality_2026-09-07_191623.png`
  - same basename with `-side.png` and `-rear.png`
- QA verdict:
  - `KELLY MIGRATION: PASS`
  - `ENGINEERING: PASS`
  - `RIDER POSE: CONDITIONAL PASS`
  - `STRICT GATE 3: BLOCKED`
- Remaining risks: the supplied UE package has no production character
  textures or XGen/Groom hair, and strict hand-to-bar/foot-to-peg contact still
  requires Kelly-specific IK or Control Rig.
- Commit: pending
- Next action: use the accepted Kelly gameplay baseline; schedule strict
  contact IK as a separate quality slice.
