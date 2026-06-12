# A0-S02 到 A0-S04：林夏入场、战术电动摩托、装甲车队生产包

目标：接在 `A0-S01` Seedance 战后旧金山远景之后，继续制作主角入场、摩托设定、敌方车队和切入接管的镜头。当前策略：优先用 Seedance / ClipAI 做慢节奏电影镜头；角色和摩托先用 Banana 出稳定设定图，再进入视频生成。

## 全局连续性

林夏身份锁定：

```text
Lin Xia is an East Asian female motorcycle rider in her early 20s, slim athletic build, short wild asymmetrical black hair with magenta and cyan streaks, sharp tired eyes, subtle freckles, cyberpunk visor or tactical goggles, cropped black leather riding jacket, black cropped top, tactical black leather riding pants, gloves, riding boots, street-cool rebellious style, grounded human realism. She is exhausted, angry, precise, and carrying the last hope of carbon-based human life.
```

世界风格锁定：

```text
post-war future San Francisco, 2037, heavy rain, cold blue-gray low saturation, wet asphalt reflections, broken elevated freeway, distant Golden Gate Bridge silhouette, smoke columns already existing from the first frame, far background war flashes, grounded live-action sci-fi war film, expensive cinematic photography, no anime, no game HUD, no subtitles
```

全局负面词：

```text
anime, cartoon, idol pose, fashion advertisement, oversexualized framing, cheap cyberpunk, plastic leather, cross-eyed, distorted face, extra limbs, bad hands, floating motorcycle, hover bike, warped wheels, toy vehicle, game HUD, subtitles, text, watermark, logo, overprocessed HDR, sudden smoke generation, sudden explosion, melted buildings, warped freeway, distorted Golden Gate Bridge
```

---

## 先做：未来战术电动摩托设定图 / Banana

用途：先拿到一张可以反复喂给 ClipAI / Seedance 的摩托主体参考。建议先做纯设定图，不急着做视频。

### Banana Prompt

```text
Design a grounded futuristic black electric combat motorcycle for Lin Xia, a post-war San Francisco street-cool rider. The motorcycle is low, aggressive, compact, and physically believable, with real tires touching the ground, no hover technology. Wet black carbon fiber panels, battle-worn graphite metal, exposed reinforced suspension, armored battery spine, narrow tactical headlight, subtle magenta energy strips, cyan diagnostic micro lights, rain-resistant surfaces, scratched but premium.

The design should feel like a near-future tactical superbike built for high-speed pursuit on broken elevated freeways, not a fantasy vehicle. It must be rideable by a human, with a clear seat, handlebars, foot pegs, visible brake discs, believable wheelbase, road-gripping tires, and practical side armor. Add small mounts for an AI sensor module and compact emergency tools, but avoid huge guns.

Create a clean production design sheet: front three-quarter view, side view, rear three-quarter view, and a close detail of the glowing magenta power strip. Neutral dark studio background, cinematic product lighting, high-end realistic 3D concept art, readable silhouette, game production reference.
```

### Negative Prompt

```text
hover bike, floating wheels, impossible suspension, toy motorcycle, oversized weapons, fantasy spikes, plastic toy, anime vehicle, cartoon, melted wheels, unreadable silhouette, no rider seat, no handlebars, fashion prop, text, watermark, logo
```

---

## A0-S02：林夏入场 / Seedance 或 ClipAI

镜头目标：不是“漂亮角色展示”，而是她作为碳基生命侧最后行动者的登场。接在城市远景之后，节奏要稳，先让她和城市同框。

建议参考素材：

```text
@林夏000 或 @女主.png
@摩托设定图
@A0-S01 城市远景首帧或 Seedance 视频
```

### 视频创意描述

```text
请将 @林夏角色参考 @摩托设定图 @城市远景参考 作为同一个电影镜头的身份和环境参考，不要剪成多个镜头。

生成一个 6 秒的主角入场镜头。画面发生在战后未来旧金山的破损高架边缘，暴雨、乌云、远处火光、已经存在的烟柱和湿润路面延续上一镜头。前 2 秒镜头保持稳定，林夏以背影或三分之二背影站在画面左侧或下方，旁边是一辆黑色战术电动摩托。她不是摆拍模特，而是在观察远处高架路线和敌方车队方向。

第 3 秒开始镜头非常缓慢地横移或轻微推近，雨水落在她的短发、皮夹克和摩托车外壳上。她的短发被风轻微吹动，护目镜或单片战术镜反射远处闪电。她微微转头，露出冷静、疲惫但坚定的侧脸。摩托的 magenta 能量条只轻微亮起，不要夸张发光。

镜头结尾：林夏的手靠近摩托把手，观众明白她即将出发。不要让她已经骑出去，本镜头只负责登场和情绪建立。

画面风格：高成本真人科幻战争电影，冷蓝灰低饱和，湿润反光，压抑、悲凉，但主角出现时有一点希望感。真实摄影，稳定构图，电影级景深，克制的角色动作。

禁止：不要美颜广告，不要性感摆拍，不要跳舞，不要笑，不要大幅动作，不要突然爆炸，不要新烟雾凭空出现，不要摩托悬浮，不要人物变脸，不要文字，不要字幕，不要游戏 HUD。
```

推荐设置：

```text
Seedance 2.0, 6s, 16:9, 720p, 无声, 数量 1
```

---

## A0-S03：装甲车队进入高架 / Seedance 或 ClipAI

镜头目标：明确敌方目标。这个镜头不要出现林夏，避免模型把主角和车队混在一起。

建议参考素材：

```text
@A0-S01 城市远景
@高架近景关键帧 KF05 或 KF06
```

### 视频创意描述

```text
请将参考图作为同一个电影镜头的环境参考，不要剪成多个镜头。

生成一个 5 秒的敌方目标揭示镜头。地点是战后未来旧金山的破损高架道路，暴雨、湿润路面、断裂护栏、远处火光和烟柱从第一帧就存在。镜头开始时保持低机位稳定构图，像隐藏观察者从破损混凝土后方看向高架。

第 2 秒，一支黑色装甲车队从远处雨雾中进入画面，而不是从画面边缘凭空出现。车辆沿着明确可行驶的高架道路向前移动，轮胎压过积水，有轻微水花和车灯反光。车队由 3 辆黑色重型装甲 SUV / armored vans 组成，湿黑金属外壳，cyan 车灯，少量 restrained magenta security lights，脏污、沉重、真实。

远处可见硅基机器无人机小光点护航，但不要抢画面。镜头结尾，车队完全进入追逐走廊，形成下一镜头林夏启动摩托追击的目标。

画面风格：高成本真人科幻动作惊悚片，冷蓝灰低饱和，雨夜，湿润反光，真实尺度，稳定电影镜头。

禁止：不要车从右边或近景凭空出现，不要车道不合理，不要悬浮车，不要玩具车，不要巨大枪炮，不要突然冒烟，不要突然大爆炸，不要道路变形，不要字幕，不要文字，不要游戏 HUD。
```

推荐设置：

```text
Seedance 2.0, 5s, 16:9, 720p, 无声, 数量 1
```

---

## A0-S04：林夏点火追击 / 切入接管

镜头目标：这是进入玩家接管的前一镜。动作可以比前两镜更强，但仍然要用“遮挡点”给 3D 接管做转场。

建议参考素材：

```text
@林夏角色参考
@摩托设定图
@A0-S03 装甲车队视频或截图
```

### 视频创意描述

```text
请将 @林夏角色参考 @摩托设定图 @装甲车队参考 作为同一个电影镜头的连续参考，不要剪成多个镜头。

生成一个 6 秒的追击启动镜头。地点是暴雨中的破损高架，延续前一镜头的冷蓝灰、湿润路面、远处火光和烟柱。镜头从林夏身后低机位开始，靠近摩托车高度。前 1.5 秒，她跨上黑色战术电动摩托，手套握住把手，magenta 能量条沿车身轻微亮起。

第 2 秒后摩托低沉启动，后轮压过积水，喷出真实水花。镜头跟在她后方略偏侧面，保持车轮真实接地。远处黑色装甲车队在雨雾中可见，但不要太近。林夏身体前倾，进入追击姿态，动作干净、迅速、专业。

最后 1 秒，镜头逐渐贴近摩托后方视角，构图对齐后续 3D 接管视角。可以用车灯眩光、雨水溅到镜头、闪电白光或路边爆炸远光作为自然遮挡转场，但不要大爆炸盖满整个画面。

画面风格：高成本真人科幻动作电影，真实雨夜，湿润反光，克制霓虹，强速度感但不是游戏画面。

禁止：不要汽车驾驶舱，不要方向盘，不要悬浮摩托，不要车轮离地，不要人物变脸，不要性感摆拍，不要夸张翻身动作，不要巨大爆炸，不要字幕，不要文字，不要游戏 HUD。
```

推荐设置：

```text
Seedance 2.0, 6s, 16:9, 720p, 无声, 数量 1
```

## 当前推荐生产顺序

1. Banana 先出 `摩托设定图`。
2. 用 `林夏000 + 摩托设定图 + A0-S01` 跑 `A0-S02 林夏入场`。
3. 用城市/高架参考跑 `A0-S03 装甲车队`。
4. 用 `林夏000 + 摩托设定图 + A0-S03` 跑 `A0-S04 点火追击`。
