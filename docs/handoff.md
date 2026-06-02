# Project Handoff

Last updated: 2026-06-03

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

1. Replace the placeholder interactive panels with more cinematic UI.
2. Add more generated video clips for the branch outcomes.
3. Improve mobile touch controls.
4. Add a visual progress/score feedback layer during chase and boss segments.
5. Add a short asset pipeline note for future AI video clips.

## Important files

```text
README.md
docs/story-bible.md
docs/branch-map.md
docs/ai-shot-list.md
docs/handoff.md
web/index.html
web/styles.css
web/script.js
web/assets/neon-cleaner-bg-noaudio.mp4
web/assets/neon-cleaner-keyframe.png
```

