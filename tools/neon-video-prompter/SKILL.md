---
name: neon-video-prompter
description: Build or revise AI video prompts, shot scripts, and continuity packages for the Neon Cleaner project. Use when Codex needs to turn story beats into model-ready prompts, preserve heroine identity from the local reference image, or let the user tweak visual style with plain-language notes such as mood, lens, rain, lighting, motion, and performance adjustments.
---

# Neon Video Prompter

Use this skill for `Neon Cleaner` video prompt work.

## Workflow

1. Read the project story files only as needed:
   - `docs/story-bible.md` for tone and world.
   - `docs/ai-shot-list.md` for shot intent.
   - `docs/video/*.md` for scene-specific prompt packs.
2. Treat `web/assets/女主.png` as the heroine identity lock unless the user explicitly replaces it.
3. Generate prompts with the bundled script instead of rewriting long prompt blocks by hand.
4. When the user asks for a visual change in natural language, map it into these control buckets:
   - `Look`: color, contrast, fog, lens, polish, atmosphere.
   - `Motion`: camera movement, pacing, shake, impact.
   - `Performance`: expression, posture, intensity, fatigue.
   - `Environment`: rain, street density, practical lights, reflections.
5. Keep outputs grounded and cinematic. Avoid pushing the project into anime, over-designed cyberpunk, or generic sci-fi clutter.

## Useful Files

- Scene pack: `docs/video/A0-rain-signal-script.md`
- Shot library: `references/shot-library.json`
- Prompt builder: `scripts/build_video_prompt.ps1`

## Command

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\neon-video-prompter\scripts\build_video_prompt.ps1 -RepoRoot E:\codex_project\neon-cleaner-demo -ShotId A0 -Look "更冷，更压抑，雾更重" -Motion "镜头更克制，最后轻微推进" -Performance "林夏更疲惫，但更专注"
```

## Output Rules

- Always keep the heroine continuity block unless the user explicitly asks to redesign her.
- Output a full package:
  - shot goal
  - master prompt
  - motion prompt
  - negative prompt
  - continuity rules
  - merged tweak notes
- If the user's request is vague, prefer small deltas over rewriting the whole scene grammar.
