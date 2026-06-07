# Daily Summary 2026-06-08

## 今日目标

把“Topview 风格的本地 ComfyUI 分镜模板”从直接生成视频，纠正为更合理的电影制作流程：

```text
剧本拆分 -> 分镜静帧 -> 审核通过 -> I2V 生成视频 -> 接入互动游戏
```

## 关键结论

1. 当前 `D:\AI\SULPHUR2_ComfyUI` 环境没有损坏。
2. Sulphur2/LTX-2.3 更适合视频阶段，不适合作为第一阶段的静帧分镜工具。
3. 第一阶段应该先用图片生成工具产出分镜静帧。
4. 分镜通过后，再把通过图片放入 ComfyUI `input`，用 I2V 工作流生成视频。
5. 不要再一上来运行 T2V/I2V 视频工作流。

## 新增文档

```text
docs/video/storyboard-stills-operation-guide.md
docs/video/topview-storyboard-stills-first.md
docs/video/topview-storyboard-stills.json
docs/video/next-step-storyboard-stills.md
```

这些文件说明了：

- 为什么先做静帧。
- 先生成哪些分镜图。
- 每张分镜图的 prompt 和 negative prompt。
- 候选图和通过图的保存位置。
- 通过后如何进入 I2V。

## 新增工具

```text
tools/comfy/print_storyboard_still_prompt.mjs
tools/comfy/print_storyboard_prompt.mjs
tools/comfy/build_storyboard_t2v_workflow.mjs
```

最重要的是静帧 prompt 打印工具：

```powershell
node tools/comfy/print_storyboard_still_prompt.mjs SB-A0-01
```

可用分镜编号：

```text
SB-A0-01  旧金山战后大远景
SB-A0-02  林夏站在高处俯瞰城市
SB-A0-03  敌方装甲车出现
SB-I1-01  第一人称接管驾驶画面
SB-C1-01  成功追击结果
SB-C2-01  受损追击结果
SB-C3-01  跟丢目标结果
```

## 新增目录

```text
source/storyboard/drafts/
source/storyboard/approved/
```

候选图放 `drafts`，确认通过的图放 `approved`。

## 已准备的视频阶段工作流

桌面本机已有：

```text
C:\Users\Administrator\Desktop\ComfyUI工作流\A0-S01_I2V_可上传首帧图.json
```

这个工作流只应该在静帧通过后使用。

## 明天建议流程

1. 到公司后先 `git pull`。
2. 阅读：

```text
docs/handoff.md
docs/video/storyboard-stills-operation-guide.md
docs/video/topview-storyboard-stills-first.md
```

3. 打印 `SB-A0-01` prompt：

```powershell
node tools/comfy/print_storyboard_still_prompt.mjs SB-A0-01
```

4. 用图片 AI 生成 `SB-A0-01` 的 3 个候选图。
5. 保存到：

```text
source/storyboard/drafts/
```

6. 让 Codex 帮忙比较候选图。
7. 通过后移动到：

```text
source/storyboard/approved/
```

8. 再进入 ComfyUI I2V 视频阶段。

## 当前风险

- 如果直接从视频模型开始生成，会浪费大量时间在错误构图的视频上。
- 当前 ComfyUI 视频环境不是静帧生成环境；如需本地静帧，后续应单独安装 Flux 或 SDXL，不要和 Sulphur2 视频环境混在一起。
- 后续接入游戏时，最关键的是 `SB-I1-01`，它必须能自然连接到第一人称驾驶玩法。

## 明日第一句话建议

```text
请阅读 docs/handoff.md 和 docs/video/storyboard-stills-operation-guide.md。我们现在先做分镜静帧，不直接生成视频。先从 SB-A0-01 旧金山战后大远景开始，帮我生成/评估候选分镜图。
```
