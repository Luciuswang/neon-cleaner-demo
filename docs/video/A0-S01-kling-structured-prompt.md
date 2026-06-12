# A0-S01 Kling Structured Prompt

适用镜头：

```text
A0-S01 开场世界建立镜头
```

适用参考图：

```text
source/storyboard/approved/SB-A0-01_establishing_world.png
```

## 中文结构化描述

```text
〖基础设定〗
时间是 2037 年近未来。地点是战后旧金山，暴雨刚停，下一轮风暴正在压下来。世界已经被长期战争撕裂，碳基生命与硅基生命的冲突仍在远处持续。主体不是人物，而是这座仍在流血的城市本身。必须严格沿用上传参考图的城市天际线、金门桥轮廓、高架桥层级、断裂匝道、街道走向和地平线关系。

〖氛围画质〗
整体是顶级电影开场空镜，不是概念海报，不是 VFX 特效演示。画面要有真实电影摄影的厚重感，像大制作真人科幻战争片里的稳定航拍建立镜头。冷蓝灰暴雨色调，局部保留克制的洋红警示光。天空必须乌云密布，云层厚重翻卷，远处云团内部偶尔有闪电。空气里有雨雾、烟柱、战火余烬，湿透的高架和街道要有真实反光与材质层次。强调体积雾、空气透视、镜头轻微光晕、受控 bloom、真实混凝土和湿沥青的表面行为。

〖画面内容〗
总时长 6 秒。这是一个半鸟瞰大远景，构图里必须一眼读出旧金山高低落差和高架追逐走廊。镜头先短暂停顿，再非常缓慢地向前推进并轻微下降，整体重、稳、贵，像稳定直升机或高端电影航拍板，不要像无人机 vlog。画面内的动态主要来自云层缓慢滚动、远处闪电、烟柱飘移、路面积水反光微变、极远处碳基与硅基部队交火时微小但可读的火光和曳光。不要让近景爆炸抢戏。镜头最后一秒让断裂高架和主追逐路线比城市天际线更重要，为下一镜切到林夏站在同一路线高处做准备。

〖情绪目标〗
观众第一感受应该是：这个世界快输了，但还没有彻底失去希望。既要有战后悲凉感，也要有大战仍未结束的压迫感，同时为林夏出场埋下“人类侧仍在反击”的情绪基础。

〖结尾切点〗
最佳切法是闪电瞬间或远处战火一闪时切到 A0-S02 林夏出场。

〖反向限制〗
不要建筑变形，不要桥体弯曲，不要高架融化，不要镜头乱晃，不要突然推拉摇移，不要前景飞满飞机，不要巨大爆炸遮挡主体，不要塑料 CG，不要游戏截图感，不要海报感，不要低细节云层，不要动漫感，不要文字水印，不要 HUD。
```

## Kling English Prompt

```text
Use the uploaded still as a strict composition and geography reference. Keep the exact skyline layout, Golden Gate Bridge silhouette, elevated freeway stacking, broken ramp shape, street alignment, city height difference, and horizon line stable.

This is a premium cinematic opening establishing shot of post-war future San Francisco in 2037, just after heavy rain, with another storm front pressing in. The world has been damaged by an ongoing war, and far in the distance the conflict between carbon-based human forces and silicon-based machine forces is still active. The subject of the shot is the wounded city itself, not a character.

The image must feel like a big-budget live-action science-fiction war film opening plate, not concept art, not a VFX demo, not a game cinematic. Use a cold blue-gray storm palette with restrained magenta emergency practicals. The sky is dense with layered storm clouds, heavy thunderheads, distant lightning inside the cloud bank, drifting smoke columns, rain haze, and faint battlefield residue. Wet freeway concrete and soaked asphalt should show realistic reflections, grounded material response, volumetric haze, atmospheric depth, subtle lens halation, controlled bloom, and premium anamorphic film rendering.

Duration is 6 seconds. Begin with a brief hold, then perform a very slow forward push with a slight downward descent. The camera must feel heavy, stable, and expensive, like a stabilized helicopter or high-end aerial plate, never like a drone vlog. Internal motion comes mainly from slowly rolling storm clouds, distant lightning pulses, drifting smoke, subtle shimmer in wet reflections, and tiny but readable far-background combat flashes and tracer streaks between carbon-based and silicon-based forces. Keep those battle signs distant and small in scale.

By the final second, make the broken elevated chase corridor slightly more visually dominant than the skyline, so the next shot can cut naturally to Lin Xia standing above the same route. The emotional read is: the world is close to losing, but hope is not gone.
```

## Kling Motion Prompt

```text
Very slow cinematic push forward and slightly downward. No rotation, no sudden zoom, no handheld shake, no aggressive parallax. Architecture remains rigid and stable. Motion comes from clouds, smoke, haze, lightning pulses, wet-surface shimmer, and tiny far-distance battle glints. Heavy, restrained, expensive, live-action feeling.
```

## Kling Negative Prompt

```text
warped architecture, distorted bridge, melting freeway, bent skyline, unstable buildings, drone vlog movement, handheld shake, sudden zoom, whip pan, fisheye distortion, close aircraft flyby, large foreground explosion, VFX demo look, cheap CG, generic concept art, low-detail storm clouds, empty sky, toy city, game screenshot, HUD, subtitles, watermark, logo, anime, cartoon, overprocessed HDR, plastic materials
```

## 使用建议

- `时长`
  先试 `5 秒` 和 `6 秒` 两版。
- `强度`
  优先保构图稳定，再追天气和远处交战。
- `重点观察`
  - 天空厚度够不够
  - 高架层级稳不稳
  - 远处战斗是不是“有”但不过量
  - 镜头结尾有没有更靠向追逐路线
