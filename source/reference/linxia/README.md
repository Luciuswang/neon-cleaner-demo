# Lin Xia Reference Source

This folder is for source-of-truth reference images used to keep Lin Xia
consistent between AI cinematics and UE gameplay.

## Folder Layout

```text
source/reference/linxia/
  ue-captures/       UE-rendered identity and handoff references
  ai-approved/       AI stills approved because they match UE identity
  rejected-drift/    Useful examples of face, costume, scale, or pose drift
```

## Rule

UE captures are the authority. AI outputs can only become approved references
after they match the UE silhouette, costume structure, motorcycle scale, and
handoff camera.

## First Capture Set

Create these from UE Day 2:

- front, side, rear, and rear three-quarter Lin Xia turntable
- rider pose from side
- rider pose from rear three-quarter
- gameplay handoff camera match
- motorcycle front, side, and rear three-quarter

Use these captures as image references for the next A0-S04 handoff clip.

## Current Technical Preview

`ue-captures/linxia_phase_preview_2026-08-24.png` proves that the current UE
Phase-based Lin Xia baseline loads and renders in game mode. It is not approved
as a front-facing AI identity reference because the captured pose is still a low
combat stance.

Use it only as technical proof for Gate 1. Gate 2 must create a stronger rider
reference pack before AI still or video generation resumes.
