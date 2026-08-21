# Neon Cleaner Project Status - 2026-08-20

## GitHub Sync

- Local `main` was fetched and fast-forwarded to `origin/main` at `bde0b20`.
- `origin/main` contains the merged cinematic bridge / 3D takeover work.
- Remote branch `origin/codex/ue-day1-pc-prototype` exists and adds the first UE
  PC prototype.
- Current local work branch: `codex/character-continuity-pipeline`.

## Current Product State

- Web demo has a cinematic opening chain and playable 3D elevated chase takeover.
- A0 opening now follows the direction of:
  - AI video for film texture.
  - Procedural / real-time 3D for playable chase.
  - Marble / World Labs style material as spatial and atmosphere reference.
- UE Day 1 prototype has:
  - startup bridge video playback,
  - preloaded vehicle scene,
  - `Take Control` skip,
  - automatic handoff back to gameplay input.

## Main Risk

The hardest remaining problem is character continuity:

```text
AI-video Lin Xia must feel identical to UE gameplay Lin Xia.
```

The project should not keep letting each AI video redefine the character.

## Production Decision

Adopt this source-of-truth order:

1. UE heroine character / rider proxy.
2. UE motorcycle / camera match.
3. UE-rendered identity reference pack.
4. AI stills generated from UE references.
5. AI videos generated from approved stills.
6. UE gameplay handoff matched to the AI video ending frame.

The heroine design is no longer limited by the older AI-generated Lin Xia look.
Build the UE character first, then name that final UE asset as Lin Xia.

## Files Added Today

- `docs/character-continuity-pipeline.md`
- `docs/ue-heroine-character-brief.md`
- `ue/NeonCleanerUE/Docs/CharacterContinuity-Day2.md`
- `source/reference/linxia/README.md`

## Next Work

1. Install UE5 through Epic Games Launcher after logging in.
2. Build the UE heroine / rider proxy first, then define her as Lin Xia.
2. Build or place a motorcycle proxy that reads correctly from rear and
   rear-three-quarter camera angles.
3. Capture the first UE reference pack into `source/reference/linxia/ue-captures/`.
4. Regenerate A0-S04 as a handoff-first AI clip using the UE reference pack.
5. Replace the bridge movie only after the UE gameplay first frame matches the
   AI clip ending.
