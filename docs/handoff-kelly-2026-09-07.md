# Kelly Character Handoff - 2026-09-07

Historical note: commit `5019f8b` replaced this source with textured low-poly
Kelly under `/Game/KellyLowSource`. For current recovery instructions, read
`docs/handoff-kelly-low-2026-09-14.md`.

Paragon Phase has been replaced by the user's private Kelly character from
`D:\kelly-UE`.

## Current Gate

- `KELLY MIGRATION: PASS`
- `ENGINEERING: PASS`
- `RIDER POSE: CONDITIONAL PASS`
- `STRICT GATE 3: BLOCKED`

The 17-package dependency closure lives under ignored
`ue/NeonCleanerUE/Content/KellySource`. It includes the skeletal mesh,
skeleton, PhysicsAsset, original lip animation, and 13 material instances.
Derived Kelly riding animations are generated locally in the same ignored
folder.

## Restore on Another PC

1. Put the private Kelly source at `D:\kelly-UE`, or pass another source
   `.uproject` path explicitly.
2. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Migrate-KellyCharacter.ps1
```

3. Verify:

```powershell
powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1 `
  -FullVisualQA `
  -RiderPoseVerdict CONDITIONAL
```

Never commit `ue/NeonCleanerUE/Content/KellySource`.

## Source Limitation

The UE package contains no production texture assets and no imported XGen/Groom
hair, so it cannot reproduce `D:\kelly-UE\渲染图.jpg` exactly. The current
yellow/black/white palette is generated from the available material parameters.

## Next Quality Slice

Use Kelly-specific Control Rig/IK to lock both wrists to the handlebar grips and
both ankles to the foot pegs. Do not mark strict Gate 3 as passed until close
side views prove all four contacts.
