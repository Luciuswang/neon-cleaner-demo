# Next Step: Generate Storyboard Stills

Do this before generating any video.

## Step 1: Generate These Still Frames

Use the prompts from:

```text
docs/video/topview-storyboard-stills-first.md
```

Or print one prompt at a time:

```powershell
node tools/comfy/print_storyboard_still_prompt.mjs SB-A0-01
node tools/comfy/print_storyboard_still_prompt.mjs SB-A0-02
node tools/comfy/print_storyboard_still_prompt.mjs SB-A0-03
node tools/comfy/print_storyboard_still_prompt.mjs SB-I1-01
```

## Step 2: Save Drafts

Save all candidate images here:

```text
source/storyboard/drafts/
```

## Step 3: Approve Frames

Move only approved images here:

```text
source/storyboard/approved/
```

Suggested approved filenames:

```text
SB-A0-01_establishing_world.png
SB-A0-02_linxia_overlook.png
SB-A0-03_enemy_convoy.png
SB-I1-01_playable_handoff.png
```

## Step 4: Only Then Use ComfyUI Video

After a still is approved, copy it to:

```text
D:\AI\SULPHUR2_ComfyUI\ComfyUI\input
```

Then open:

```text
C:\Users\Administrator\Desktop\ComfyUI工作流\A0-S01_I2V_可上传首帧图.json
```

Choose the approved image in the `Load Image` node and generate video.

## Acceptance Rules

Do not make video from a weak still frame.

A still frame passes only if:

- It looks like a cinematic film frame.
- The world is clearly post-war future San Francisco.
- The road/camera direction can connect to gameplay.
- Vehicles and heroine identity are readable.
- There is no text, watermark, UI, or toy-like style.
