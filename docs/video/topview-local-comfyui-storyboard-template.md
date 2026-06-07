# Topview-Style Local ComfyUI Storyboard Template

Use this template after storyboard still frames have been approved. The correct order is: script beat -> storyboard still -> approval -> image-to-video clip -> playable branch integration. The goal is not to generate one long movie in one pass.

For the still-frame phase, use:

```text
docs/video/topview-storyboard-stills-first.md
docs/video/topview-storyboard-stills.json
```

## Production Rule

Do not generate video before the still frame is approved. Each generated clip must answer four questions before it is accepted:

- What story beat does this shot prove?
- What must remain visually consistent?
- Where does the shot hand off to gameplay or the next movie?
- What is the first frame or final frame we need to preserve?

## Local ComfyUI Setup

Recommended workflow:

```text
D:\AI\SULPHUR2_ComfyUI\ComfyUI\user\default\workflows\00_OPEN_THIS_CAR_CHASE_T2V.json
```

Recommended server:

```text
http://127.0.0.1:8190
```

Recommended first pass settings for RTX 3080 Ti 12GB:

```text
duration: 5 to 10 seconds
fps: 25
width: 768 or 960
height: 432 or 540 for landscape tests
final upscale: only after motion and composition are approved
```

## Prompt And Workflow Tools

Print a storyboard still prompt first:

```powershell
node tools/comfy/print_storyboard_still_prompt.mjs SB-A0-01
```

Print a shot card prompt:

```powershell
node tools/comfy/print_storyboard_prompt.mjs A0-S02
```

Build a shot-specific ComfyUI workflow from this storyboard:

```powershell
node tools/comfy/build_storyboard_t2v_workflow.mjs A0-S02 --root D:\AI\SULPHUR2_ComfyUI
```

Build into the repo for review:

```powershell
node tools/comfy/build_storyboard_t2v_workflow.mjs A0-S02 --base D:\AI\SULPHUR2_ComfyUI\ComfyUI\user\default\workflows\SULPHUR2\video_ltx2_3_t2v.json --out tools/comfy/generated/A0-S02_chase_to_takeover.json
```

## Global Style Lock

```text
Post-war future San Francisco, rain, wet asphalt, damaged downtown buildings, broken Golden Gate Bridge, mist, smoke layers, magenta emergency signal lights, grounded sci-fi, photorealistic, premium cinematic action thriller, strong lens depth, controlled contrast, natural reflections, practical explosions, no readable text.
```

## Character Lock: Lin Xia

```text
East Asian female, early 20s, slim athletic build, pale skin, black ponytail with loose front strands, sharp tired eyes, long black tactical leather coat with magenta inner lining and subtle magenta glowing strips near the hem, fitted black combat clothing, gloves, utility belt, black boots, grounded tactical sci-fi styling, burdened but resilient.
```

Continuity rules:

- Preserve face shape, eye spacing, hairline, coat silhouette, and black tactical styling.
- Do not turn her into an idol portrait, fantasy warrior, or fashion model.
- For action scenes, identity can be protected by silhouette and costume before close-up face detail.

## Vehicle Lock

Player vehicle:

```text
low damaged futuristic pursuit car, dark graphite body, magenta dashboard glow, rain on windshield, low hood-line, combat-modified but realistic, no toy scale.
```

Enemy vehicle:

```text
armored black hostile vehicle, heavier silhouette, reinforced panels, damaged tail lights, dirty wet bodywork, readable direction and consistent scale.
```

## Universal Negative Prompt

```text
cartoon, anime, toy car, low poly, game UI, HUD text, subtitles, watermark, logo, readable text, floating car, car changing shape, inconsistent vehicle, wrong car scale, car without wheels, broken perspective, static camera, no road movement, no background parallax, jump cut, scene cut, sudden camera teleport, overexposed white sky, flat billboard explosion, particles only in center of screen, fake fireworks, magic effect, unrealistic pink cloud, explosion not lighting the environment, smoke without volume, blurry, low quality, warped road, distorted buildings, duplicated cars, melted vehicles, camera too high, cockpit blocking the view, fashion shoot, idol pose, fantasy armor, exposed midriff
```

## Shot Card Fields

Copy this card for every shot.

```text
shot_id:
branch_node:
clip_role:
target_duration:
input_mode:
source_reference:
first_frame_requirement:
final_frame_requirement:
camera:
action:
continuity_locks:
positive_prompt:
negative_prompt:
handoff_strategy:
acceptance_check:
reject_if:
game_integration:
```

## Shot 01: A0-S01 Establishing War Signal

```text
shot_id: A0-S01
branch_node: A0
clip_role: cinematic opening
target_duration: 6 seconds
input_mode: text-to-video first pass, image-to-video after approving a keyframe
source_reference: optional WorldLabs/Marble panorama or generated city keyframe
first_frame_requirement: wide view of damaged future San Francisco after rain
final_frame_requirement: camera settles toward the road corridor where chase can begin
camera: slow expensive aerial glide, not shaky, high to medium descent
action: smoke moves, rain falls, distant magenta emergency lights pulse, damaged city breathes
continuity_locks: broken bridge, wet road, post-war scale, magenta signal color
```

Positive prompt:

```text
Epic post-war future San Francisco after rain, a grand cinematic establishing shot over a wounded city. Broken Golden Gate Bridge structures in the distance, damaged downtown towers, cracked elevated tracks, smoke columns, ruined drones, wet streets reflecting cold blue-gray light and restrained magenta emergency signals. Heavy mist and light rain create deep atmospheric layers. The camera slowly glides downward toward a road corridor that can become a chase route. Photorealistic premium sci-fi war drama, large scale, grounded, expensive lensing, natural rain reflections, controlled contrast, no characters, no readable text.
```

Handoff strategy:

```text
End with the road corridor centered, horizon line stable, enough road visible to cut into chase footage.
```

Acceptance check:

```text
The city must feel large, damaged, and cinematic. The final two seconds must point toward a playable path.
```

## Shot 02: A0-S02 Chase Into Takeover

```text
shot_id: A0-S02
branch_node: A0 to I1
clip_role: movie-to-play transition
target_duration: 10 seconds
input_mode: text-to-video first pass; image-to-video if a strong chase keyframe is created
source_reference: approved Marble world frame or A0-S01 final frame
first_frame_requirement: low chase camera behind player pursuit car
final_frame_requirement: hood-level or first-person driving view, enemy car ahead
camera: low road-level tracking camera, strong parallax, smooth push into first-person
action: pursuit car chases armored enemy vehicle through wet damaged street, side explosions, magenta reflections
continuity_locks: wet post-war San Francisco, magenta emergency glow, consistent vehicles
```

Positive prompt:

```text
A realistic cinematic 10-second landscape video, 16:9, set on a post-war future San Francisco street in heavy mist and light rain. Wet asphalt, damaged downtown buildings, debris on the road, broken Golden Gate Bridge visible in the distance, magenta emergency signal lights reflecting on puddles and car windows. Photorealistic, high detail, cinematic lighting, dramatic but grounded.

One continuous shot, no cuts. The shot begins as a low tracking chase camera close behind a futuristic damaged pursuit car driving fast through the ruined San Francisco street. Ahead, an enemy armored black vehicle speeds through the mist, weaving between abandoned cars and cracked lane markings. Both cars keep consistent shape, scale, and direction throughout the entire shot.

The camera moves forward with strong road parallax, very low to the wet street, intense speed feeling. Magenta neon reflections slide naturally across the road surface, building glass, car paint, and chrome. Small explosions happen on the side of the street, with realistic orange fireballs, smoke, sparks, debris, and light spill. The explosions briefly illuminate the wet asphalt, nearby cars, smoke, and the side of the enemy vehicle, then fade naturally. No flat particles, no screen-center effects.

During the final two seconds, the camera smoothly pushes into a first-person hood-level driving view, as if the viewer is taking control of the pursuit car. The car hood and windshield edge are barely visible at the bottom of the frame, low and cinematic, not blocking the road. The enemy car remains ahead on the right side of the road. The final frame should look like a playable first-person driving takeover moment: wet road ahead, damaged San Francisco street, enemy car in front, magenta signal lights, mist, realistic motion blur, strong cinematic tension.
```

Handoff strategy:

```text
Use the final hood-level frame as the first gameplay frame. Match camera height, road direction, enemy car position, and magenta signal color.
```

Acceptance check:

```text
There must be clear forward road motion and background parallax. The final frame must be playable.
```

Reject if:

```text
The camera floats high above the road, the cars morph, explosions are flat particles, or the final frame cannot align with gameplay.
```

## Shot 03: I1-S01 First Playable Beat

```text
shot_id: I1-S01
branch_node: I1
clip_role: first interactive takeover
target_duration: gameplay segment, not AI-generated movie
input_mode: in-engine/web runtime
source_reference: A0-S02 final frame
first_frame_requirement: camera position matches A0-S02 final frame
final_frame_requirement: branch result chooses C1, C2, or C3
camera: first-person hood-level chase camera
action: player stabilizes pursuit car, avoids debris, keeps enemy vehicle in sight
continuity_locks: road heading, camera height, enemy car ahead, magenta signal glow
```

Game integration:

```text
Use A0-S02 as the lead-in movie. Freeze or crossfade the final 8 to 12 frames into the web driving scene. Player score controls the branch:

C1 Clean Pursuit: high attack, high stability
C2 Damaged Pursuit: medium score or collision
C3 Lost Trail: low stability, missed route, or speed collapse
```

Acceptance check:

```text
The player should feel that the movie became controllable, not that a separate toy scene appeared.
```

## Branch Result Clip Cards

C1 clean success:

```text
Lin Xia's pursuit vehicle cleanly outmaneuvers the hostile armored car through a rain-soaked damaged future San Francisco street. The camera stays low and fast, road parallax is strong, sparks and debris pass close to the windshield, magenta signal lights reflect across wet asphalt, controlled driving, decisive momentum, cinematic victory energy.
```

C2 damaged success:

```text
The pursuit continues but the player vehicle takes visible damage. Cracked windshield edge, sparks from the hood, unstable steering, the enemy car remains ahead through smoke and rain. The city lights smear across wet asphalt, magenta signal reflections flicker, the chase survives but at a cost, cinematic tension, realistic damage.
```

C3 lost trail:

```text
The enemy vehicle disappears through smoke, blast light, and collapsing road cover. The camera pushes into a damaged San Francisco intersection too late, rain and ash drifting through magenta reflections, road empty ahead, distant engine sound fading, regret and delay, cinematic tragic branch.
```

## Review Checklist

Before a clip is accepted, check:

- Does the shot serve one exact story beat?
- Is the camera motion readable?
- Does the final frame support the next game or movie segment?
- Do vehicles keep the same shape and direction?
- Are magenta lights affecting wet road, smoke, and nearby objects naturally?
- Is there no UI text, subtitles, logo, or readable signage?
- Can this clip be trimmed without breaking the branch map?

## File Naming

Use consistent names so the web project can wire clips cleanly.

```text
source/video/A0_S01_war_signal_establishing.mp4
source/video/A0_S02_chase_to_takeover.mp4
source/video/I1_S01_takeover_placeholder.mp4
source/video/C1_clean_pursuit.mp4
source/video/C2_damaged_pursuit.mp4
source/video/C3_lost_trail.mp4
```

After approval, copy muted browser-ready files into:

```text
web/assets/video/
```
