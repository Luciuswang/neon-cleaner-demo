# Topview-Style Storyboard Stills First

This is the correct production order for the interactive film/game demo:

```text
script beat -> storyboard still -> approve frame -> image-to-video -> edit into game branch
```

Do not start with video generation. Video is phase 2. The first goal is to lock composition, style, character/vehicle identity, and the future San Francisco world with still storyboard frames.

## Phase Order

1. `Script`
   Decide the story beat and branch purpose.

2. `Storyboard still`
   Generate one strong keyframe for the shot. This can be made with any still-image model, ComfyUI image workflow, Photoshop AI, Midjourney, DALL-E, or another image tool. The result is judged as a film frame, not as final video.

3. `Approval`
   Keep only frames that pass composition, continuity, and game-handoff checks.

4. `I2V`
   Use the approved still frame as the first frame or reference frame in `Image to Video (LTX-2.3)`.

5. `Game handoff`
   Match the final video frame to the web playable scene.

## Where Approved Frames Go

Save approved storyboard images here:

```text
source/storyboard/approved/
```

Then copy the approved frame into ComfyUI input:

```text
D:\AI\SULPHUR2_ComfyUI\ComfyUI\input
```

Use this workflow only after the still frame is approved:

```text
C:\Users\Administrator\Desktop\ComfyUI工作流\A0-S01_I2V_可上传首帧图.json
```

## Global Visual Lock

```text
post-war future San Francisco, dramatic city height difference, layered high-road and low-road system, partially damaged elevated freeway and chase ramps, wet asphalt after rain, damaged downtown buildings, broken Golden Gate Bridge in the distance, drifting smoke, cold blue-gray atmosphere, restrained magenta emergency signal lights, cinematic sci-fi action thriller, grounded realism, premium film frame, natural reflections, volumetric haze, foreground-midground-background separation, subtle lens halation, controlled bloom, realistic wet-surface specular, no readable text
```

## Global Negative Prompt

```text
cartoon, anime, illustration, comic style, toy car, low poly, game screenshot, HUD, UI text, subtitles, watermark, logo, readable text, plastic materials, fantasy armor, fashion ad, idol pose, overclean city, no war damage, flat lighting, blurry, low detail, distorted buildings, warped road, duplicated vehicles, melted car, wrong scale, floating objects, overexposed white sky, flat generic freeway, endless straight highway, no city height difference, no elevated chase route, generic concept art, sterile CG, weak atmosphere, overprocessed HDR, posterized lighting, muddy composition, empty sky, no foreground depth, no volumetric haze
```

## Stills To Generate First

### SB-A0-01: Establishing World Frame

Purpose:

```text
Prove the world: post-war San Francisco is cinematic, damaged, wet, and large-scale.
```

Still prompt:

```text
A premium cinematic storyboard still of post-war future San Francisco after rain, seen from a half-bird's-eye elevated overlook that clearly shows San Francisco's dramatic height difference. A damaged elevated freeway and broken chase ramp cut across the frame above lower wet city streets, creating a strong high-road versus low-road read. Broken Golden Gate Bridge structures are visible in the misty distance, damaged downtown towers rise on both sides, cracked elevated tracks and road scars descend through the city, smoke columns drift behind buildings, ruined drones and abandoned vehicles sit near the roadside below. The sky is heavy with dense storm clouds, layered thunderheads, and visible lightning ripping through the distance. Far across the skyline, tiny but readable flashes of battle show carbon-based human forces and silicon-based machine forces fighting in the background with tracer fire, distant explosions, and airborne combat silhouettes. Wet asphalt reflects cold blue-gray storm light and restrained magenta emergency signal lights. Add strong foreground, midground, and background separation, volumetric haze, realistic wet-surface specular response, subtle lens halation around practical lights, premium anamorphic film rendering, controlled bloom, expensive atmospheric depth, and grounded real-world material behavior. No characters. Photorealistic, grounded sci-fi war drama, expensive film composition, strong depth, natural rain reflections, atmospheric perspective, 16:9.
```

Approval check:

```text
The frame must immediately read as San Francisco after a large conflict. It must clearly show a layered high-and-low road system, with a visible elevated chase corridor that can later become the pursuit route, plus a storm-heavy sky and distant war activity that expand the world scale.
```

### SB-A0-02: Lin Xia Overlook Frame

Purpose:

```text
Prove heroine identity and emotional tone before action begins.
```

Still prompt:

```text
A premium cinematic storyboard still of Lin Xia standing on a rooftop edge or shattered overpass above post-war future San Francisco after rain. She is an East Asian woman in her early 20s, slim athletic build, pale skin, black ponytail with loose front strands, sharp tired eyes, long black tactical leather coat with magenta inner lining and subtle magenta glowing strips near the hem, fitted black combat clothing, gloves, utility belt, black boots. She looks over the wounded city with grief, pressure, endurance, and a faint thread of hope. Behind her, the city must show layered height: raised damaged freeway sections, descending streets, lower rain-soaked districts, broken infrastructure, restrained magenta emergency lights, cold mist. Photorealistic, grounded sci-fi, premium film frame, no fashion pose, 16:9.
```

Approval check:

```text
Lin Xia must look human and burdened, not like a fashion model. Her silhouette and coat must be readable.
```

### SB-A0-03: Convoy Target Frame

Purpose:

```text
Reveal the enemy vehicle and create the action objective.
```

Still prompt:

```text
A cinematic storyboard still of an armored black hostile vehicle cutting through a partially damaged elevated freeway ramp in post-war future San Francisco at night after rain. The camera is low and behind cover, looking toward the vehicle as it moves through mist on the high route, with the lower city dropping away on one side. Wet asphalt reflects restrained magenta emergency signal lights, broken lane markings, damaged guardrails, cracked elevated concrete, smoke and sparks near the roadside. The vehicle has a heavy reinforced silhouette, dirty wet panels, damaged tail lights, realistic scale, no toy look. Photorealistic grounded sci-fi pursuit setup, premium action-thriller frame, 16:9.
```

Approval check:

```text
The enemy vehicle must be readable and consistent enough to become the chase target. The elevated route and height difference must be obvious at first glance.
```

### SB-I1-01: Chase Handoff Frame

Purpose:

```text
Create the exact frame that can become the first playable driving view.
```

Still prompt:

```text
A first-person hood-level cinematic storyboard still from inside or just above a damaged futuristic pursuit car, driving on a partially damaged elevated freeway segment in post-war future San Francisco after rain. The car hood and windshield edge are barely visible at the bottom of frame, low and cinematic, not blocking the road. Ahead, an armored black hostile vehicle is visible in the same lane through mist and rain. One side of the route drops toward the lower city, while damaged buildings, layered roads, and broken Golden Gate Bridge structures appear in the distance. Wet asphalt, broken lane lines, debris, damaged guardrails, restrained magenta emergency lights reflecting on puddles and car paint. Photorealistic, grounded, intense but readable driving takeover frame, 16:9.
```

Approval check:

```text
This frame must look playable. The road direction, camera height, enemy car position, and elevated-route risk must all be usable in the web driving scene.
```

### SB-C1-01: Clean Pursuit Result Frame

Purpose:

```text
Winning branch visual target.
```

Still prompt:

```text
A cinematic storyboard still of Lin Xia's pursuit vehicle cleanly outmaneuvering the hostile armored car on a rain-soaked damaged elevated freeway in post-war future San Francisco. Low fast camera, strong road perspective, a clear drop to the lower city on one side, sparks and debris near the broken guardrail, magenta signal lights reflecting across wet asphalt, the enemy car still visible ahead but under pressure. The frame feels controlled, decisive, and thrilling. Photorealistic premium action film composition, grounded sci-fi, 16:9.
```

### SB-C2-01: Damaged Pursuit Result Frame

Purpose:

```text
Costly success branch visual target.
```

Still prompt:

```text
A cinematic storyboard still from a damaged pursuit car during a rain-soaked chase on a broken elevated route in post-war future San Francisco. The windshield edge is cracked, sparks scrape from the hood and damaged guardrail, the camera is unstable but readable, the armored enemy vehicle remains ahead through smoke and rain. Wet asphalt reflects magenta emergency signals, layered roads and damaged buildings fall away below the freeway, debris surrounds the chase. Photorealistic grounded sci-fi, costly victory mood, premium film frame, 16:9.
```

### SB-C3-01: Lost Trail Result Frame

Purpose:

```text
Failure branch visual target.
```

Still prompt:

```text
A tragic cinematic storyboard still of a damaged San Francisco elevated interchange after the enemy vehicle has disappeared into smoke below and ahead. Rain and ash drift through restrained magenta reflections on wet asphalt. Broken guardrails, abandoned damaged cars, a dangerous drop toward the lower city, distant fire, damaged buildings, and an empty route ahead create the sense of arriving too late. Photorealistic grounded sci-fi noir, regret, delay, premium film composition, 16:9.
```

## After A Still Is Approved

1. Save the approved still into `source/storyboard/approved/`.
2. Copy it to `D:\AI\SULPHUR2_ComfyUI\ComfyUI\input`.
3. Open `A0-S01_I2V_可上传首帧图.json`.
4. In the `Load Image` node, choose the approved still.
5. Only then run I2V video generation.

## Decision Rule

If a still frame does not pass, do not generate video from it. Fix the still first.
