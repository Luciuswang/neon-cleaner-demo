# Neon Cleaner Daily Summary

日期：2026-06-05

## 今天完成的事

1. 明确了公司电脑这套 `ComfyUI + Sulphur2/LTX-2.3` 环境昨天失败的主因不是模型没装好，也不是 `ComfyUI` 版本太旧，而是：
   - 浏览器缓存污染了旧的 `Unsaved Workflow`
   - 之前为了方便操作手工做的展开版 workflow 与当前这版 `ComfyUI` 子图机制不兼容

2. 清理并收敛了本地视频工作流方案：
   - 不再依赖旧的坏 workflow
   - 保留基于官方 `LTX2.3` 模板的稳定路线
   - 补了可直接使用的 ready workflow，让图片输入和视频保存都在最外层可见

3. 为本地 `ComfyUI` 补齐了可复用工具和工作流文件：
   - `tools/comfy/build_public_i2v_save_workflow.ps1`
   - `tools/comfy/build_public_i2v_ready_workflow.ps1`
   - `tools/comfy/video_ltx2_3_i2v_ready.json`
   - `tools/comfy/video_ltx2_3_i2v_A0_shot1_warsignal.json`

4. 重写了开场方向，不再走“安静雨夜悬疑追车”的旧语法，改为：
   - 战后未来城市的宏大开场
   - 林夏作为“碳基生命一侧最后希望”的登场
   - 双车战斗追逐
   - 通过爆炸遮挡、硬闪避、近失误躲避等方式切入 gameplay

5. 同步更新了文档和 prompt 工具：
   - `docs/video/A0-rain-signal-script.md`
   - `docs/ai-shot-list.md`
   - `tools/neon-video-prompter/references/shot-library.json`
   - `docs/video/A0-war-signal-prompt-package.md`

6. 已把今天这批内容推送到 GitHub：
   - 最新提交：`6c96925 feat: add local video workflow tooling and war-signal prompts`

## 当前结论

- 本地视频环境主链路已经可用，问题主要在 workflow 状态和镜头/提示词质量，不在模型安装本身。
- 第一镜头目前真正要解决的不是单纯“补一点负面词”，而是要把开场镜头语言整体切换到更史诗、更战后、更有世界规模感的方向。
- 后续生成最好不要一口气做完整段，先拆分验证：
  - `A0 Shot 1`：宏大战后城市
  - `A0 Shot 2`：林夏高处登场
  - `A0 Shot 3`：脸部稳定与眼神
  - `A0 Shot 6`：双车战斗追逐与转 gameplay

## 回家继续试时建议

1. 先拉取最新仓库：

```powershell
git pull --ff-only origin main
```

2. 重点看这些文件：
   - `docs/daily-summary-2026-06-05.md`
   - `docs/video/A0-rain-signal-script.md`
   - `docs/video/A0-war-signal-prompt-package.md`
   - `tools/neon-video-prompter/references/shot-library.json`
   - `tools/comfy/video_ltx2_3_i2v_A0_shot1_warsignal.json`

3. 如果家里 `ComfyUI` 环境和公司电脑一致，优先做：
   - `A0 Shot 1` 先出一版
   - 观察是否做到：
     - 城市规模感够不够
     - 战损是否明显
     - 林夏是否还像“希望”而不是“时尚 pose”
     - 脸和眼睛是否稳定

4. 如果家里生成质量明显更好，可以直接把家里更稳定的工作流状态和参数作为主版本，再回公司同步。

## 下一步最值得做的事

1. 拿到一版更强的 `A0 Shot 1`
2. 单独做 `A0 Shot 3` 的脸部稳定版本
3. 再做 `A0 Shot 6`，验证是否真能在爆炸或闪避里切进游戏
4. 之后再继续推进 `A2 -> I2` 的 `Marble / movie-to-play` 接法验证
