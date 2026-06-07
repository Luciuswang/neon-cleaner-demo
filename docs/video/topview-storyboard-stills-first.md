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
post-war future San Francisco, wet asphalt after rain, damaged downtown buildings, broken Golden Gate Bridge in the distance, drifting smoke, cold blue-gray atmosphere, restrained magenta emergency signal lights, cinematic sci-fi action thriller, grounded realism, premium film frame, natural reflections, no readable text
```

## Global Negative Prompt

```text
cartoon, anime, illustration, comic style, toy car, low poly, game screenshot, HUD, UI text, subtitles, watermark, logo, readable text, plastic materials, fantasy armor, fashion ad, idol pose, overclean city, no war damage, flat lighting, blurry, low detail, distorted buildings, warped road, duplicated vehicles, melted car, wrong scale, floating objects, overexposed white sky
```

## Stills To Generate First

### SB-A0-01: Establishing World Frame

Purpose:

```text
Prove the world: post-war San Francisco is cinematic, damaged, wet, and large-scale.
```

Still prompt:

```text
A premium cinematic storyboard still of post-war future San Francisco after rain, wide establishing frame from a slightly elevated street overlook. Broken Golden Gate Bridge structures are visible in the misty distance, damaged downtown towers rise on both sides, cracked elevated tracks and road scars cut through the scene, smoke columns drift behind buildings, ruined drones and abandoned vehicles sit near the roadside. Wet asphalt reflects cold blue-gray sky and restrained magenta emergency signal lights. No characters. Photorealistic, grounded sci-fi war drama, expensive film composition, strong depth, natural rain reflections, atmospheric perspective, 16:9.
```

Approval check:

```text
The frame must immediately read as San Francisco after a large conflict. It must have a road corridor that can later become the chase route.
```

### SB-A0-02: Lin Xia Overlook Frame

Purpose:

```text
Prove heroine identity and emotional tone before action begins.
```

Still prompt:

```text
A premium cinematic storyboard still of Lin Xia standing on a rooftop edge or shattered overpass above post-war future San Francisco after rain. She is an East Asian woman in her early 20s, slim athletic build, pale skin, black ponytail with loose front strands, sharp tired eyes, long black tactical leather coat with magenta inner lining and subtle magenta glowing strips near the hem, fitted black combat clothing, gloves, utility belt, black boots. She looks over the wounded city with grief, pressure, endurance, and a faint thread of hope. The damaged city is large behind her: wet streets, smoke, broken infrastructure, restrained magenta emergency lights, cold mist. Photorealistic, grounded sci-fi, premium film frame, no fashion pose, 16:9.
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
A cinematic storyboard still of an armored black hostile vehicle cutting through a damaged rain-soaked future San Francisco street. The camera is low and behind cover, looking toward the vehicle as it moves through mist. Wet asphalt reflects magenta emergency signal lights, broken lane markings, abandoned damaged cars, cracked road, smoke and sparks near the roadside. The vehicle has a heavy reinforced silhouette, dirty wet panels, damaged tail lights, realistic scale, no toy look. Photorealistic grounded sci-fi pursuit setup, premium action-thriller frame, 16:9.
```

Approval check:

```text
The enemy vehicle must be readable and consistent enough to become the chase target.
```

### SB-I1-01: Chase Handoff Frame

Purpose:

```text
Create the exact frame that can become the first playable driving view.
```

Still prompt:

```text
A first-person hood-level cinematic storyboard still from inside or just above a damaged futuristic pursuit car, driving through a post-war future San Francisco street after rain. The car hood and windshield edge are barely visible at the bottom of frame, low and cinematic, not blocking the road. Ahead, an armored black hostile vehicle is visible in the same lane through mist and rain. Wet asphalt, road scars, debris, damaged buildings, broken Golden Gate Bridge in the distance, restrained magenta emergency lights reflecting on puddles and car paint. Photorealistic, grounded, intense but readable driving takeover frame, 16:9.
```

Approval check:

```text
This frame must look playable. The road direction, camera height, and enemy car position must be usable in the web driving scene.
```

### SB-C1-01: Clean Pursuit Result Frame

Purpose:

```text
Winning branch visual target.
```

Still prompt:

```text
A cinematic storyboard still of Lin Xia's pursuit vehicle cleanly outmaneuvering the hostile armored car through a rain-soaked damaged future San Francisco street. Low fast camera, strong road perspective, sparks and debris near the road edge, magenta signal lights reflecting across wet asphalt, the enemy car still visible ahead but under pressure. The frame feels controlled, decisive, and thrilling. Photorealistic premium action film composition, grounded sci-fi, 16:9.
```

### SB-C2-01: Damaged Pursuit Result Frame

Purpose:

```text
Costly success branch visual target.
```

Still prompt:

```text
A cinematic storyboard still from a damaged pursuit car during a rain-soaked chase in post-war future San Francisco. The windshield edge is cracked, sparks scrape from the hood, the camera is unstable but readable, the armored enemy vehicle remains ahead through smoke and rain. Wet asphalt reflects magenta emergency signals, damaged buildings and road debris surround the chase. Photorealistic grounded sci-fi, costly victory mood, premium film frame, 16:9.
```

### SB-C3-01: Lost Trail Result Frame

Purpose:

```text
Failure branch visual target.
```

Still prompt:

```text
A tragic cinematic storyboard still of a damaged San Francisco intersection after the enemy vehicle has disappeared into smoke. Rain and ash drift through restrained magenta reflections on wet asphalt. Broken road barriers, abandoned cars, distant fire, damaged buildings, empty road ahead, the sense of arriving too late. Photorealistic grounded sci-fi noir, regret, delay, premium film composition, 16:9.
```

## After A Still Is Approved

1. Save the approved still into `source/storyboard/approved/`.
2. Copy it to `D:\AI\SULPHUR2_ComfyUI\ComfyUI\input`.
3. Open `A0-S01_I2V_可上传首帧图.json`.
4. In the `Load Image` node, choose the approved still.
5. Only then run I2V video generation.

## Decision Rule

If a still frame does not pass, do not generate video from it. Fix the still first.
