# Topview 9-Shot Short Film Workflow

如果目标是做一个像 Topview 那样的 `短剧式 AI 电影段落`，不要试图一次生成完整长片。正确方法是：

```text
9 张故事板分镜 -> 每张分镜审批通过 -> 每张生成 1 段短视频 -> 按顺序拼成短剧
```

这样做的核心好处：

- 总时长不受单次模型生成时长限制
- 每个镜头都能单独返工
- 角色、车辆、镜头方向更容易锁定
- 更容易把其中某些镜头再拿去接互动玩法

## 这 9 张分镜是什么

本项目当前推荐的 `线性短剧版 9 张分镜` 在这里：

```text
docs/video/topview-nine-shot-stills.json
```

对应的 `9 段短视频镜头卡` 在这里：

```text
docs/video/topview-nine-shot-comfyui-storyboard.json
```

## 9 张分镜顺序

1. `SB-A0-01`
   战后旧金山大远景，建立世界和高架追车走廊

2. `SB-A0-02`
   林夏高处俯瞰城市，建立人物情绪

3. `SB-A0-03`
   敌方装甲车出现在高架匝道上，建立追逐目标

4. `SB-A0-04`
   林夏进入追击车，点火进入战斗

5. `SB-I1-01`
   第一人称/引擎盖低机位追逐视角

6. `SB-I1-02`
   高架追逐中的爆炸躲避与动作升级

7. `SB-A2-01`
   仓库阈值镜头，建立下一个战场

8. `SB-I2-01`
   上传终端对峙镜头，建立高潮

9. `SB-E1-01`
   救人成功后的结尾 tableau

## 为什么“不会限制时间”

因为这里的“短剧”不是一条 45 秒或 90 秒视频一次生成，而是：

```text
6s + 5s + 5s + 4s + 7s + 5s + 6s + 6s + 6s
```

每段单独生成，最后在剪辑里拼接。

所以：

- 单条模型生成仍然只做短镜头
- 整体短剧时长可以继续加长
- 以后要做 12 镜头、18 镜头也只是继续扩镜头表

## 实际操作顺序

### Step 1: 先出 9 张 still

打印单张分镜 prompt：

```powershell
node tools/comfy/print_storyboard_still_prompt.mjs SB-A0-01 --storyboard docs/video/topview-nine-shot-stills.json
```

候选图放这里：

```text
source/storyboard/drafts/
```

通过图放这里：

```text
source/storyboard/approved/
```

### Step 2: 每张 approved still 再做对应短视频

打印单条视频 shot prompt：

```powershell
node tools/comfy/print_storyboard_prompt.mjs A0-S01 --storyboard docs/video/topview-nine-shot-comfyui-storyboard.json
```

或者直接为某个镜头生成 ComfyUI workflow：

```powershell
node tools/comfy/build_storyboard_t2v_workflow.mjs A0-S01 --storyboard docs/video/topview-nine-shot-comfyui-storyboard.json --root D:\AI\SULPHUR2_ComfyUI
```

### Step 3: 把 9 段视频按顺序拼接

当前仓库还没有内置 `ffmpeg`，所以这一步的原则先定为：

```text
每段镜头独立输出命名 -> 统一放进 source/video/shortfilm/ -> 再用 ffmpeg 或剪辑软件拼接
```

建议命名：

```text
source/video/shortfilm/01_A0_S01_establishing.mp4
source/video/shortfilm/02_A0_S02_linxia_overlook.mp4
source/video/shortfilm/03_A0_S03_enemy_convoy.mp4
source/video/shortfilm/04_A0_S04_launch_pursuit.mp4
source/video/shortfilm/05_I1_S01_takeover_view.mp4
source/video/shortfilm/06_I1_S02_explosion_dodge.mp4
source/video/shortfilm/07_A2_S01_warehouse_threshold.mp4
source/video/shortfilm/08_I2_S01_terminal_confrontation.mp4
source/video/shortfilm/09_E1_S01_best_ending.mp4
```

## 当前最该先做什么

不要 9 张一起做。先锁前 3 张：

1. `SB-A0-01`
2. `SB-A0-02`
3. `SB-A0-03`

因为这三张一旦成立：

- 世界观成立
- 林夏的气质成立
- 追逐目标成立

后面 6 张就容易得多。

## 这条线和互动玩法怎么兼容

这 9 镜头短剧版，不会破坏互动版本，反而是互动版的上游资产来源：

- `SB-I1-01` 和 `SB-I1-02` 可以回灌到追车接管
- `SB-I2-01` 可以回灌到 Boss 接管
- `SB-E1-01` 可以直接做一条完成版好结局

也就是说：

```text
短剧线 = 先证明电影内容生产力
互动线 = 再把关键镜头变成可接管节点
```
