# Project Handoff

Last updated: 2026-06-08

## Repo and live demo

- GitHub repo: https://github.com/Luciuswang/neon-cleaner-demo
- Live mobile test URL: https://luciuswang.github.io/neon-cleaner-demo/
- Main branch: `main`
- GitHub Pages source: `main` branch, `/ (root)`

## Current status

This repo contains the first playable prototype for `霓虹清道夫 / Neon Cleaner`.

The demo is an interactive film/game hybrid:

- A cinematic video-style background.
- A story opening node.
- A playable car-chase decision segment.
- Branching outcomes based on player performance.
- A boss-interrupt segment.
- Three ending paths.

The current web build uses the silent AI video background here:

```text
web/assets/neon-cleaner-bg-noaudio.mp4
```

The original local source video with audio is intentionally not committed:

```text
source/video/*.mp4
```

## How to continue at the company

Clone the repo:

```powershell
git clone https://github.com/Luciuswang/neon-cleaner-demo.git
cd neon-cleaner-demo
```

Open locally:

```powershell
cd web
python -m http.server 5177
```

Then open:

```text
http://127.0.0.1:5177/
```

If Python is not available, opening `web/index.html` directly also works for basic testing.

## Suggested prompt for continuing with Codex

Use this when starting a new Codex session:

```text
请阅读这个仓库的 README.md 和 docs/handoff.md。我们正在做一个名为“霓虹清道夫 / Neon Cleaner”的互动电影游戏 demo。请先理解当前结构、玩法分支、GitHub Pages 部署状态，然后继续开发下一版。
```

## Good next steps

1. Generate and approve storyboard still frames before making video.
2. Start with `SB-A0-01`, `SB-A0-02`, `SB-A0-03`, and `SB-I1-01`.
3. Use approved still frames as first frames for Sulphur2/LTX-2.3 I2V.
4. Improve the playable handoff only after `SB-I1-01` is visually approved.
5. Add generated branch clips for `C1`, `C2`, and `C3` after the visual language is locked.

## Stills-first storyboard workflow

The current production rule is:

```text
script beat -> storyboard still -> approval -> image-to-video -> game handoff
```

Do not start by running the video workflow. First generate and approve still frames.

Primary docs:

```text
docs/weekly-progress-2026-06-08.md
web/reports/weekly-progress-2026-06-08.html
docs/video/storyboard-stills-operation-guide.md
docs/video/topview-storyboard-stills-first.md
docs/video/topview-storyboard-stills.json
docs/video/next-step-storyboard-stills.md
docs/daily-summary-2026-06-08.md
```

Print the first still-frame prompt:

```powershell
node tools/comfy/print_storyboard_still_prompt.mjs SB-A0-01
```

Candidate stills go here:

```text
source/storyboard/drafts/
```

Approved stills go here:

```text
source/storyboard/approved/
```

## Local ComfyUI storyboard pipeline

Use this only after the still-frame phase is approved:

```text
docs/video/topview-local-comfyui-storyboard-template.md
docs/video/topview-local-comfyui-storyboard.json
```

Print a shot prompt for ComfyUI:

```powershell
node tools/comfy/print_storyboard_prompt.mjs A0-S02
```

Build a shot-specific ComfyUI workflow:

```powershell
node tools/comfy/build_storyboard_t2v_workflow.mjs A0-S02 --root D:\AI\SULPHUR2_ComfyUI
```

The current local Sulphur2/LTX-2.3 workflow entry is:

```text
D:\AI\SULPHUR2_ComfyUI\ComfyUI\user\default\workflows\00_OPEN_THIS_CAR_CHASE_T2V.json
```

ComfyUI local server:

```text
http://127.0.0.1:8190
```

## Important files

```text
README.md
docs/story-bible.md
docs/branch-map.md
docs/ai-shot-list.md
docs/handoff.md
docs/weekly-progress-2026-06-08.md
docs/daily-summary-2026-06-08.md
docs/video/storyboard-stills-operation-guide.md
docs/video/topview-storyboard-stills-first.md
docs/video/topview-storyboard-stills.json
docs/video/next-step-storyboard-stills.md
docs/video/topview-local-comfyui-storyboard-template.md
docs/video/topview-local-comfyui-storyboard.json
tools/comfy/print_storyboard_still_prompt.mjs
tools/comfy/print_storyboard_prompt.mjs
tools/comfy/build_storyboard_t2v_workflow.mjs
web/reports/weekly-progress-2026-06-08.html
web/index.html
web/styles.css
web/script.js
web/assets/neon-cleaner-bg-noaudio.mp4
web/assets/neon-cleaner-keyframe.png
```
