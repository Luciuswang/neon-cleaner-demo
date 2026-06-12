# Structured Shot Description Template

这个模板用于《霓虹清道夫》的镜头描述编写。

目标不是“堆关键词”，而是把提示词写成接近导演分镜指令的结构，让模型更容易稳定执行。

## 写法原则

1. 先交代 `世界 / 时间 / 地点 / 主体`
2. 再交代 `风格 / 材质 / 镜头质感`
3. 最后交代 `镜头怎么动 / 画面里什么在动 / 为什么这样动`
4. 少写空泛判断，多写可执行信息
5. 明确写 `不要什么`

## 模板

```text
〖基础设定〗
- 时间：
- 地点：
- 世界状态：
- 主体：
- 关键关系：
- 参考图锁定：

〖氛围画质〗
- 风格核心：
- 真实感约束：
- 镜头设备感：
- 色彩影调：
- 天气与空气：
- 材质重点：

〖画面内容〗
- 总时长：
- 景别：
- 构图：
- 运镜：
- 画面内动态：
- 情绪目标：
- 结尾切点：

〖反向限制〗
- 不要：
```

## 可直接套用的英文骨架

```text
Base Setup:
Set in [time period], in [location], inside a world where [world condition]. The main subject is [subject], with [key relationship or narrative pressure]. Use the uploaded reference as a strict continuity anchor for [identity / layout / costume / environment].

Look and Rendering:
The shot should feel [style core]. Prioritize [material realism / architecture stability / character continuity]. Use [lens or camera feeling]. The palette is [color direction]. The atmosphere contains [weather / haze / smoke / rain / dust]. Surfaces should show [key material behavior].

Shot Content:
Duration is [x seconds]. This is a [shot size] with [composition]. The camera performs [camera move]. Motion inside the frame comes from [internal motion elements]. The emotional read should be [emotion]. End so the shot can cut naturally to [next beat].

Negative Constraints:
Avoid [distortion / generic CG / overanimation / anatomy issues / text / watermark / style drift].
```

## 适用提醒

- `Kling / Runway / Banana`：
  适合直接用完整结构化描述。
- `Sulphur2 / ComfyUI`：
  建议拆成 `master prompt + motion prompt + negative prompt`。
- `角色镜头`：
  必须写清楚脸部、发型、服装、体态连续性。
- `环境镜头`：
  必须写清楚构图稳定性、建筑不变形、道路层级和远景关系。
