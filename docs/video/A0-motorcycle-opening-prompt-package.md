# A0 Motorcycle Opening Prompt Package

这个版本用于新林夏设定：她不再坐进追击车，而是骑战术电动摩托进入高架追逐。优先给可灵 AI 做 `I2V`；本地 Sulphur2 / LTX-2.3 可用同一套内容，但建议拆成更短镜头。

角色参考：

```text
web/assets/女主.png
```

核心连续性：

```text
Lin Xia is an East Asian female motorcycle rider in her early 20s, slim athletic build, short wild asymmetrical black hair with magenta and cyan streaks, sharp tired eyes, freckles, cyberpunk visor or tactical goggles, cropped black leather riding jacket, black cropped top, tactical leather riding pants, gloves, riding boots, street-cool rebellious style, grounded human realism. She is not a fashion model; she is exhausted, angry, precise, and carrying the last hope of carbon-based human life.
```

全局负面词：

```text
anime, cartoon, idol pose, fashion ad, sexualized framing, cheap cyberpunk, plastic leather, cross-eyed, distorted face, extra limbs, bad hands, warped motorcycle, floating wheels, toy vehicle, hover bike, unreadable action, game HUD, subtitles, text, watermark, logo, overprocessed HDR, fisheye, shaky drone vlog, melted buildings, distorted Golden Gate Bridge
```

---

## A0-S01 战后旧金山世界建立

### Shot Goal

先建立世界观：战后旧金山、断裂高架、远处碳基生命与硅基生命战争。镜头末端把视线收向即将发生追逐的高架路线。

### Kling / I2V Master Prompt

```text
Use the uploaded still as a strict composition and geography reference. Keep the Golden Gate Bridge silhouette, post-war San Francisco skyline, layered elevated freeway system, broken ramps, wet streets, smoke columns, and horizon line stable.

Premium cinematic opening shot of post-war future San Francisco in 2037 after heavy rain. Dense thunderstorm clouds cover the sky, lightning pulses inside the cloud bank, smoke columns rise from distant districts, and tiny far-background combat flashes show the ongoing war between carbon-based human forces and silicon-based machine forces. Wet freeway concrete and soaked asphalt reflect cold blue-gray storm light with restrained magenta emergency glows.

The subject is the wounded city and the elevated chase corridor. No main character yet. The image must feel like a big-budget live-action sci-fi war film, grounded, photographic, atmospheric, expensive, not concept art and not game footage.
```

### Motion Prompt

```text
6 seconds. Begin with a heavy cinematic hold, then a very slow forward push and slight downward descent toward the broken elevated freeway corridor. Architecture remains rigid and stable. Motion comes from rolling storm clouds, rain haze, drifting smoke, subtle wet-surface shimmer, distant lightning pulses, tiny tracer fire and small far explosions. End on a lightning flash or distant battle flare that motivates the next shot.
```

### Negative Prompt

```text
warped bridge, melting freeway, unstable skyline, large foreground explosion, close aircraft flyby, drone vlog movement, handheld shake, cheap CG, toy city, empty sky, flat clouds, game screenshot, HUD, text, watermark
```

---

## A0-S02 林夏与摩托出场

### Shot Goal

让新林夏以摩托车手身份出现。不是美颜展示，而是“人类侧最后还在反击的人”。

### Kling / I2V Master Prompt

```text
Use the uploaded Lin Xia reference image as a strict identity anchor. Lin Xia is an East Asian female motorcycle rider in her early 20s, slim athletic build, short wild asymmetrical black hair with magenta and cyan streaks, sharp tired eyes, freckles, cyberpunk visor or tactical goggles, cropped black leather riding jacket, black cropped top, tactical leather riding pants, gloves, riding boots, street-cool rebellious style, grounded human realism.

Lin Xia stands beside or leans against a black electric combat motorcycle on a shattered elevated overpass above post-war future San Francisco. The same damaged freeway corridor from the previous shot is visible below. The city is soaked by rain, smoke rises from lower streets, distant lightning and far combat flashes reveal the scale of the war. The motorcycle is low, aggressive, grounded on real wheels, wet black metal and carbon panels, subtle magenta energy strips, no hover bike.

Her body language is restrained and focused: tired, angry, alert, ready to move. Do not make her pose like an idol or fashion model. She is listening to an AI warning, watching the enemy route below, and preparing to ride.
```

### Motion Prompt

```text
5 seconds. Start in a rear or three-quarter rear medium-wide shot: Lin Xia and the motorcycle are silhouettes against the wounded city. Slow lateral drift and gentle push-in. Wind moves her short hair, jacket hem, rain beads on the motorcycle, smoke drifts behind her. Near the end, she turns her head slightly toward the elevated route below, one gloved hand reaching toward the handlebar.
```

### Negative Prompt

```text
beauty close-up first, smiling, fashion pose, oversexualized framing, anime heroine, soft idol lighting, wrong long ponytail, tribal jewelry, floating motorcycle, bad wheel contact, plastic bike, exposed fantasy armor, text, watermark
```

---

## A0-S03 敌方装甲车队进入高架

### Shot Goal

明确追逐目标：黑色装甲车队押送证人，进入高架路线。给后面的摩托追击一个清晰目标。

### Kling / I2V Master Prompt

```text
Premium live-action sci-fi action thriller target reveal. A black armored convoy enters a damaged elevated freeway ramp in post-war future San Francisco after rain. The convoy carries a witness and is escorted by hostile silicon-machine security drones. Vehicles are heavy, grounded, dirty, militarized, with real tires, wet armor panels, cyan headlights, restrained magenta security lights, damaged metal, readable silhouettes.

The route is dangerous: cracked elevated concrete, broken guardrails, lower city falling away on one side, road debris, steam, rain haze, smoke, distant firefights. This is the enemy target Lin Xia will chase on her motorcycle. Keep physical scale believable and grounded.
```

### Motion Prompt

```text
5 seconds. Low hidden observer angle from behind broken concrete. The convoy moves left to right or away from camera, committing to the elevated route. Camera makes a slight rise or forward track as the target becomes readable. Wheel spray, wet reflections, smoke drift, drone lights, and small tracer streaks add motion. End with the armored lead vehicle fully aligned on the chase corridor.
```

### Negative Prompt

```text
toy cars, hovercars, shape-changing vehicles, bad wheel contact, oversized sci-fi guns, unreadable convoy, generic freeway, no San Francisco height difference, foreground explosion hiding the target, cartoon, HUD, text, watermark
```

---

## A0-S04 林夏点火追击 / 切入接管

### Shot Goal

这是进入交互的启动镜头。林夏跨上摩托，发动，冲向高架追逐路线；用爆炸、车灯闪白、雨水飞溅作为切入 3D 接管的遮罩。

### Kling / I2V Master Prompt

```text
Use the uploaded Lin Xia reference image as a strict identity anchor. Lin Xia is now a street-cool cyberpunk motorcycle rider: short wild asymmetrical black hair with magenta and cyan streaks, cropped black leather riding jacket, black cropped top, tactical black leather riding pants, gloves, riding boots, cyberpunk visor or goggles, realistic East Asian face, sharp tired eyes, grounded human realism.

On a rain-soaked shattered elevated overpass in post-war future San Francisco, Lin Xia swings onto a black electric combat motorcycle and starts the pursuit. The motorcycle wakes with restrained magenta energy strips, wet black carbon panels, real tires gripping slick concrete. Ahead, the hostile armored convoy disappears into smoke and lightning. Distant war flashes continue across the skyline.

The mood is urgent and cinematic: this is the exact moment the viewer wants to take control. No UI, no game HUD, no text. The shot must feel like a high-end live-action sci-fi action film, realistic rain, wet reflections, practical lights, controlled bloom, anamorphic lens, film grain.
```

### Motion Prompt

```text
6 seconds. Begin close behind Lin Xia at motorcycle height. She mounts the bike, the magenta power strip wakes, rear tire sprays water, the bike lurches forward. Camera follows low behind and slightly to the side, then drops closer toward a first-person chase alignment. The enemy convoy is visible ahead through rain and smoke. In the final second, a near-miss explosion or lightning-white flare blooms across frame, creating a natural transition point into 3D gameplay control.
```

### Negative Prompt

```text
car cockpit, steering wheel, sitting inside car, hover bike, floating wheels, impossible body movement, fashion entrance, oversexualized camera, exposed glamour pose, bad face, bad hands, extra limbs, unreadable action, game UI, subtitles, text, watermark, logo
```

---

## 可灵推荐生成顺序

1. `A0-S01` 用世界静帧做 I2V，先出 2 版。
2. `A0-S02` 用林夏参考图 + T2V/I2V，先出 3 版，筛角色是否稳定。
3. `A0-S03` T2V 先出 2-3 版，筛装甲车队是否可读。
4. `A0-S04` 用林夏参考图 + 摩托静帧或 T2V，重点筛“点火、冲出、爆炸切接管”是否成立。

## 本地模型建议

本地 Sulphur2 / LTX-2.3 更适合先做短镜头：

```text
3-5 秒，低幅度运动，强首帧约束，避免大幅人物动作变形。
```

优先本地跑：

```text
A0-S01 世界大远景
A0-S03 装甲车队
```

林夏上车和高速追击建议先用可灵，等拿到好首帧后再回本地模型做补镜或变体。
