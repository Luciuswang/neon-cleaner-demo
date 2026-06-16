# A0/I1 缺失镜头与 World Labs 场景衔接包

日期：2026-06-15

目标：把上周已生成的视频素材整理成可剪辑的 A0 开场到 I1 高架追车段，并补齐能让 World Labs / Marble 重建同一 3D 高架追逐空间的关键镜头。

## 现有视频判断

素材目录：

```text
web/assets/video/
```

已识别视频：

```text
cgt-20260611202855-vr5w8_202606112028.mp4
用途：A0-S01 城市远景 / 战后旧金山建立。可用。

cgt-20260612203400-sc5hs_202606122034.mp4
用途：A0-S02 林夏站在摩托旁看城市。画面可用，但动作偏静态，适合做登场/观察，不适合作为追车启动。

cgt-20260612210231-tqqn2_202606122102.mp4
用途：城市和高架战场补充镜头。可作为 World Labs 场景参考，也可做短切片。

cgt-20260612211306-rmqfw_202606122113.mp4
用途：装甲车队远处进入高架。可用，适合做敌方目标揭示。

cgt-20260612212332-zftf7_202606122123.mp4
用途：林夏/摩托近景。画面质感可用，但偏静态展示，不能单独承担“追车”叙事。

cgt-20260612222723-jvcsz_202606122227.mp4
用途：车队在前、林夏摩托在后方追击。方向关系正确，最适合做 I1 接管前参考。
```

当前主要缺口：

```text
1. A0-S02B：林夏从静态观察进入上车/点火，必须补一个动作桥。
2. A0-S04A：正面低机位躲障特写，强化主角记忆点。
3. A0-S04B：侧拍速度镜头，展示摩托速度和道路连续性。
4. A0-S04D：接管遮挡镜头，用水花/闪电/车灯眩光无缝切到 3D。
5. World Labs/Marble：同一条高架追逐战斗 3D 场景，不要做成纯城市远景。
```

## 推荐剪辑顺序

```text
01 A0-S01 城市远景
02 A0-S02 林夏背影观察城市 + 摩托
03 A0-S02B 林夏上车点火
04 A0-S03 装甲车队进入高架
05 A0-S04A 林夏正面躲障
06 A0-S04B 侧拍高速飞奔
07 A0-S04C 后方追车，车队在前、林夏在后
08 A0-S04D 水花/闪电/车灯遮挡，切入 I1 3D 接管
```

## 全局连续性锁定

```text
Lin Xia is an East Asian female motorcycle rider in her early 20s, slim athletic build, short wild asymmetrical black hair with magenta and cyan streaks, sharp tired eyes, subtle freckles, cyberpunk visor or tactical goggles, cropped black leather riding jacket, black cropped top, tactical black leather riding pants, gloves, riding boots, street-cool rebellious style, grounded human realism. She rides the same black futuristic electric combat motorcycle from the existing footage, with real tires touching wet asphalt, compact tactical body, restrained magenta energy strips, and cyan diagnostic lights.

Post-war future San Francisco, 2037, heavy rain, cold blue-gray low saturation, wet asphalt reflections, broken elevated freeway, distant Golden Gate Bridge silhouette, smoke columns already existing from the first frame, far background war flashes, grounded live-action sci-fi war film, expensive cinematic photography, no anime, no game HUD, no subtitles.
```

通用负面词：

```text
anime, cartoon, idol pose, fashion advertisement, oversexualized framing, cheap cyberpunk, plastic leather, cross-eyed, distorted face, extra limbs, bad hands, floating motorcycle, hover bike, warped wheels, toy vehicle, game HUD, subtitles, text, watermark, logo, overprocessed HDR, sudden smoke generation, sudden explosion, melted buildings, warped freeway, distorted Golden Gate Bridge, convoy chasing Lin Xia, headlights behind Lin Xia, impossible road position
```

## 补拍 Prompt 1：林夏上车点火

用途：接在“林夏站在摩托旁看城市”之后，让她从观察进入行动。

```text
请将林夏角色参考、现有摩托车视频参考、战后旧金山高架参考作为同一个连续电影镜头，不要剪成多个镜头。

生成一个 5 秒镜头。暴雨中的战后旧金山破损高架边缘，冷蓝灰低饱和，湿润沥青反光，远处金门大桥、城市烟柱、火光和闪电从第一帧就存在。林夏站在黑色未来电动摩托旁，延续现有影片里的摩托外观，不要重新设计摩托。

前 1 秒镜头稳定，她背对城市，短发和夹克被雨和风轻轻吹动。第 2 秒她戴上护目镜或压低战术 visor，表情疲惫但坚定。第 3 秒她跨上摩托，手套握住把手。第 4 秒摩托低沉启动，车身 magenta 能量条克制亮起，前后轮真实压在湿地上，水面有轻微震动。最后 1 秒镜头轻微压低到摩托后方，为后面追车镜头做准备。

画面风格：高成本真人科幻动作电影，真实摄影，稳重、克制、悲凉中带希望，雨夜湿路，电影级景深。

禁止：不要性感摆拍，不要摩托悬浮，不要变成汽车驾驶舱，不要夸张翻身动作，不要突然爆炸，不要新烟雾凭空生成，不要文字，不要字幕，不要 HUD。
```

推荐设置：

```text
Seedance 2.0 或 可灵 3.0 Omni，5s，16:9，720p，无声，数量 1
```

## 补拍 Prompt 2：正面躲障特写

用途：让林夏有强主角镜头，解决“只有城市和车，看不到主角能力”的问题。

```text
请将林夏角色参考、现有摩托车参考、破损高架道路参考作为同一个连续动作镜头。

生成一个 5 秒正面低机位追拍镜头。地点是暴雨中的旧金山破损高架，湿润路面反光，远处火光、烟柱、金门大桥轮廓和硅基无人机战斗光点延续上一镜头。

镜头在道路前方低机位正面拍摄林夏，她骑同一辆黑色未来电动摩托从雨雾中高速冲向镜头。林夏的短发带 magenta/cyan 挑染，护目镜反射闪电，眼神疲惫、专注、坚定。她不是摆拍，她正在追击证人转运车队。

第 1 秒她从雨雾中出现。第 2-3 秒，道路上出现碎石、断裂护栏、烧毁车门残骸，她压低车身左右闪避，摩托轮胎真实接地，前轮切过积水，水花向两侧飞溅。第 4-5 秒她从镜头旁边掠过，留下尾灯、水雾和发动机低频感，为侧拍速度镜头衔接。

画面风格：高成本真人科幻动作片，真实雨夜，低机位，速度感强但主体清晰。

禁止：不要车队追她，不要迎面汽车，不要跳跃飞车，不要悬浮摩托，不要人物变脸，不要性感广告摆拍，不要文字，不要字幕，不要 HUD。
```

推荐设置：

```text
Seedance 2.0，5s，16:9，720p，无声，数量 1
```

## 补拍 Prompt 3：侧拍速度镜头

用途：展示摩托速度和高架道路结构，为 3D 接管提供道路侧向参考。

```text
请将林夏角色参考、现有摩托车参考、战后旧金山高架参考作为同一个连续电影镜头。

生成一个 5 秒侧向高速追踪镜头。摄影机在林夏摩托左侧或右侧，与摩托同速并行移动，像电影摄影车平行跟拍。林夏骑同一辆黑色未来电动摩托沿湿滑破损高架向前飞奔，车轮真实接触路面，后轮持续压出水花。车身 magenta 能量条克制发光，不能变成漂浮光效。

背景中，高架护栏、断裂路灯、烧毁车辆、远处火光、烟柱和雨雾快速横向掠过。主体摩托和林夏保持清晰，背景有电影运动模糊。不要出现敌方车队，本镜头只证明林夏速度和路线。

画面风格：高成本真人科幻动作电影，冷蓝灰低饱和，湿路反光，雨夜，真实摄影，速度感强但不游戏化。

禁止：不要悬浮摩托，不要车轮离地，不要摩托变形，不要人物脸变形，不要车辆凭空出现，不要突然大爆炸，不要文字，不要字幕，不要 HUD。
```

推荐设置：

```text
Seedance 2.0，5s，16:9，720p，无声，数量 1
```

## 补拍 Prompt 4：接管遮挡镜头

用途：从电影无缝切到 3D。这个镜头比“漂亮”更重要，必须让最终 1 秒适合切画面。

```text
请将现有后方追车视频、林夏角色参考、现有摩托车参考、装甲车队参考作为同一个连续追车镜头。不要改变追车方向：黑色装甲车队永远在画面前方和远处，林夏骑摩托永远在画面后方和近处，所有车辆同方向沿高架向画面深处前进。林夏是追击者，车队是逃跑目标。

生成一个 5-6 秒低机位后方追车镜头。镜头贴近林夏摩托后方，构图逐渐接近第三人称游戏 chase cam。前方远处有三辆黑色装甲 SUV / armored vans，尾灯和雨雾清晰。高架道路必须可行驶，至少中间一条车道完整，护栏和废车在道路两侧，不能堵死路线。

第 1-3 秒，林夏逐渐缩短和车队的距离，轮胎水花、湿路反光和风雨增强速度感。第 4 秒，前方车队经过一个火光和烟雾遮挡区，路面有闪电反光。最后 1 秒，水花溅到镜头或车灯眩光盖住画面 40%-60%，形成自然白/灰遮挡，可直接切入 3D 游戏画面。遮挡之后不要换成新场景，不要黑屏。

画面风格：真实电影摄影，雨夜高架追车，低机位第三人称接管预备，克制霓虹，强速度感，空间关系清楚。

禁止：车队追林夏，车灯从林夏背后出现，林夏迎面驶向车队，车辆从无道路位置出现，悬浮摩托，车轮离地，人物变脸，巨大爆炸，字幕，文字，HUD，卡通。
```

推荐设置：

```text
Seedance 2.0，5-6s，16:9，720p，无声，数量 2
```

## World Labs / Marble 场景 Prompt

用途：不是生成电影，而是生成可以让林夏在同一条高架上追逐战斗的 3D 场景。重点是可驾驶空间、道路连续、遮挡切点、和现有影片一致。

```text
Create a photorealistic navigable 3D world for an interactive cinematic motorcycle chase sequence.

The world must match the existing Neon Cleaner footage: post-war future San Francisco in heavy rain, cold blue-gray low saturation, wet reflective asphalt, layered elevated freeways, broken guardrails, damaged overpasses, distant Golden Gate Bridge silhouette, downtown skyline, smoke columns already present, small distant war flashes, emergency glows, and restrained magenta/cyan sci-fi lights.

Build one continuous playable elevated freeway route for Lin Xia's motorcycle chase. The route should start from a third-person chase camera position behind a black futuristic electric motorcycle, looking forward down a wet broken elevated road. The road must have clear forward direction, readable lane lines, at least one central drivable lane, and enough width for high-speed dodging. Debris, burned cars, broken concrete, fallen signs, and damaged railings should sit mostly along the sides or as avoidable obstacles, never blocking the whole road.

Place a black armored convoy path ahead in the distance: three black armored SUVs or vans should have a clear route away from the player along the same elevated road. The environment should support a chase where Lin Xia is behind and the convoy is in front. Add playable beats: a debris dodge zone, a side lane near-miss zone, a smoke-and-fire occlusion zone for movie-to-play transition, a wider split-ramp area for player choice, and a final road-level exit toward an industrial port.

San Francisco identity should come from geography, not readable text: steep urban grade, layered freeway ramps, Bay Area fog, damaged suspension bridge silhouette, dense downtown towers, wet concrete, rain haze, and realistic emergency light reflections. Avoid signs with readable words.

Important camera/transition requirement: the first playable camera should match a cinematic rear chase shot. Put the start zone after a rain splash / headlight glare / smoke occlusion point, so the movie can cut into the 3D world without black screen. Keep the opening 30 meters visually clean and drivable so the player can immediately see the road, motorcycle direction, and convoy target.

Visual style: premium live-action sci-fi war film, grounded near-future design, realistic scale, wet road reflections, heavy storm clouds, practical lights, smoke layers, expensive production design, no cartoon, no anime, no clean cyberpunk street, no fashion shoot.

Do not create close-up characters, dialogue, UI, subtitles, logos, readable text, pedestrians, fantasy architecture, hover vehicles, toy cars, maze-like alleys, fully blocked roads, floating geometry, melted roads, distorted bridge, or over-cluttered geometry. The scene must be usable for a playable 3D motorcycle chase and export well as SPZ plus collider mesh.
```

如果有负面词框：

```text
characters, close-up face, pedestrians, readable text, subtitles, logos, watermarks, clean cyberpunk street, peaceful commute, tiny alley, blocked road, maze route, unusable route, collapsed road across entire street, toy cars, hover vehicles, cartoon, anime, fashion shoot, over-cluttered props, floating geometry, melted vehicles, distorted bridge, flat lighting, black screen start, no drivable lane
```

## World Labs 输入素材建议

优先给它这些参考：

```text
1. cgt-20260612222723-jvcsz_202606122227.mp4
   原因：追车方向正确，车队在前、摩托在后，适合做接管空间。

2. cgt-20260612211306-rmqfw_202606122113.mp4
   原因：装甲车队进入高架，能定义敌方车队和道路远景。

3. cgt-20260612210231-tqqn2_202606122102.mp4
   原因：城市/高架战场关系好，可补世界尺度。

4. cgt-20260611202855-vr5w8_202606112028.mp4
   原因：A0 大世界气氛和旧金山身份。
```

不要优先喂：

```text
cgt-20260612203400-sc5hs_202606122034.mp4
cgt-20260612212332-zftf7_202606122123.mp4
```

原因：这两条更像角色/摩托展示，容易让 World Labs 把目标偏到人物或近景道具，而不是可玩的高架路线。

## 质量检查

补拍视频通过标准：

```text
1. 林夏骑的是同一辆黑色未来电动摩托。
2. 车队永远在前方，林夏永远在后方追。
3. 路面有明确可行驶车道，不是纯背景图。
4. 烟、火、车、障碍物第一帧就合理存在，不要凭空冒出来。
5. 最后一秒有水花、车灯、闪电或烟雾遮挡，方便切 3D。
6. 没有字幕、文字、HUD、奇怪车牌、过度霓虹。
```

World Labs 通过标准：

```text
1. 初始视角能立刻看见 3D 高架路，不黑屏。
2. 起点前 30 米可驾驶，车道清楚。
3. 有同电影镜头一致的雨夜、冷蓝灰、高架、远桥、烟柱。
4. 有明确的前方目标路线，适合放装甲车队。
5. 有遮挡切点，能从视频自然切入 playable。
6. 能导出 SPZ 和 collider GLB。
```
