# SB-A0-01 Cinematic Variants

用途：当 `SB-A0-01` 仍然显得像普通概念图，而不是电影镜头时，直接改用下面这些更明确的变体 prompt。

建议每版各出 `2-3` 张，再筛选。

## Global Upgrade Add-on

把这段加在任何 `SB-A0-01` prompt 末尾：

```text
Live-action film still, high-end VFX plate realism, strong foreground-midground-background separation, volumetric haze, realistic wet asphalt specular, subtle lens halation around practical lights, premium anamorphic lens rendering, controlled bloom, natural lens compression, expensive atmospheric depth, grounded physical materials, not generic concept art.
```

## Negative Booster

把这段加在负面词末尾：

```text
generic concept art, sterile CG, weak atmosphere, overprocessed HDR, muddy composition, empty sky, no foreground depth, no volumetric haze, theme-park future city, bland freeway, concept painting look, cheap sci-fi matte painting
```

## Variant A: VFX Plate Realism

用途：

```text
优先拉高“像真实电影画面”的感觉，减少概念图味。
```

Prompt:

```text
A premium live-action cinematic storyboard still of post-war future San Francisco after rain. Wide establishing shot from a slightly elevated overlook. A damaged elevated freeway and broken chase ramp cross above lower wet city streets, creating a strong layered high-road and low-road read. Broken Golden Gate Bridge structures fade into mist in the distance, damaged downtown towers rise through smoke columns, ruined drones and abandoned vehicles sit near the roadside below. Wet asphalt reflects a cold blue-gray sky and restrained magenta emergency signal lights. The frame should feel like a real big-budget sci-fi war film plate: high-end VFX realism, strong foreground-midground-background separation, volumetric haze, subtle lens halation, controlled bloom, grounded physical materials, realistic rain reflections, atmospheric depth, no characters, 16:9.
```

Best for:

```text
想让画面先脱离“普通 AI 概念图”时优先使用。
```

## Variant B: San Francisco Landmark Identity

用途：

```text
优先强化“这就是旧金山”，避免变成泛用未来城市。
```

Prompt:

```text
A premium cinematic storyboard still of post-war future San Francisco after rain, clearly recognizable as San Francisco. A damaged elevated freeway and broken chase ramp cut across a steep layered city, with visible height difference between upper routes and lower streets. Broken Golden Gate Bridge structures are clearly visible in the misty distance, the city rises in hills, damaged towers and fractured transit lines follow the terrain, smoke columns drift between districts, wet asphalt reflects cold sky and restrained magenta emergency lights. No characters. Photorealistic, grounded sci-fi war drama, expensive film composition, atmospheric perspective, volumetric haze, premium anamorphic rendering, realistic materials, 16:9.
```

Best for:

```text
当前画面世界观成立，但旧金山辨识度还不够时使用。
```

## Variant C: Chase Corridor Priority

用途：

```text
优先强化“这条路就是后面要接管追车的路”。
```

Prompt:

```text
A premium cinematic storyboard still of post-war future San Francisco after rain, designed specifically as a chase-establishing frame. The camera looks over a damaged elevated freeway corridor and broken ramp that clearly define the future pursuit route above lower city streets. The high-road versus low-road read must be immediate. Broken Golden Gate Bridge structures and damaged towers sit in the distance through smoke and mist, but the main focus is the elevated chase lane, cracked concrete, damaged guardrails, road scars, wet reflective asphalt, and dramatic route continuity into the city. No characters. Photorealistic, grounded sci-fi action thriller, premium live-action film still, realistic wet reflections, volumetric haze, subtle lens halation, strong depth, 16:9.
```

Best for:

```text
需要让这张图更容易接 `SB-I1-01` gameplay handoff 时使用。
```

## Recommended Order

1. 先跑 `Variant A`
2. 如果像“真实电影画面”了，但城市辨识度一般，再跑 `Variant B`
3. 如果城市没问题，但后续不容易接追车玩法，再跑 `Variant C`
