# Neon Cleaner Character Continuity Pipeline

Last updated: 2026-08-20

## Production Goal

Make Lin Xia feel like the same character across:

1. AI-generated cinematic shots.
2. UE5 real-time playable takeover.
3. Branch-result cinematic clips.

The core rule is:

```text
UE character is the source of truth. AI video is generated from UE references.
```

Do not treat an AI video frame as the master identity unless it has first been
matched back to the UE character.

## Current Project Status

- `origin/main` is up to date at `bde0b20`.
- Web demo already has the latest cinematic-to-3D takeover pass merged.
- Remote branch `origin/codex/ue-day1-pc-prototype` adds a first UE PC prototype.
- The UE prototype plays `Content/Movies/NeonCleaner_A0_Bridge.mp4`, preloads the
  vehicle scene, and returns input when the bridge movie ends or the player
  clicks `Take Control`.

## Canonical Identity Lock

The heroine identity is now UE-first. The current A0 motorcycle text direction
is only a temporary style reference until a final UE character asset replaces it:

```text
Lin Xia is an East Asian female motorcycle rider in her early 20s, slim athletic
build, sharp tired eyes, grounded human realism, exhausted and precise.
```

Readable silhouette anchors:

- Black tactical rider silhouette.
- Short asymmetrical black hair with controlled magenta/cyan accent only if the
  final UE asset supports it.
- Cropped or fitted black riding jacket, tactical leather pants, gloves, boots.
- Restrained magenta energy language shared between coat details and motorcycle.
- No idol posing, no fashion-ad framing, no oversexualized body language.

If the UE asset changes any of these details, the UE asset wins. Update this
document first, then regenerate AI references from UE.

## Asset Authority Order

1. UE playable Lin Xia skeletal mesh / MetaHuman / custom character.
2. UE motorcycle / rider rig / gameplay camera.
3. UE-rendered identity reference frames.
4. AI still frames generated from UE references.
5. AI videos generated from approved UE-matched stills.

This order matters. A later AI output can be visually inspiring, but it should
not silently redefine face, hair, costume, age, or body proportions.

## UE Reference Capture Pack

Create these renders from UE before producing the next AI video pass:

```text
source/reference/linxia/ue-captures/
```

Required stills:

- `linxia_turntable_front.png`
- `linxia_turntable_left.png`
- `linxia_turntable_right.png`
- `linxia_turntable_back.png`
- `linxia_halfbody_neutral.png`
- `linxia_halfbody_rain_keylight.png`
- `linxia_rider_pose_side.png`
- `linxia_rider_pose_back_3q.png`
- `linxia_takeover_camera_match.png`
- `motorcycle_front_3q.png`
- `motorcycle_side.png`
- `motorcycle_rear_3q.png`

Capture notes:

- Use the same FOV family as the handoff camera, not a beauty portrait lens.
- Include one clean neutral reference and one rain/night production reference.
- Keep magenta/cyan lighting restrained so AI does not over-amplify it.
- Render at 16:9 and 4:5 when possible; video tools often need both.

## AI Video Rules

Every cinematic prompt using Lin Xia must include:

- UE reference frames as image inputs.
- One sentence saying the UE render is the identity source.
- The current shot action.
- The handoff camera requirement when the shot leads into gameplay.
- A negative block forbidding face drift, hair drift, costume redesign, hover
  bikes, idol posing, text, subtitles, HUD, and logo.

Do not ask the model to solve too many things in one clip. For A0-S04, prefer:

1. Mount motorcycle.
2. Start pursuit from behind.
3. Obstruction flash / rain splash / vehicle occlusion into gameplay.

## UE Handoff Rules

The cut from AI video to UE should avoid a direct face comparison.

Best handoff shapes:

- Back-camera rider view.
- Rear three-quarter motorcycle shot.
- Rain splash across lens.
- Passing under broken overpass shadow.
- Headlight glare or restrained explosion light.
- Camera whip that lands on the UE gameplay camera.

Avoid:

- AI face close-up cutting directly to UE face close-up.
- AI full-body hero pose cutting to a stock vehicle-template pawn.
- Bright daylight or clean studio lighting.
- UI text explaining the handoff.

## Acceptance Checklist

Before a clip is accepted:

- Lin Xia reads as the same person from silhouette alone.
- Hair shape and jacket structure do not change across the clip.
- Motorcycle wheels touch the ground and the vehicle scale is believable.
- The final frame can be matched by a UE camera within one second.
- The first UE gameplay frame keeps the same rain, color temperature, lens
  energy, and motion direction.
- No text, subtitle, watermark, HUD, or accidental logo appears.

## Next Production Step

Day 2 should create a UE Lin Xia placeholder rig even if the final MetaHuman is
not ready:

1. Add a rider proxy with locked silhouette colors.
2. Place the proxy on the vehicle / motorcycle camera path.
3. Capture the first UE reference pack.
4. Use those frames to regenerate A0-S04 as a handoff-first clip.
