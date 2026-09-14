# Textured Low-Poly Kelly Handoff - 2026-09-14

This note supersedes the older Phase and untextured Kelly restore instructions.
Branch `codex/character-continuity-pipeline` was synchronized with origin at
`5019f8b` (2026-09-08, textured low-poly Kelly) at session start.

## Current Baseline

- Character mesh: `/Game/KellyLowSource/asda.asda`.
- Startup map: `/Game/LinxiaPreview/LVL_Linxia_CharacterPreview`.
- Chase map: `/Game/LinxiaChase/LVL_Linxia_MotorcycleChase`.
- Private mesh, skeleton, physics, materials, and textures belong in ignored
  `ue/NeonCleanerUE/Content/KellyLowSource/`; GitHub does not restore them.
- On this PC, UE 5.8 and the private Kelly source are available. The textured
  dependency closure was migrated into ignored `Content/KellyLowSource`,
  validated, and used by the playable chase and film captures.

## Restore

Use the user's private UE source project:

```powershell
.\ue\Migrate-KellyLowCharacter.ps1 -SourceProject "<private-source.uproject>"
.\sync_project_start.ps1 -ValidateUE
.\ue\Run-Gate3QualityCheck.ps1 -FullVisualQA -RiderPoseVerdict CONDITIONAL
```

The migration stages a copy and validates the dependency closure. It refuses to
replace an existing KellyLowSource directory; inspect partial restores first.
Mesh presence in the startup check alone is not an asset or visual QA pass.
Keep KellyLowSource excluded from the public repository.

## Evidence And Next Step

Historical proof committed with `5019f8b` is under
`source/reference/linxia/ue-captures/`:

- `linxia_kelly_low_preview_2026-09-08.png`
- `linxia_kelly_low_final_gate3_2026-09-08.png`
- `linxia_kelly_low_final_gate3_2026-09-08-side.png`
- `linxia_kelly_low_final_gate3_2026-09-08-rear.png`

Local recovery and chase validation now pass. New proof is under ignored
`ue/NeonCleanerUE/Saved/Quality/`, including `neon-chase-final.png` and
`linxia_motorcycle_gate3_quality_2026-09-14_133615.png`. These establish the
playable engineering baseline on this PC, but not a strict rider-pose PASS.
AI-video continuity remains blocked pending accepted multi-view hand/bar and
foot/peg contact.

Session recovery task and verification:
`docs/tasks/kelly-low-session-recovery-2026-09-14.md`.
