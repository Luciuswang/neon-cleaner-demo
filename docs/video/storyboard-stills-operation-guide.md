# 分镜静帧优先操作指南

更新时间：2026-06-08

这个项目现在采用“先分镜静帧，再生成视频”的流程。

不要一上来运行 ComfyUI 视频工作流。视频是第二阶段。第一阶段要先把每个剧情节点的电影分镜画面定下来。

## 总流程

```text
剧本节点 -> 分镜静帧 -> 人工确认 -> I2V 生成视频 -> 接入互动游戏
```

## 明天到公司先做什么

1. 打开项目：

```powershell
git clone https://github.com/Luciuswang/neon-cleaner-demo.git
cd neon-cleaner-demo
```

如果已经 clone 过：

```powershell
git pull
```

2. 先阅读这几个文件：

```text
docs/handoff.md
docs/video/topview-storyboard-stills-first.md
docs/video/topview-storyboard-stills.json
docs/video/next-step-storyboard-stills.md
```

3. 打印第一张分镜图 prompt：

```powershell
node tools/comfy/print_storyboard_still_prompt.mjs SB-A0-01
```

4. 把 `STILL IMAGE PROMPT` 和 `NEGATIVE PROMPT` 复制到图片生成工具里。

可以使用：

- ChatGPT 画图
- Midjourney
- Photoshop 生成式填充
- 其他图片 AI
- 之后也可以另装 Flux/SDXL 到 ComfyUI 做本地静帧

现在的 `D:\AI\SULPHUR2_ComfyUI` 主要是 Sulphur2/LTX 视频环境，不适合直接当静帧画图环境。

## 先生成哪些分镜图

按这个顺序做：

```text
SB-A0-01  旧金山战后大远景
SB-A0-02  林夏站在高处俯瞰城市
SB-A0-03  敌方装甲车出现
SB-I1-01  第一人称接管驾驶画面
```

每张先生成 3 个候选版本。

## 候选图保存位置

把所有候选分镜图放在：

```text
source/storyboard/drafts/
```

建议命名：

```text
SB-A0-01_v01.png
SB-A0-01_v02.png
SB-A0-01_v03.png
```

## 通过图保存位置

我们确认通过后，把图移动到：

```text
source/storyboard/approved/
```

建议命名：

```text
SB-A0-01_establishing_world.png
SB-A0-02_linxia_overlook.png
SB-A0-03_enemy_convoy.png
SB-I1-01_playable_handoff.png
```

## 分镜通过标准

一张分镜图只有满足这些条件才进入视频阶段：

- 看起来像电影画面，不像游戏截图或概念草图。
- 一眼能看出是战后的未来旧金山。
- 湿地面、烟雾、冷蓝灰气氛、克制的粉色信号光成立。
- 没有 UI、字幕、水印、logo、可读文字。
- 车辆或角色比例可信，不像玩具。
- 镜头方向能接到后面的互动驾驶。

## 通过后才做视频

通过的分镜图复制到：

```text
D:\AI\SULPHUR2_ComfyUI\ComfyUI\input
```

然后再打开这个 I2V 工作流：

```text
C:\Users\Administrator\Desktop\ComfyUI工作流\A0-S01_I2V_可上传首帧图.json
```

在 `Load Image / 加载图像` 节点里选择通过的分镜图，再运行生成视频。

## 当前原则

如果静帧不满意，绝不生成视频。

先把分镜画面打磨对，再进入 I2V。这样能避免浪费大量时间在不合格的视频上。
