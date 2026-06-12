# A0-S01 战后旧金山远景：Topview 9 张关键帧 / Banana 生成提示词

用途：为同一个开场镜头生成 9 张连续关键帧，不是 9 个剧情镜头。目标是让 Topview 之后根据这些图生成一个稳定的 6-8 秒电影镜头：从战后旧金山宏观世界观，缓慢压向即将发生追逐的高架路线。

## 统一风格锁定

每张图都尽量保留这些元素，保证进入 Topview 后色调和地理关系稳定：

```text
post-war future San Francisco, 2037, Golden Gate Bridge in the far background, layered elevated freeways, broken ramps, wet asphalt, heavy thunderstorm clouds, cold blue-gray color palette, low saturation, cinematic rain, drifting smoke, distant fires, lightning inside dark clouds, far battle flashes between carbon-based human forces and silicon-based machine forces, grounded live-action sci-fi war film, anamorphic lens, realistic scale, high-end film still, no main character, no text, no watermark
```

统一负面词：

```text
cartoon, anime, game screenshot, HUD, text, watermark, logo, over-saturated neon, sunny sky, clean city, empty sky, toy city, melted buildings, distorted Golden Gate Bridge, warped freeway, floating roads, fisheye, drone vlog, handheld shake, giant foreground explosion, fantasy spaceship, cyberpunk city advertisement
```

## Keyframe 01：世界观开场 / 最高最远

```text
Ultra wide half-aerial establishing shot of post-war future San Francisco in 2037 after heavy rain. The camera is high above the city, looking across layered elevated freeways toward the Golden Gate Bridge in the far background. Dense black thunderstorm clouds cover almost the entire sky, with subtle lightning glowing inside the cloud bank. Smoke columns rise from several districts, tiny orange fires burn far away, and distant tracer flashes suggest a war between carbon-based human forces and silicon-based machine forces. Cold blue-gray palette, wet asphalt reflections, grounded live-action sci-fi war film, cinematic, realistic scale, no main character.
```

## Keyframe 02：镜头开始前推 / 高架进入主体

```text
Same post-war future San Francisco location and color palette. The camera has moved slightly lower and forward, bringing the elevated freeway network into stronger foreground presence. Broken ramps and wet concrete lanes form leading lines toward the Golden Gate Bridge. Rain haze softens the skyline, black clouds hang low and heavy, lightning faintly lights the bay. Distant fires and smoke remain visible, with tiny far-background machine drone lights and human defense fire. Big-budget live-action sci-fi war film still, cold blue-gray, low saturation, no character.
```

## Keyframe 03：闪电照亮桥与云层 / 战争规模扩大

```text
Same continuous shot, camera still slowly pushing forward over the damaged elevated freeway. A bright fork of lightning illuminates the storm clouds behind the Golden Gate Bridge, briefly revealing damaged bridge silhouettes, smoke over the bay, and distant aerial combat sparks. The wet freeway surfaces catch a pale silver-blue flash. The city remains wounded and realistic, with small orange explosions far in the background, not in the foreground. Cinematic rain, anamorphic lens, grounded live-action sci-fi war atmosphere.
```

## Keyframe 04：镜头下压 / 断裂高架更近

```text
Same location, camera now descends toward the elevated chase corridor. A broken freeway edge and cracked guardrails become visible in the foreground, with rainwater pooling on the concrete. Below the elevated road, dark city streets fall away into fog and smoke. The Golden Gate Bridge remains in the far background as a geographic anchor. Heavy clouds, distant lightning, cold blue-gray color, restrained orange fire points, wet reflections, realistic scale, no hero yet.
```

## Keyframe 05：前景掠过废车与弹痕 / 增加速度感

```text
Same continuous cinematic push-in. The foreground now includes abandoned burned vehicles, scattered road debris, shell marks, cracked lane lines, and rainwater reflecting the storm sky. The elevated freeway feels dangerous and usable as a chase route. Smoke drifts sideways across the road, and tiny machine drone lights move far above the skyline. The city remains cold blue-gray with only restrained orange fire and occasional magenta emergency glows. High-end live-action sci-fi war film still, no text.
```

## Keyframe 06：远处硅基机群与人类火线 / 交代战争双方

```text
Same post-war San Francisco elevated freeway shot, slightly closer and lower. In the far distance over the bay and skyline, small silhouettes of silicon-machine drones and angular aircraft exchange fire with human defensive positions. Keep them tiny and atmospheric, not dominating the frame. The main visual remains the wounded city and the elevated route. Dense clouds, lightning haze, drifting smoke, wet asphalt, cold blue-gray cinematic palette, grounded realism.
```

## Keyframe 07：镜头锁定追逐路线 / 高架走廊清晰

```text
Same shot, camera has settled lower over the main elevated freeway corridor. The chase route is now clearly readable: a long wet road leading forward, broken guardrails on one side, lower city dropping away, road debris and shallow puddles. The Golden Gate Bridge and damaged skyline remain behind rain haze. Distant war flashes continue, but the composition now guides the eye toward the road where an armored convoy will soon appear. Cinematic live-action sci-fi thriller, cold blue-gray, realistic wet concrete.
```

## Keyframe 08：远处爆炸和烟雾遮挡 / 转入下一镜的动机

```text
Same elevated freeway corridor, closer and more dramatic. A distant explosion blooms far ahead on the route, partly hidden by smoke and rain haze, casting a brief warm orange reflection across the wet road. Do not make it a huge foreground explosion; it should reveal danger and motivate the next shot. Storm clouds churn overhead, lightning outlines the Golden Gate Bridge in the background, smoke rolls across the road, cold blue-gray palette with restrained warm highlights, grounded cinematic realism.
```

## Keyframe 09：落到可接装甲车队的视角 / 镜头末帧

```text
Final keyframe of the same opening shot. The camera is now low and aligned with the damaged elevated freeway corridor, as if ready to reveal the enemy armored convoy in the next shot. Wet lane lines lead into smoke, broken guardrails frame the road, rain falls heavily, and distant fires glow through haze. The skyline and Golden Gate Bridge remain faint in the background. The image should feel like the last frame before a black armored convoy enters from the smoke. Big-budget live-action sci-fi war film, cold blue-gray, low saturation, cinematic rain, no character, no text.
```

## 建议生成方式

1. 先用同一个画幅生成，建议 `16:9`。
2. 每张都使用统一风格锁定和统一负面词。
3. 如果 Banana 支持参考图，从第 2 张开始把上一张作为参考，保持城市结构和高架方向连续。
4. 第 1、3、7、9 张最关键，优先挑好；其他帧可以作为运动过渡补充。
