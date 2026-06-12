# A0-S01 Kling I2V Prompt

适用素材：

```text
source/storyboard/approved/SB-A0-01_establishing_world.png
```

目标：

- 保住当前 approved still 的构图和世界观
- 不把镜头做成 VFX demo
- 让镜头像“大电影开场空镜”
- 为下一镜 `A0-S02 林夏出场` 留下自然切点

## 建议时长

```text
6 秒
```

如果第一版不稳，先试 `5 秒`。

## 正向 Prompt

```text
Use the uploaded still as a strict composition reference. Keep the exact skyline layout, Golden Gate Bridge silhouette, elevated freeway geometry, broken ramp shape, city height difference, road positions, and horizon line stable. Create a premium cinematic opening shot of post-war future San Francisco after rain, seen from a half-bird's-eye elevated view. The camera makes a very slow forward drift with a slight downward descent, heavy and stable like a big-budget live-action aerial plate, not like a drone vlog.

The world is still under pressure: dense storm clouds roll slowly, distant lightning flickers inside the cloud bank, smoke columns drift, faint battle glints and tiny tracer fire appear very far across the skyline between carbon-based human forces and silicon-based machine forces, but they remain small and background-scale. Wet asphalt and concrete hold realistic cold blue-gray storm reflections with restrained magenta emergency lights. Keep the mood somber, epic, grounded, and expensive. Prioritize stable architecture, readable road hierarchy, atmospheric depth, volumetric haze, subtle lens halation, realistic wet-surface specular, and premium anamorphic film rendering.

End with the elevated chase corridor slightly more visually dominant than at the start, so the next shot can cut to Lin Xia standing above the same route.
```

## Motion Prompt

```text
Very slow cinematic push forward and slightly downward. No rotation, no sudden zoom, no handheld shake. Architecture remains rigid and stable. Motion comes mainly from cloud movement, smoke drift, rain haze, distant lightning pulses, and faint far-background battle flashes. The shot should feel heavy, restrained, and expensive.
```

## Negative Prompt

```text
warped architecture, distorted bridge, melting buildings, bending freeway, unstable skyline, rubber geometry, fisheye deformation, fast drone movement, handheld shake, sudden zoom, dramatic whip pan, close aircraft flyby, dogfight near camera, missile chaos in foreground, bright branching lightning filling the frame, giant explosions, VFX demo look, fake particles, floating dots, overprocessed HDR, sterile CG, generic concept art, low-detail clouds, toy city, cartoon, anime, logo, text, watermark, HUD, subtitles, blurry image, plastic materials
```

## Kling 使用建议

1. `模式`
   `Image to Video`

2. `参考图`
   用：

   ```text
   source/storyboard/approved/SB-A0-01_establishing_world.png
   ```

3. `时长`
   先试：

   ```text
   5 到 6 秒
   ```

4. `镜头强度`
   保守，不要大运动。优先选择：

   ```text
   subtle / slow / cinematic
   ```

5. `参考强度`
   尽量偏高，让它别乱改构图。

6. `优先级`
   先保：
   - 构图稳定
   - 桥和高架不变形
   - 城市层级不乱
   - 空气和天气动起来

   后补：
   - 更强雷电
   - 更清楚远处交战

## 通过标准

这条镜头通过，至少要满足：

- 还是同一张图的世界，不是“重画一遍”
- 城市、桥、高架没有变形
- 云、烟、空气、远景战火真的动了
- 镜头结尾更靠近追逐路线
- 能自然切到 `A0-S02 林夏出场`
